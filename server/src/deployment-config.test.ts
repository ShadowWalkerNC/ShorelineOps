import { decryptBackupBuffer } from './backup-crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync as nativeSpawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process'

function spawnSync(command: string, args: string[], options: SpawnSyncOptionsWithStringEncoding) {
  const diagnostic = process.env.SHORELINE_BACKUP_DIAGNOSTICS === 'true'
  const label = path.basename(command)
  const started = Date.now()
  // Synchronous writes remain visible while a native child blocks the Node event loop.
  // Never log arguments, environment values, key paths or captured dump contents.
  if (diagnostic) fs.writeSync(2, `[backup diagnostic] START ${label}\n`)
  const result = nativeSpawnSync(command, args, options)
  if (diagnostic) fs.writeSync(2, `[backup diagnostic] END ${label} milliseconds=${Date.now()-started} status=${result.status} error=${result.error?.name ?? 'none'}\n`)
  return result
}

// Isolated deployment-configuration tests. No database, network, container,
// or secret access: TLS policy is exercised through the pure resolver plus
// the installed pg ConnectionParameters constructor (synthetic credentials,
// never connected), manifests are asserted structurally, and backup scripts
// run against fake docker/pg_dump shims. Safe to run alongside other
// workstreams; it never touches shared build outputs.

// --- Environment isolation BEFORE the pool module is loaded ---
// Static `import ... from './db/pool'` would hoist above this assignment and
// let a developer's real DATABASE_URL reach the module, so pool/pg/yaml are
// required lazily below, after the environment is scrubbed.
const repoRoot = path.resolve(__dirname, '..', '..')
assert.ok(
  fs.existsSync(path.join(repoRoot, 'package.json')) && fs.existsSync(path.join(repoRoot, 'server', 'package.json')),
  `repoRoot resolved to ${repoRoot}, which is not the repository root (expected package.json + server/package.json).`
)
for (const key of Object.keys(process.env)) {
  if (key === 'DATABASE_URL' || key === 'SQLITE_PATH' || key.startsWith('PG')) delete process.env[key]
}
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-deploy-test-')), 'isolated.sqlite')

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolvePostgresTls, isLocalPostgresHost } = require('./db/pool') as typeof import('./db/pool')
// Installed pg constructor (pg 8.x exports the class directly). The
// constructor performs no I/O (no DNS, no connect, no file reads unless the
// URL carries sslcert-style params — which our resolver always strips).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ConnectionParameters = require('pg/lib/connection-parameters') as new (config: any) => any
// js-yaml ships with the root dev toolchain (no new installs allowed), so it
// is loaded by absolute path rather than as a server dependency.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require(path.join(repoRoot, 'node_modules', 'js-yaml')) as { load(s: string): any }

const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const TLS_QUERY_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat', 'sslnegotiation']

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const saved = process.env[key]
  try {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
    fn()
  } finally {
    if (saved === undefined) delete process.env[key]
    else process.env[key] = saved
  }
}

function withSslEnv(value: string | undefined, fn: () => void) {
  withEnv('DATABASE_SSL_REJECT_UNAUTHORIZED', value, fn)
}

/** pg-equivalent of what pool.ts hands the driver; asserts no query overwrite. */
function effectivePgConfig(tls: { connectionString: string; ssl: unknown; sslnegotiation?: string }) {
  return new ConnectionParameters({
    connectionString: tls.connectionString,
    ssl: tls.ssl,
    ...(tls.sslnegotiation ? { sslnegotiation: tls.sslnegotiation } : {}),
  })
}

function assertNoTlsQueryParams(sanitized: string) {
  const keys = new URL(sanitized).searchParams
  for (const name of TLS_QUERY_PARAMS) assert.equal(keys.has(name), false, `sanitized URL still carries ?${name}=`)
}

// ---------------------------------------------------------------- TLS policy

test('remote PostgreSQL verifies certificates by default', () => {
  withSslEnv(undefined, () => {
    const tls = resolvePostgresTls('postgresql://u:p@db.example.com:5432/x')
    assert.equal(tls.mode, 'verified')
    assert.deepEqual(tls.ssl, { rejectUnauthorized: true })
    assertNoTlsQueryParams(tls.connectionString)
  })
})

test('explicit unverified TLS requires DATABASE_SSL_REJECT_UNAUTHORIZED=false', () => {
  withSslEnv('false', () => {
    const tls = resolvePostgresTls('postgresql://u:p@db.example.com:5432/x')
    assert.equal(tls.mode, 'unverified')
    assert.deepEqual(tls.ssl, { rejectUnauthorized: false })
  })
  withSslEnv('true', () => {
    assert.equal(resolvePostgresTls('postgresql://u:p@db.example.com:5432/x').mode, 'verified')
  })
})

test('bare sslmode=require still verifies by default (no permissive remote TLS)', () => {
  withSslEnv(undefined, () => {
    for (const mode of ['require', 'prefer', 'allow']) {
      const tls = resolvePostgresTls(`postgresql://u:p@db.example.com:5432/x?sslmode=${mode}`)
      assert.equal(tls.mode, 'verified', mode)
      assert.deepEqual(tls.ssl, { rejectUnauthorized: true })
      assertNoTlsQueryParams(tls.connectionString)
    }
  })
})

test('explicit verify sslmode wins over the unverified escape hatch', () => {
  withSslEnv('false', () => {
    const tls = resolvePostgresTls('postgresql://u:p@db.example.com:5432/x?sslmode=verify-full')
    assert.equal(tls.mode, 'verified')
    assert.deepEqual(tls.ssl, { rejectUnauthorized: true })
  })
})

test('explicit no-verify modes select unverified TLS with a warning', () => {
  withSslEnv(undefined, () => {
    for (const url of [
      'postgresql://u:p@db.example.com:5432/x?sslmode=no-verify',
      'postgresql://u:p@db.example.com:5432/x?ssl=no-verify',
    ]) {
      const tls = resolvePostgresTls(url)
      assert.equal(tls.mode, 'unverified', url)
      assert.deepEqual(tls.ssl, { rejectUnauthorized: false })
      assertNoTlsQueryParams(tls.connectionString)
    }
  })
})

