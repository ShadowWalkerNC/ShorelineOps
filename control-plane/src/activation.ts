import type { Pool } from 'pg'
import { z } from 'zod'
import { transaction } from './db/pool'
import { audit } from './security/audit'
import { sha256hex } from './security/tokens'
import { encryptOutbox, decryptOutbox } from './security/outboxCrypto'

export const Plan = z.enum(['PRO_TIER', 'ENTERPRISE_TIER'])
export const ActivationInput = z.object({
  email: z.string().trim().toLowerCase().email(), plan: Plan,
  projectId: z.string().uuid(), environmentId: z.string().uuid(),
  appServiceId: z.string().uuid(), databaseServiceId: z.string().uuid(),
  appOrigin: z.string().url(),
}).strict()
export type ActivationInput = z.infer<typeof ActivationInput>
export type ServiceVariables = Record<string, string | null>
export interface ActivationInspector {
  variables(project: string, environment: string, service: string): Promise<ServiceVariables>
  readiness(origin: string): Promise<{ ready: boolean; initialized: boolean; demo: boolean }>
}

function refuse(code: string): never { throw Object.assign(new Error(code), { code }) }
function origin(raw: string): string {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.up\.railway\.app$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) refuse('RAILWAY_HTTPS_ORIGIN_REQUIRED')
  return url.origin
}

/** Owner-only local operation. Never mounted as a public administrator endpoint.
 * Resources must already exist and pass provider + application checks. Signup
 * never creates infrastructure, charges a card or issues a paid license.
 */