test('sslmode=disable / ssl=0 plaintext is accepted for local/private hosts only', () => {
  withSslEnv(undefined, () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'db', 'postgres', '192.168.1.10', '10.0.0.5', '172.20.0.3', 'db.local', 'pg.internal', '[fd00::1]', '[fe80::1]']) {
      for (const flag of ['sslmode=disable', 'ssl=0', 'ssl=false']) {
        const tls = resolvePostgresTls(`postgresql://u:p@${host}:5432/x?${flag}`)
        assert.equal(tls.mode, 'disabled', `${host} ${flag}`)
        assert.equal(tls.ssl, false)
        assertNoTlsQueryParams(tls.connectionString)
      }
    }
    for (const url of [
      'postgresql://u:p@db.example.com:5432/x?sslmode=disable',
      'postgresql://u:p@8.8.8.8:5432/x?sslmode=disable',
      'postgresql://u:p@db.example.com:5432/x?ssl=0',
      'postgresql://u:p@[2001:db8::1]:5432/x?sslmode=disable',
    ]) {
      assert.throws(() => resolvePostgresTls(url), /non-local host/, url)
    }
  })
})

test('plaintext permission follows the effective host (?host= override), not the URL hostname', () => {
  withSslEnv(undefined, () => {
    // URL looks local but pg would connect to the remote ?host= override.
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@localhost:5432/x?host=db.example.com&sslmode=disable'),
      /non-local host/
    )
    // URL looks remote but pg would connect to the local ?host= override.
    const tls = resolvePostgresTls('postgresql://u:p@db.example.com:5432/x?host=db&sslmode=disable')
    assert.equal(tls.mode, 'disabled')
    assert.ok(tls.connectionString.includes('host=db'), 'host override preserved for the driver')
    // Duplicate ?host= values fail fast: pg silently applies the last, but a
    // blank last value falls back to the URL hostname, so silent last-wins
    // would classify local while pg targets remote.
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@h:5432/x?host=db.example.com&host=db&sslmode=disable'),
      /Duplicate host/
    )
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@h:5432/x?host=db&host=db.example.com&sslmode=disable'),
      /Duplicate host/
    )
    // A single empty ?host= falls back to the URL hostname (pg semantics).
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@db.example.com:5432/x?host=&sslmode=disable'),
      /non-local host/
    )
  })
})

test('REGRESSION (pool owner): empty trailing ?host= must not disable remote TLS', () => {
  // Duplicate hosts fail fast (pg silently applies the last, but a blank
  // last value falls back to the URL hostname); either a Duplicate rejection
  // or a non-local classification satisfies "never disabled" — the buggy
  // behavior filtered the blank and returned disabled for a remote URL.
  withSslEnv(undefined, () => {
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@db.example.com:5432/x?host=localhost&host=&sslmode=disable'),
      /Duplicate host|non-local host/i
    )
  })
})

test('REGRESSION (pool owner): global 2001:db8::10.0.0.1 with IPv4 tail is not local', () => {
  // Only true IPv4-mapped IPv6 (e.g. ::ffff:10.0.0.1) classifies by its
  // embedded IPv4; any other dotted IPv6 such as global 2001:db8::10.0.0.1
  // (documentation prefix) classifies by its own prefix (remote).
  assert.equal(isLocalPostgresHost('2001:db8::10.0.0.1'), false, 'bare global IPv6 with tail')
  assert.equal(isLocalPostgresHost('[2001:db8::10.0.0.1]'), false, 'bracketed global IPv6 with tail')
  withSslEnv(undefined, () => {
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@[2001:db8::10.0.0.1]:5432/x?sslmode=disable'),
      /non-local host/
    )
  })
})

test('ambiguous or unsupported TLS inputs fail fast with actionable errors', () => {
  withSslEnv(undefined, () => {
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?sslmode=require&sslmode=disable'), /Duplicate sslmode/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?ssl=true&ssl=0'), /Duplicate ssl parameters/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?sslmode=require&ssl=true'), /both sslmode and ssl/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?sslmode=bogus'), /Unknown sslmode/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?ssl=bogus'), /Unknown ssl value/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?uselibpqcompat=true&sslmode=require'), /uselibpqcompat/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?sslnegotiation=bogus'), /Invalid sslnegotiation/)
    assert.throws(() => resolvePostgresTls('postgresql://u:p@h/x?sslnegotiation=direct&another=x&sslnegotiation=postgres'), /Duplicate sslnegotiation/)
    assert.throws(
      () => resolvePostgresTls('postgresql://u:p@localhost/x?sslmode=disable&sslnegotiation=direct'),
      /sslnegotiation=direct requires TLS/
    )
  })
})

test('sslnegotiation=direct is validated and passed through to the driver', () => {
  withSslEnv(undefined, () => {
    const tls = resolvePostgresTls('postgresql://u:p@db.example.com:5432/x?sslmode=require&sslnegotiation=direct')
    assert.equal(tls.mode, 'verified')
    assert.equal(tls.sslnegotiation, 'direct')
    assertNoTlsQueryParams(tls.connectionString)
    const cp = effectivePgConfig(tls)
    assert.equal(cp.sslnegotiation, 'direct')
    assert.deepEqual(cp.ssl, { rejectUnauthorized: true })
  })
})

test('certificate file parameters are resolved into the ssl object and stripped', () => {
  withSslEnv(undefined, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-tls-'))
    const ca = path.join(dir, 'ca.pem')
    const cert = path.join(dir, 'cert.pem')
    const key = path.join(dir, 'key.pem')
    fs.writeFileSync(ca, 'SYNTHETIC-CA')
    fs.writeFileSync(cert, 'SYNTHETIC-CERT')
    fs.writeFileSync(key, 'SYNTHETIC-KEY')
    const url =
      `postgresql://u:p@db.example.com:5432/x?sslmode=verify-full` +
      `&sslrootcert=${encodeURIComponent(ca)}&sslcert=${encodeURIComponent(cert)}&sslkey=${encodeURIComponent(key)}`
    const tls = resolvePostgresTls(url)
    assert.equal(tls.mode, 'verified')
    assert.deepEqual(tls.ssl, { rejectUnauthorized: true, ca: 'SYNTHETIC-CA', cert: 'SYNTHETIC-CERT', key: 'SYNTHETIC-KEY' })
    assertNoTlsQueryParams(tls.connectionString)
    const cp = effectivePgConfig(tls)
    assert.equal(cp.ssl.ca, 'SYNTHETIC-CA')
    assert.throws(() => resolvePostgresTls(`postgresql://u:p@h/x?sslrootcert=${encodeURIComponent(path.join(dir, 'missing.pem'))}`), /Could not read sslrootcert/)
    assert.throws(() => resolvePostgresTls(`postgresql://u:p@localhost/x?sslmode=disable&sslrootcert=${encodeURIComponent(ca)}`), /plaintext/)
  })
})

test('unparseable connection strings are rejected before reaching the driver', () => {
  withSslEnv(undefined, () => {
    assert.throws(() => resolvePostgresTls('not-a-url'), /could not be parsed/)
  })
})

test('other URL parameters survive TLS stripping', () => {
  withSslEnv(undefined, () => {
    const tls = resolvePostgresTls('postgresql://u:p@localhost:5432/x?connect_timeout=5&sslmode=disable&application_name=app')
    assert.equal(tls.mode, 'disabled')
    assert.ok(tls.connectionString.includes('connect_timeout=5'))
    assert.ok(tls.connectionString.includes('application_name=app'))
    assertNoTlsQueryParams(tls.connectionString)
  })
})

test('local-host classification covers loopback, private nets, sockets, and service names', () => {
  for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]', '0:0:0:0:0:0:0:1', 'db', 'postgres', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '169.254.10.20', 'probe.local', 'pg.internal', 'fc00::1', 'FD00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0', '::ffff:10.0.0.1', '/var/run/postgresql']) {
    assert.equal(isLocalPostgresHost(host), true, host)
  }
  // fdserver is single-label (Compose-service / LAN-short-name local by design);
  // the historical prefix bug was dotted names like fd01.example.com (remote).
  assert.equal(isLocalPostgresHost('fdserver'), true, 'fdserver')
  for (const host of ['db.example.com', '8.8.8.8', '172.32.0.1', '11.0.0.1', '', '2001:db8::1', '::2', '::ffff:8.8.8.8', 'fc01.example.com', 'fd01.example.com', 'facebook.com', 'fe80.example.com']) {
    assert.equal(isLocalPostgresHost(host), false, host)
  }
})

// ------------------------------------------------- installed pg integration

test('installed pg ConnectionParameters would overwrite ssl from the query (why the resolver strips)', () => {
  // Synthetic credentials; the constructor never connects. unstripped input:
  const raw = new ConnectionParameters({
    connectionString: 'postgresql://synthetic:synthetic@example.invalid:5432/x?sslmode=disable',
    ssl: { rejectUnauthorized: true },
  })
  assert.equal(raw.ssl, false, 'pg lets ?sslmode=disable replace the explicit ssl object')
})

test('resolved TLS survives the installed pg ConnectionParameters in every mode', () => {
  withSslEnv(undefined, () => {
    const verified = resolvePostgresTls('postgresql://synthetic:synthetic@example.invalid:5432/x')
    assert.deepEqual(effectivePgConfig(verified).ssl, { rejectUnauthorized: true })
    const disabled = resolvePostgresTls('postgresql://synthetic:synthetic@localhost:5432/x?sslmode=disable')
    assert.equal(effectivePgConfig(disabled).ssl, false)
  })
  withSslEnv('false', () => {
    const unverified = resolvePostgresTls('postgresql://synthetic:synthetic@example.invalid:5432/x')
    assert.deepEqual(effectivePgConfig(unverified).ssl, { rejectUnauthorized: false })
  })
})

test('PGSSLMODE in the environment cannot weaken resolved TLS', () => {
  withEnv('PGSSLMODE', 'disable', () => {
    withSslEnv(undefined, () => {
      const tls = resolvePostgresTls('postgresql://synthetic:synthetic@example.invalid:5432/x')
      assert.equal(tls.mode, 'verified')
      assert.deepEqual(effectivePgConfig(tls).ssl, { rejectUnauthorized: true })
    })
  })
})

// ------------------------------------------------------- compose structure

test('compose files parse as YAML with string environment entries and scoped healthchecks', () => {
  const local = yaml.load(read('docker-compose.yml')) as any
  assert.ok(local.services.shorelineops && local.services.db, 'local services present')
  for (const [name, svc] of Object.entries<any>(local.services)) {
    for (const entry of svc.environment as unknown[]) {
      // Regression guard for the quoting bug: an unquoted ${VAR:?...} value
      // parses as a nested mapping instead of a "KEY=value" string.
      assert.equal(typeof entry, 'string', `${name} env entry must be a string, got ${JSON.stringify(entry)}`)
      assert.match(entry as string, /^[^=\s]+=[\s\S]*$/, `${name} env entry must be KEY=value`)
    }
  }
  assert.match(local.services.db.healthcheck.test.join(' '), /\$\$POSTGRES_USER/, 'db probe uses container scope ($$)')
  assert.match(local.services.shorelineops.healthcheck.test.join(' '), /\/ready/, 'app probe uses readiness')

  const prod = yaml.load(read('docker-compose.production.yml')) as any
  assert.ok(prod.services.postgres && prod.services.api && prod.services['reverse-proxy'], 'production services present')
  for (const [name, svc] of Object.entries<any>(prod.services)) {
    if (name === 'reverse-proxy') continue
    for (const [key, value] of Object.entries(svc.environment as Record<string, unknown>)) {
      // Scalars only: the quoting regression parses a value as a nested map.
      assert.ok(['string', 'number', 'boolean'].includes(typeof value), `${name}.${key} must be a scalar, got ${JSON.stringify(value)}`)
    }
  }
  assert.match(prod.services.postgres.healthcheck.test.join(' '), /\$\$POSTGRES_DB/, 'postgres probe uses container scope')
  assert.match(prod.services.api.healthcheck.test.join(' '), /\/ready/, 'api probe uses readiness')
  assert.ok(!('ports' in prod.services.postgres), 'production database publishes no ports')
})

test('compose files require external secrets and use canonical facility scope', () => {
  for (const rel of ['docker-compose.yml', 'docker-compose.production.yml']) {
    const text = read(rel)
    assert.ok(text.includes('SHORELINE_FACILITY_ID'), `${rel}: canonical facility scope`)
    assert.ok(text.includes('FACILITY_ID'), `${rel}: hardware FACILITY_ID compatibility`)
    assert.ok(text.includes('JWT_SECRET:?'), `${rel}: JWT_SECRET required`)
    assert.ok(!text.includes('REJECT_UNAUTHORIZED=false'), `${rel}: no unverified-TLS default`)
    for (const leaked of ['shoreline_secure_pass', 'shoreline_secure_password_2026', 'change_me_before_prod', 'must_be_over_32_chars', 'shoreline_admin']) {
      assert.ok(!text.includes(leaked), `${rel}: no usable default credential ${leaked}`)
    }
    for (const softDefault of ['${JWT_SECRET:-', '${DB_PASSWORD:-', '${POSTGRES_PASSWORD:-', '${DB_USER:-', '${DB_NAME:-']) {
      assert.ok(!text.includes(softDefault), `${rel}: no soft default ${softDefault}`)
    }
  }
  assert.ok(read('docker-compose.yml').includes('POSTGRES_PASSWORD:?'), 'local compose requires db password')
  assert.ok(read('docker-compose.production.yml').includes('DB_PASSWORD:?'), 'production compose requires db password')
})