export async function activateFacility(pool: Pool, raw: unknown, inspector: ActivationInspector) {
  const input = ActivationInput.parse(raw)
  const appOrigin = origin(input.appOrigin)
  if (input.appServiceId === input.databaseServiceId) refuse('DISTINCT_SERVICE_AND_DATABASE_REQUIRED')
  const account = await pool.query('SELECT id, email_verified_at FROM accounts WHERE email = $1', [input.email])
  if (!account.rows[0]?.email_verified_at) refuse('VERIFIED_ACCOUNT_REQUIRED')
  const [app, database] = await Promise.all([
    inspector.variables(input.projectId, input.environmentId, input.appServiceId),
    inspector.variables(input.projectId, input.environmentId, input.databaseServiceId),
  ])
  for (const [variables, service] of [[app, input.appServiceId], [database, input.databaseServiceId]] as const) {
    if (variables.RAILWAY_PROJECT_ID !== input.projectId || variables.RAILWAY_ENVIRONMENT_ID !== input.environmentId || variables.RAILWAY_SERVICE_ID !== service) refuse('PROVIDER_RESOURCE_IDENTITY_MISMATCH')
  }
  if (app.NODE_ENV !== 'production' || app.RAILWAY_PUBLIC_DOMAIN !== new URL(appOrigin).hostname ||
    app.SHORELINE_DEMO_SEED === 'true' || app.VITE_DEMO_MODE === 'true' || app.ALLOW_DEFAULT_CREDENTIALS === 'true') refuse('PRODUCTION_CONFIGURATION_REQUIRED')
  if (!app.JWT_SECRET || app.JWT_SECRET.length < 32 || !app.SETUP_BOOTSTRAP_SECRET || app.SETUP_BOOTSTRAP_SECRET.length < 16) refuse('UNIQUE_FACILITY_SECRETS_REQUIRED')
  let connection: URL
  try { connection = new URL(app.DATABASE_URL || '') } catch { return refuse('POSTGRES_CONNECTION_REQUIRED') }
  const password = database.PGPASSWORD || database.POSTGRES_PASSWORD
  const username = database.PGUSER || database.POSTGRES_USER
  const databaseName = database.PGDATABASE || database.POSTGRES_DB
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || !database.RAILWAY_PRIVATE_DOMAIN ||
    connection.hostname !== database.RAILWAY_PRIVATE_DOMAIN || !password || decodeURIComponent(connection.password) !== password ||
    !username || decodeURIComponent(connection.username) !== username || !databaseName || decodeURIComponent(connection.pathname.slice(1)) !== databaseName ||
    (connection.port || '5432') !== (database.PGPORT || '5432') || connection.search || connection.hash) refuse('DATABASE_SERVICE_BINDING_MISMATCH')
  const health = await inspector.readiness(appOrigin)
  if (!health.ready || health.demo) refuse('PRODUCTION_READINESS_REQUIRED')
  const hashes = [sha256hex(app.JWT_SECRET), sha256hex(app.SETUP_BOOTSTRAP_SECRET), sha256hex(password)]
  try {
    return await transaction(pool, async client => {
      const current = await client.query('SELECT id, email_verified_at FROM accounts WHERE id = $1 FOR UPDATE', [account.rows[0].id])
      if (!current.rows[0]?.email_verified_at) refuse('VERIFIED_ACCOUNT_REQUIRED')
      const request = await client.query('SELECT plan FROM activation_requests WHERE account_id = $1', [account.rows[0].id])
      if (request.rows[0]?.plan !== input.plan) refuse('MATCHING_ACTIVATION_REQUEST_REQUIRED')
      const previous = await client.query('SELECT * FROM facility_deployments WHERE account_id = $1', [account.rows[0].id])
      if (previous.rows[0]) {
        const existing = previous.rows[0]
        if (existing.project_id !== input.projectId || existing.environment_id !== input.environmentId || existing.app_service_id !== input.appServiceId ||
          existing.database_service_id !== input.databaseServiceId || existing.app_origin !== appOrigin || existing.plan !== input.plan ||
          existing.jwt_secret_hash !== hashes[0] || existing.bootstrap_secret_hash !== hashes[1] || existing.database_password_hash !== hashes[2]) refuse('ACTIVATION_CONFLICT')
        return { status: 'ready', appOrigin, alreadyActivated: true }
      }
      const cipher = health.initialized ? null : encryptOutbox({ to: account.rows[0].id, subject: 'facility-bootstrap', text: app.SETUP_BOOTSTRAP_SECRET! })
      await client.query(`INSERT INTO facility_deployments
        (account_id,plan,project_id,environment_id,app_service_id,database_service_id,app_origin,jwt_secret_hash,bootstrap_secret_hash,database_password_hash,bootstrap_cipher)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [account.rows[0].id, input.plan, input.projectId, input.environmentId, input.appServiceId, input.databaseServiceId, appOrigin, ...hashes, cipher])
      await audit(client, 'FACILITY_MANUALLY_ACTIVATED', { accountId: account.rows[0].id, meta: { plan: input.plan, appOrigin, appServiceId: input.appServiceId, databaseServiceId: input.databaseServiceId } })
      return { status: 'ready', appOrigin, alreadyActivated: false }
    })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') refuse('FACILITY_RESOURCES_OR_SECRETS_ALREADY_ASSIGNED')
    throw error
  }
}

export async function facilityStatus(pool: Pool, accountId: string) {
  const requested = await pool.query('SELECT plan FROM activation_requests WHERE account_id = $1', [accountId])
  const deployed = await pool.query('SELECT plan, app_origin, bootstrap_cipher FROM facility_deployments WHERE account_id = $1', [accountId])
  const facility = deployed.rows[0]
  let setupKey: string | null = null
  if (facility?.bootstrap_cipher) {
    const payload = decryptOutbox(facility.bootstrap_cipher)
    if (payload.to !== accountId || payload.subject !== 'facility-bootstrap') refuse('INVALID_BOOTSTRAP_ENVELOPE')
    setupKey = payload.text
  }
  return { activationMode: 'manual-owner', automaticProvisioning: false, status: facility ? 'ready' : requested.rows[0] ? 'awaiting-owner-activation' : 'not-requested',
    requestedPlan: requested.rows[0]?.plan ?? null, plan: facility?.plan ?? null, appOrigin: facility?.app_origin ?? null, setupKey }
}