test('production database stays private', () => {
  const text = read('docker-compose.production.yml')
  assert.ok(!text.includes('5432:5432'), 'no published database port')
  assert.ok(text.includes('no published ports'), 'privacy documented')
})

test('production compose documents explicit override-file for external DATABASE_URL (host export ignored)', () => {
  const text = read('docker-compose.production.yml')
  assert.ok(!text.includes('set DATABASE_URL to its full connection string'), 'misleading host-override claim removed')
  for (const marker of ['host DATABASE_URL', 'IGNORED', 'override file', 'docker-compose.external-db.yml', '-f docker-compose.production.yml', '--no-deps', 'up -d --no-deps api', 'depends_on', 'interpolat']) {
    assert.ok(text.includes(marker), `production compose documents ${marker}`)
  }
  const deploy = read('DEPLOYMENT.md')
  assert.ok(deploy.includes('docker-compose.external-db.yml'), 'DEPLOYMENT.md documents override file')
  assert.ok(deploy.includes('alone is ignored'), 'DEPLOYMENT.md warns host export ignored')
  for (const marker of ['--no-deps', 'depends_on', 'interpolat']) {
    assert.ok(deploy.includes(marker), `DEPLOYMENT.md documents ${marker}`)
  }
})

test('optional reverse proxy is disabled by default, HTTP-only, and proxies the unified api', () => {
  const prod = yaml.load(read('docker-compose.production.yml')) as any
  const proxy = prod.services['reverse-proxy']
  assert.ok((proxy.profiles as string[]).includes('proxy'), 'proxy opt-in via --profile proxy')
  assert.ok(!(proxy.ports as string[]).some((p) => p.includes('443')), 'no misleading 443 mapping without TLS')
  assert.deepEqual(proxy.volumes, ['./nginx.conf:/etc/nginx/conf.d/default.conf:ro'], 'server block mounted as conf.d snippet, not the main config')
  const nginx = read('nginx.conf')
  assert.ok(nginx.includes('proxy_pass http://api:3001'), 'all traffic proxied to the unified api')
  assert.ok(!nginx.includes('location /api/'), 'no partial /api/ split')
  assert.ok(!nginx.includes('/usr/share/nginx/html'), 'no static root without mounted assets')
  assert.ok(!nginx.includes('listen 443') && !nginx.includes('ssl_certificate') && !nginx.includes('443:443'), 'no TLS claim without a tested setup')
})

// ------------------------------------------------------------------- probes

/** Actual HEALTHCHECK instruction lines (continuations joined), never comments. */
function healthcheckDirectives(dockerfile: string): string[] {
  const joined = dockerfile.replace(/\\\r?\n\s*/g, ' ').split(/\r?\n/)
  return joined.map((l) => l.trim()).filter((l) => /^healthcheck\b/i.test(l))
}

test('orchestrator probes use readiness, not liveness', () => {
  for (const rel of ['Dockerfile', 'server/Dockerfile']) {
    const directives = healthcheckDirectives(read(rel))
    assert.ok(directives.length >= 1, `${rel}: has an actual HEALTHCHECK instruction`)
    for (const d of directives) {
      assert.ok(d.includes('/ready'), `${rel}: HEALTHCHECK probes readiness`)
      assert.ok(!d.includes('/health'), `${rel}: HEALTHCHECK never probes liveness`)
    }
    const codeLines = read(rel).split(/\r?\n/).filter((l) => !l.trimStart().startsWith('#'))
    assert.ok(!codeLines.join('\n').includes('/health'), `${rel}: no /health outside comments`)
  }
  for (const rel of ['docker-compose.yml', 'docker-compose.production.yml']) {
    const text = read(rel)
    assert.ok(!text.includes('/health'), `${rel}: no liveness probe`)
  }
  const railway = JSON.parse(read('railway.json')) as { deploy: { healthcheckPath: string } }
  assert.equal(railway.deploy.healthcheckPath, '/ready')
  const render = yaml.load(read('render.yaml')) as any
  const api = (render.services as any[]).find((s) => s.name === 'shoreline-api')
  assert.ok(api, 'render blueprint keeps the api service')
  assert.equal(api.healthCheckPath, '/ready', 'render probes readiness')
})

// ------------------------------------------------- image/publish hygiene

test('backup artifacts are excluded from images and version control', () => {
  const ignore = read('.dockerignore')
  for (const entry of ['backups/', 'shorelineops_backup_*', '*.sql.gz']) {
    assert.ok(ignore.includes(entry), `.dockerignore covers ${entry}`)
  }
  const gitignore = read('.gitignore')
  for (const entry of ['backups/', 'shorelineops_backup_*', '*.sql.gz']) {
    assert.ok(gitignore.includes(entry), `.gitignore covers ${entry}`)
  }
})

// ------------------------------------------------------- backup scripts

test('bash backup validates the raw dump before gzip and never rotates on failure', () => {
  const text = read('scripts/backup.sh')
  for (const marker of ['TMP_RAW', 'gzip -c', '-s "${TMP_RAW}"', 'umask 077', 'chmod 600', '.tmp.', 'trap', 'rotation skipped']) {
    assert.ok(text.includes(marker), `backup.sh contains ${marker}`)
  }
  assert.ok(!text.includes('docker exec -t'), 'no pseudo-TTY on docker exec')
  assert.ok(!text.includes('| gzip'), 'no unvalidated dump-to-gzip pipe (empty input still yields non-empty gzip)')
  assert.ok(
    text.indexOf('find "${BACKUP_DIR_ABS}"') > text.indexOf('node "${CRYPTO_TOOL}" encrypt'),
    'rotation runs only after successful publish'
  )
  assert.ok(text.includes('pending acceptance gate'), 'restore gate disclosed as pending')
  assert.ok(!text.includes('openssl') && !text.includes('gpg'), 'no untested encryption claim')
})

test('powershell backup pre-restricts output with SID ACLs and never rotates on failure', () => {
  const text = read('scripts/backup.ps1')
  for (const marker of ['GetCurrent().User', 'icacls', '/inheritance:r', '.tmp.', 'encrypt --key-file', '$LASTEXITCODE', 'ProcessStartInfo', 'BaseStream', 'CopyTo', 'Assert-SafeBackupToken', 'UseShellExecute', 'RedirectStandardOutput', 'rotation skipped', 'exit 1', 'pending acceptance gate']) {
    assert.ok(text.includes(marker), `backup.ps1 contains ${marker}`)
  }
  assert.ok(!text.includes('docker exec -t'), 'no pseudo-TTY on docker exec')
  assert.ok(!text.includes('"$env:USERNAME'), 'no invalid bare-username ACL grantee')
  assert.ok(!text.includes('cmd /c'), 'no shell string-built cmd invocation')
  assert.ok(!text.includes('$dumpCommand'), 'no string-built dump command variable')
  assert.ok(text.indexOf('New-Item -ItemType File -Path $TempFile') < text.indexOf('New-Object System.Diagnostics.Process'), 'temp file pre-created before the dump')
  assert.ok(
    text.indexOf('Assert-SafeBackupToken $ContainerName') < text.indexOf('Get-Command docker'),
    'token validation runs before any docker command'
  )
  assert.ok(
    text.indexOf('Assert-SafeBackupToken $DbUser') < text.indexOf('New-Object System.Diagnostics.Process'),
    'DB validation runs before process launch'
  )
  assert.ok(
    text.indexOf('Get-ChildItem -LiteralPath $BackupDirFull') > text.indexOf('& node $cryptoTool encrypt'),
    'rotation runs only after successful publish'
  )
  assert.ok(!text.includes('openssl') && !text.includes('gpg '), 'no untested encryption claim')
})

test('powershell backup requires explicit DB identity (no stale defaults)', () => {
  const text = read('scripts/backup.ps1')
  assert.ok(!text.includes('$DbUser = "shoreline"'), 'no stale DbUser default')
  assert.ok(!text.includes("$DbUser = 'shoreline'"), 'no stale DbUser default (single-quoted)')
  assert.ok(!text.includes('$DbName = "shorelineops"'), 'no stale DbName default')
  assert.ok(!text.includes("$DbName = 'shorelineops'"), 'no stale DbName default (single-quoted)')
  assert.ok(text.includes('DB_USER / POSTGRES_USER'), 'DbUser error references Compose-required values')
  assert.ok(text.includes('DB_NAME / POSTGRES_DB'), 'DbName error references Compose-required values')
  assert.ok(text.includes('^[A-Za-z0-9_.-]+$'), 'strict token allowlist present')
  assert.ok(text.includes('quotes, %, &'), 'rejection message names quotes/percent/ampersand')
})

test('bash backup requires explicit DB identity for the container path (no stale defaults)', () => {
  const text = read('scripts/backup.sh')
  assert.ok(!text.includes('DB_USER:-shoreline'), 'no stale DB_USER default')
  assert.ok(!text.includes('DB_NAME:-shorelineops'), 'no stale DB_NAME default')
  assert.ok(text.includes('DB_USER is required'), 'DB_USER error names the missing value')
  assert.ok(text.includes('DB_NAME is required'), 'DB_NAME error names the missing value')
  assert.ok(text.includes('DB_USER / POSTGRES_USER'), 'DB_USER error references Compose-required values')
  assert.ok(text.includes('DB_NAME / POSTGRES_DB'), 'DB_NAME error references Compose-required values')
  assert.ok(text.includes('container dump path'), 'identity scoped to the container path')
  assert.ok(text.includes('DATABASE_URL'), 'DATABASE_URL fallback documented')
  assert.ok(text.includes('require DB_USER/DB_NAME'), 'fallback documented without identity')
})

// --------------------------------------- synthetic backup execution tests

function findExecutableOnPath(command: string, args: string[]): string | null {
  const probed = spawnSync(command, args, { encoding: 'utf8', timeout: 15_000 })
  if (probed.error === undefined && probed.status === 0) return command
  return null
}

function findBash(): string | null {
  if (process.platform === 'win32') {
    // PATH may resolve the WSL launcher; these fixtures require Git Bash/MSYS path semantics.
    for (const candidate of ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe']) {
      if (fs.existsSync(candidate)) return candidate
    }
    return null
  }
  return findExecutableOnPath('bash', ['--version'])
}

function findPowershell(): string | null {
  return findExecutableOnPath('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion']) ||
    findExecutableOnPath('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion'])
}

const bashPath = findBash()
// backup.ps1 uses Windows ACLs and these fixtures use native .cmd shims.
// PowerShell installed on Linux does not supply either contract; CI runs this suite on Windows too.
const powershellPath = process.platform === 'win32' ? findPowershell() : undefined
const syntheticBackupKey = 'synthetic-test-only-random-looking-key-1234567890'

test('backup scripts reject unavailable encryption before invoking a dump or rotation', () => {
  for (const shell of ['bash', 'powershell']) {
    if (shell === 'bash' && !bashPath || shell === 'powershell' && !powershellPath) continue
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-key-preflight-'))
    const bin = path.join(work, 'bin'), backups = path.join(work, 'backups'), marker = path.join(work, 'invoked')
    fs.mkdirSync(bin)
    const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.enc')
    fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash\necho invoked > '${toPosixPath(marker)}'\nexit 99\n`, { mode: 0o755 })
    fs.writeFileSync(path.join(bin, 'docker.cmd'), `@echo off\r\necho invoked>"${marker}"\r\nexit /b 99\r\n`)
    const missing = path.join(work, 'unavailable.key')
    const result = shell === 'bash'
      ? spawnSync(bashPath!, [toPosixPath(path.join(repoRoot, 'scripts', 'backup.sh'))], { cwd: work, encoding: 'utf8', timeout: 90_000, env: { ...process.env, PATH: `${toPosixPath(bin)}:${process.env.PATH}`, DB_USER: 'synthetic', DB_NAME: 'synthetic', DATABASE_URL: '', BACKUP_DIR: backups, BACKUP_KEY_FILE: missing } })
      : spawnSync(powershellPath!, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(repoRoot, 'scripts', 'backup.ps1'), '-DbUser', 'synthetic', '-DbName', 'synthetic', '-BackupDir', backups, '-KeyFile', missing], { encoding: 'utf8', timeout: 90_000, env: powershellChildEnv({ PATH: `${bin}${path.delimiter}${process.env.PATH}` }) })
    assert.notEqual(result.status, 0, `${shell}: missing key rejected`)
    assert.equal(fs.existsSync(marker), false, `${shell}: docker never invoked`)
    assert.equal(fs.existsSync(seeded), true, `${shell}: rotation skipped`)
    assert.equal(listArtifacts(backups, /\.tmp\./).length, 0)
  }
})

function seedOldArtifact(dir: string, fileName: string): string {
  const keyPath = path.join(path.dirname(dir), 'backup.key')
  fs.writeFileSync(keyPath, syntheticBackupKey, { mode: 0o600 })
  if (process.platform === 'win32') {
    const acl = spawnSync('powershell', ['-NoProfile', '-Command', `icacls '${keyPath}' /inheritance:r /grant:r "*$([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value):F" | Out-Null`], { env: powershellChildEnv({}), encoding: 'utf8', timeout: 15_000 })
    assert.equal(acl.status, 0, `Synthetic key ACL setup failed: ${acl.error?.message ?? acl.stderr}`)
  }
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, fileName)
  fs.writeFileSync(target, 'seeded-old-artifact')
  const old = new Date(Date.now() - 40 * 24 * 3600 * 1000)
  fs.utimesSync(target, old, old)
  return target
}

function listArtifacts(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((n) => pattern.test(n)).sort()
}

/** Windows path (C:\x\y) to MSYS/Git-Bash POSIX form (/c/x/y); POSIX input passes through. */
function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^([A-Za-z]):\//, (_, d: string) => `/${d.toLowerCase()}/`)
}

/** PowerShell child env with explicit safe Windows execution variables.
 * The restricted runner keeps explicit OS paths plus synthetic DB/JWT,
 * without inherited application credentials. Without PATHEXT, backup.ps1's
 * `Get-Command docker` cannot resolve the synthetic `docker.cmd` shim, so
 * the positive test fails and empty/fail tests falsely pass before pg_dump.
 * Provide a minimal safe PATHEXT (COM/EXE/BAT/CMD only, no script hosts)
 * and COMSPEC derived from SystemRoot. Scoped to PowerShell children in
 * this file only; the runner is unchanged. Non-Windows passes through. */
function powershellChildEnv(extra: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { ...process.env, ...extra }
  if (process.platform === 'win32') {
    const pathext = process.env.PATHEXT
    if (!pathext) env.PATHEXT = '.COM;.EXE;.BAT;.CMD'
    else if (!/\.CMD\b/i.test(pathext)) env.PATHEXT = `${pathext};.CMD`
    if (!process.env.COMSPEC && process.env.SystemRoot) {
      env.COMSPEC = path.join(process.env.SystemRoot, 'System32', 'cmd.exe')
    }
  }
  return env as NodeJS.ProcessEnv
}

test('bash backup publishes a valid gzip artifact on success (synthetic docker)', { skip: bashPath ? false : 'bash not available' }, () => {
  assert.ok(bashPath)
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-bash-ok-'))
  const bin = path.join(work, 'bin')
  const backups = path.join(work, 'backups')
  fs.mkdirSync(bin, { recursive: true })
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
if [ "$1" = "ps" ]; then echo "$FAKE_CONTAINER"; exit 0; fi
if [ "$1" = "exec" ]; then
  case "\${FAKE_PGDUMP_MODE:-ok}" in
    fail) echo "fake pg_dump failure" >&2; exit 1;;
    empty) exit 0;;
    *) printf 'SYNTHETIC-DUMP ok\\n'; exit 0;;
  esac
fi
echo "unexpected docker args: $*" >&2; exit 99
`)
  fs.chmodSync(path.join(bin, 'docker'), 0o755)
  const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.gz.enc')
  const result = spawnSync(bashPath, [toPosixPath(path.join(repoRoot, 'scripts', 'backup.sh'))], {
    encoding: 'utf8',
    timeout: 90_000,
    cwd: work,
    env: {
      ...process.env,
      PATH: `${toPosixPath(bin)}:${process.env.PATH}`,
      BACKUP_DIR: 'backups',
      BACKUP_KEY_FILE: path.join(work, 'backup.key'),
      CONTAINER_NAME: 'synth-postgres',
      FAKE_CONTAINER: 'synth-postgres',
      FAKE_PGDUMP_MODE: 'ok',
      DB_USER: 'synthetic',
      DB_NAME: 'synthetic',
      DATABASE_URL: '',
    },
  })
  assert.equal(result.status, 0, `backup.sh stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  const artifacts = listArtifacts(backups, /^shorelineops_backup_.*\.sql\.gz\.enc$/)
  assert.equal(artifacts.length, 1, `exactly one artifact published, found ${artifacts}`)
  const payload = zlib.gunzipSync(decryptBackupBuffer(fs.readFileSync(path.join(backups, artifacts[0])), syntheticBackupKey)).toString('utf8')
  assert.ok(payload.includes('SYNTHETIC-DUMP'), 'artifact decompresses to the synthetic dump')
  assert.ok(!fs.existsSync(seeded), 'rotation pruned the seeded old artifact after success')
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(backups, artifacts[0])).mode & 0o777, 0o600, 'artifact restricted to owner')
  }
})

for (const mode of ['empty', 'fail']) {
  test(`bash backup fails closed on ${mode} synthetic dump (no publish, rotation skipped)`, { skip: bashPath ? false : 'bash not available' }, () => {
    assert.ok(bashPath)
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `shoreline-bash-${mode}-`))
    const bin = path.join(work, 'bin')
    const backups = path.join(work, 'backups')
    fs.mkdirSync(bin, { recursive: true })
    fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
if [ "$1" = "ps" ]; then echo "$FAKE_CONTAINER"; exit 0; fi
if [ "$1" = "exec" ]; then
  case "\${FAKE_PGDUMP_MODE:-ok}" in
    fail) echo "fake pg_dump failure" >&2; exit 1;;
    empty) exit 0;;
    *) printf 'SYNTHETIC-DUMP ok\\n'; exit 0;;
  esac
fi
echo "unexpected docker args: $*" >&2; exit 99
`)
    fs.chmodSync(path.join(bin, 'docker'), 0o755)
    const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.gz.enc')
    const result = spawnSync(bashPath, [toPosixPath(path.join(repoRoot, 'scripts', 'backup.sh'))], {
      encoding: 'utf8',
      timeout: 90_000,
      cwd: work,
      env: {
        ...process.env,
        PATH: `${toPosixPath(bin)}:${process.env.PATH}`,
        BACKUP_DIR: 'backups',
      BACKUP_KEY_FILE: path.join(work, 'backup.key'),
        CONTAINER_NAME: 'synth-postgres',
        FAKE_CONTAINER: 'synth-postgres',
        FAKE_PGDUMP_MODE: mode,
        DB_USER: 'synthetic',
        DB_NAME: 'synthetic',
        DATABASE_URL: '',
      },
    })
    assert.notEqual(result.status, 0, `expected nonzero exit for ${mode} dump`)
    assert.deepEqual(listArtifacts(backups, /^shorelineops_backup_.*\.sql\.gz\.enc$/), ['shorelineops_backup_20000101_000000.sql.gz.enc'])
    assert.ok(fs.existsSync(seeded), 'rotation skipped: seeded old artifact retained')
    assert.equal(listArtifacts(backups, /\.tmp\./).length, 0, 'no temp files left behind')
  })
}

test('bash backup requires explicit DB identity (synthetic, no docker/publish/rotation)', { skip: bashPath ? false : 'bash not available' }, () => {
  assert.ok(bashPath)
  const variants: Array<{ name: string; env: Record<string, string> }> = [
    { name: 'both missing', env: {} },
    { name: 'DB_NAME missing', env: { DB_USER: 'synthetic' } },
    { name: 'DB_USER missing', env: { DB_NAME: 'synthetic' } },
  ]
  for (const variant of variants) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-bash-missing-'))
    const bin = path.join(work, 'bin')
    const backups = path.join(work, 'backups')
    fs.mkdirSync(bin, { recursive: true })
    const invocationLog = path.join(work, 'docker-invoked.log')
    fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "invoked $*" >> "$FAKE_INVOCATION_LOG"
if [ "$1" = "ps" ]; then echo "$FAKE_CONTAINER"; exit 0; fi
if [ "$1" = "exec" ]; then printf 'SYNTHETIC-DUMP ok\\n'; exit 0; fi
echo "unexpected docker args: $*" >&2; exit 99
`)
    fs.chmodSync(path.join(bin, 'docker'), 0o755)
    const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.gz.enc')
    const childEnv: Record<string, string | undefined> = {
      ...process.env,
      PATH: `${toPosixPath(bin)}:${process.env.PATH}`,
      BACKUP_DIR: 'backups',
      BACKUP_KEY_FILE: path.join(work, 'backup.key'),
      CONTAINER_NAME: 'synth-postgres',
      FAKE_CONTAINER: 'synth-postgres',
      FAKE_PGDUMP_MODE: 'ok',
      FAKE_INVOCATION_LOG: toPosixPath(invocationLog),
      DATABASE_URL: '',
      ...variant.env,
    }
    // Missing vars must be truly unset (no leak from a developer shell).
    if (!('DB_USER' in variant.env)) delete childEnv.DB_USER
    if (!('DB_NAME' in variant.env)) delete childEnv.DB_NAME
    const result = spawnSync(bashPath, [toPosixPath(path.join(repoRoot, 'scripts', 'backup.sh'))], {
      encoding: 'utf8',
      timeout: 90_000,
      cwd: work,
      env: childEnv as NodeJS.ProcessEnv,
    })
    assert.notEqual(result.status, 0, `${variant.name} must fail:\n${result.stdout}\n${result.stderr}`)
    const output = `${result.stdout}${result.stderr}`
    assert.ok(output.includes('is required'), `${variant.name} names the missing required value`)
    assert.ok(output.includes('DB_USER') || output.includes('DB_NAME'), `${variant.name} references Compose-required values`)
    assert.deepEqual(listArtifacts(backups, /^shorelineops_backup_.*\.sql\.gz\.enc$/), ['shorelineops_backup_20000101_000000.sql.gz.enc'], `${variant.name}: no artifact published`)
    assert.ok(fs.existsSync(seeded), `${variant.name}: rotation skipped`)
    assert.equal(listArtifacts(backups, /\.tmp\./).length, 0, `${variant.name}: no temp files left behind`)
    assert.equal(fs.existsSync(invocationLog), false, `${variant.name}: docker never executed (rejected before any command)`)
  }
})

test('powershell backup publishes a valid artifact on success (synthetic docker)', { skip: powershellPath ? false : 'powershell not available' }, () => {
  assert.ok(powershellPath)
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-ps-ok-'))
  const bin = path.join(work, 'bin')
  const backups = path.join(work, 'backups')
  fs.mkdirSync(bin, { recursive: true })
  fs.mkdirSync(backups, { recursive: true })
  const invocationLog = path.join(work, 'docker-invoked.log')
  fs.writeFileSync(path.join(bin, 'docker.cmd'), [
    '@echo off',
    `echo invoked %*>>"${invocationLog}"`,
    'if "%~1"=="exec" goto doexec',
    'if "%~1"=="ps" echo %FAKE_CONTAINER%',
    'exit /b 0',
    ':doexec',
    'if "%FAKE_PGDUMP_MODE%"=="fail" ( echo fake pg_dump failure 1>&2 & exit /b 1 )',
    'if "%FAKE_PGDUMP_MODE%"=="empty" exit /b 0',
    'echo SYNTHETIC-DUMP ok',
    'exit /b 0',
    '',
  ].join('\r\n'))
  const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.enc')
  const result = spawnSync(powershellPath, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(repoRoot, 'scripts', 'backup.ps1'),
    '-BackupDir', backups, '-ContainerName', 'synth-postgres', '-DbUser', 'synthetic', '-DbName', 'synthetic', '-KeyFile', path.join(work, 'backup.key'),
  ], {
    encoding: 'utf8',
    timeout: 120_000,
    env: powershellChildEnv({ PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_CONTAINER: 'synth-postgres', FAKE_PGDUMP_MODE: 'ok' }),
  })
  assert.equal(result.status, 0, `backup.ps1 stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  const artifacts = listArtifacts(backups, /^shorelineops_backup_.*\.sql\.enc$/)
  assert.equal(artifacts.length, 1, `exactly one artifact published, found ${artifacts}`)
  assert.ok(decryptBackupBuffer(fs.readFileSync(path.join(backups, artifacts[0])), syntheticBackupKey).toString('utf8').includes('SYNTHETIC-DUMP'), 'artifact holds the synthetic dump')
  assert.ok(!fs.existsSync(seeded), 'rotation pruned the seeded old artifact after success')
  assert.ok(!`${result.stdout}${result.stderr}`.includes('docker CLI not found'), 'fake docker resolved (no docker-not-found)')
  assert.ok(fs.existsSync(invocationLog), 'fake docker was invoked')
  const invoked = fs.readFileSync(invocationLog, 'utf8')
  assert.ok(invoked.includes('exec') && invoked.includes('pg_dump'), 'fake docker exec pg_dump ran')
})

for (const mode of ['empty', 'fail']) {
  test(`powershell backup fails closed on ${mode} synthetic dump (no publish, rotation skipped)`, { skip: powershellPath ? false : 'powershell not available' }, () => {
    assert.ok(powershellPath)
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `shoreline-ps-${mode}-`))
    const bin = path.join(work, 'bin')
    const backups = path.join(work, 'backups')
    fs.mkdirSync(bin, { recursive: true })
    fs.mkdirSync(backups, { recursive: true })
    const invocationLog = path.join(work, 'docker-invoked.log')
    fs.writeFileSync(path.join(bin, 'docker.cmd'), [
      '@echo off',
      `echo invoked %*>>"${invocationLog}"`,
      'if "%~1"=="exec" goto doexec',
      'if "%~1"=="ps" echo %FAKE_CONTAINER%',
      'exit /b 0',
      ':doexec',
      'if "%FAKE_PGDUMP_MODE%"=="fail" ( echo fake pg_dump failure 1>&2 & exit /b 1 )',
      'if "%FAKE_PGDUMP_MODE%"=="empty" exit /b 0',
      'echo SYNTHETIC-DUMP ok',
      'exit /b 0',
      '',
    ].join('\r\n'))
    const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.enc')
    const result = spawnSync(powershellPath, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(repoRoot, 'scripts', 'backup.ps1'),
      '-BackupDir', backups, '-ContainerName', 'synth-postgres', '-DbUser', 'synthetic', '-DbName', 'synthetic', '-KeyFile', path.join(work, 'backup.key'),
    ], {
      encoding: 'utf8',
      timeout: 120_000,
      env: powershellChildEnv({ PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_CONTAINER: 'synth-postgres', FAKE_PGDUMP_MODE: mode }),
    })
    const output = `${result.stdout}${result.stderr}`
    assert.notEqual(result.status, 0, `expected nonzero exit for ${mode} dump:\n${output}`)
    assert.ok(!output.includes('docker CLI not found'), `${mode}: fake docker resolved (failed at pg_dump, not Get-Command)`)
    assert.ok(output.includes(mode === 'empty' ? 'pg_dump produced empty output' : 'pg_dump exited with code'), `${mode}: actual pg_dump reason asserted:\n${output}`)
    assert.ok(fs.existsSync(invocationLog), `${mode}: fake docker exec was invoked`)
    assert.ok(fs.readFileSync(invocationLog, 'utf8').includes('exec'), `${mode}: invocation marker shows exec ran`)
    assert.deepEqual(listArtifacts(backups, /^shorelineops_backup_.*\.sql\.enc$/), ['shorelineops_backup_20000101_000000.sql.enc'])
    assert.ok(fs.existsSync(seeded), 'rotation skipped: seeded old artifact retained')
    assert.equal(listArtifacts(backups, /\.tmp\./).length, 0, 'no temp files left behind')
  })
}

test('powershell backup requires explicit DbUser/DbName (synthetic, no stale defaults)', { skip: powershellPath ? false : 'powershell not available' }, () => {
  assert.ok(powershellPath)
  for (const args of [[], ['-DbUser', 'synthetic']]) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-ps-missing-'))
    const bin = path.join(work, 'bin')
    const backups = path.join(work, 'backups')
    fs.mkdirSync(bin, { recursive: true })
    fs.mkdirSync(backups, { recursive: true })
    const invocationLog = path.join(work, 'docker-invoked.log')
    fs.writeFileSync(path.join(bin, 'docker.cmd'), [
      '@echo off',
      `echo invoked %*>>"${invocationLog}"`,
      'echo SYNTHETIC-DUMP ok',
      'exit /b 0',
      '',
    ].join('\r\n'))
    const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.enc')
    const result = spawnSync(powershellPath, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(repoRoot, 'scripts', 'backup.ps1'),
      '-BackupDir', backups, '-ContainerName', 'synth-postgres', ...args,
    ], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, INVOCATION_LOG: invocationLog },
    })
    assert.notEqual(result.status, 0, `missing DB identity must fail (args ${JSON.stringify(args)}):\n${result.stdout}\n${result.stderr}`)
    assert.ok(`${result.stdout}${result.stderr}`.includes('is required'), 'failure names the missing required value')
    assert.ok(`${result.stdout}${result.stderr}`.includes('DB_USER') || `${result.stdout}${result.stderr}`.includes('DB_NAME'), 'failure references Compose-required values')
    assert.deepEqual(listArtifacts(backups, /^shorelineops_backup_.*\.sql\.enc$/), ['shorelineops_backup_20000101_000000.sql.enc'])
    assert.ok(fs.existsSync(seeded), 'rotation skipped: seeded old artifact retained')
    assert.equal(listArtifacts(backups, /\.tmp\./).length, 0, 'no temp files left behind')
    assert.equal(fs.existsSync(invocationLog), false, 'docker never executed (rejected before any command)')
  }
})

for (const [param, evil] of [['-DbUser', 'evil"quote'], ['-DbUser', 'evil%PATH%'], ['-DbUser', 'evil&whoami'], ['-DbName', 'evil&whoami'], ['-ContainerName', 'evil;rm']] as const) {
  test(`powershell backup rejects shell metacharacters in ${param} (${JSON.stringify(evil)}) before docker`, { skip: powershellPath ? false : 'powershell not available' }, () => {
    assert.ok(powershellPath)
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-ps-inject-'))
    const bin = path.join(work, 'bin')
    const backups = path.join(work, 'backups')
    fs.mkdirSync(bin, { recursive: true })
    fs.mkdirSync(backups, { recursive: true })
    const invocationLog = path.join(work, 'docker-invoked.log')
    fs.writeFileSync(path.join(bin, 'docker.cmd'), [
      '@echo off',
      `echo invoked %*>>"${invocationLog}"`,
      'echo SYNTHETIC-DUMP ok',
      'exit /b 0',
      '',
    ].join('\r\n'))
    const seeded = seedOldArtifact(backups, 'shorelineops_backup_20000101_000000.sql.enc')
    const baseArgs = ['-BackupDir', backups, '-ContainerName', 'synth-postgres', '-DbUser', 'synthetic', '-DbName', 'synthetic']
    const idx = baseArgs.indexOf(param)
    baseArgs[idx + 1] = evil
    const result = spawnSync(powershellPath, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(repoRoot, 'scripts', 'backup.ps1'),
      ...baseArgs,
    ], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, INVOCATION_LOG: invocationLog },
    })
    assert.notEqual(result.status, 0, `metacharacters must fail (args ${JSON.stringify(baseArgs)}):\n${result.stdout}\n${result.stderr}`)
    assert.ok(`${result.stdout}${result.stderr}`.includes('rejected'), 'failure names the rejection')
    assert.deepEqual(listArtifacts(backups, /^shorelineops_backup_.*\.sql\.enc$/), ['shorelineops_backup_20000101_000000.sql.enc'])
    assert.ok(fs.existsSync(seeded), 'rotation skipped: seeded old artifact retained')
    assert.equal(listArtifacts(backups, /\.tmp\./).length, 0, 'no temp files left behind')
    assert.equal(fs.existsSync(invocationLog), false, 'docker never executed (rejected before any command)')
  })
}
