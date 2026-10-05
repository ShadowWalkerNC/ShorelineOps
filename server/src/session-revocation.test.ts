import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as OTPAuth from 'otpauth'

const directory = mkdtempSync(path.join(tmpdir(), 'shoreline-revocation-'))
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(directory, 'sessions.db')
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')

void test('persisted access sessions revoke immediately and refresh rotates atomically', async t => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { requireAuth, verifyAccessToken } = await import('./middleware/requireAuth')
  const { requireCapability } = await import('./middleware/permissions')
  const { authRouter } = await import('./routes/auth')
  const { adminRouter } = await import('./routes/admin')
  const { errorHandler } = await import('./middleware/errorHandler')
  const { issueTestAccessToken } = await import('./test-support/accessToken')
  await runMigrations()
  await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
  const password = 'Synthetic-Only-Password-42!'
  const passwordHash = await bcrypt.hash(password, 4)
  const createUser = async (role = 'admin', platformAdmin = false) => {
    const id = crypto.randomUUID()
    const email = `${id}@example.invalid`
    await pool.query('INSERT INTO users (id,name,email,password,role,active,platform_admin) VALUES ($1,$2,$3,$4,$5,true,$6)',
      [id, 'Synthetic user', email, passwordHash, role, platformAdmin])
    return {id,email}
  }
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api/admin', requireAuth, adminRouter)
  app.get('/protected', requireAuth, (_req,res) => res.json({ok:true}))
  app.post('/clinical-write', requireAuth, requireCapability('residents.write'), (_req,res) => res.status(204).send())
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`
  const request = (url:string, token?:string, body?:object, method = body ? 'POST' : 'GET') => fetch(base+url, {
    method, headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}),
  })
  const login = async (email:string, suppliedPassword = password) => {
    const response = await request('/api/auth/login', undefined, {email,password:suppliedPassword})
    assert.equal(response.status,200)
    return response.json() as Promise<any>
  }
  const owner = await createUser('admin',true)
  const ownerSession = await login(owner.email)
  const patchUser = (id:string, data:object) => request(`/api/admin/users/${id}`, ownerSession.accessToken, data, 'PATCH')
  const isRevoked = async (session:any) => {
    assert.equal((await request('/protected',session.accessToken)).status,401)
    assert.equal((await request('/api/auth/refresh',undefined,{refreshToken:session.refreshToken})).status,401)
  }
  try {
    await t.test('active persisted session is allowed; legacy access is rejected', async () => {
      const user = await createUser()
      const session = await login(user.email)
      const claims = verifyAccessToken(session.accessToken)
      assert.equal(typeof claims.sessionId,'string')
      assert.equal(claims.authVersion,0)
      assert.equal((await request('/protected',session.accessToken)).status,200)
      assert.equal((await request('/clinical-write',session.accessToken,{})).status,204)
      const legacy = jwt.sign({sub:user.id,role:'admin',mfa:false,purpose:'access',facilityId:'default',platformAdmin:false},
        process.env.JWT_SECRET!,{algorithm:'HS256',audience:'shoreline-api',expiresIn:'15m'})
      assert.equal((await request('/protected',legacy)).status,401)
    })
    await t.test('disable and delete reject already-issued credentials', async () => {
      const user = await createUser()
      const session = await login(user.email)
      assert.equal((await patchUser(user.id,{active:false})).status,200)
      await isRevoked(session)
      const deleted = await createUser()
      // No login audit references: retained audit history intentionally prevents physical deletion.
      const deletedToken = await issueTestAccessToken({sub:deleted.id,role:'admin'})
      assert.equal((await request('/protected',deletedToken)).status,200)
      await pool.query('DELETE FROM users WHERE id = $1',[deleted.id])
      assert.equal((await request('/protected',deletedToken)).status,401)
      const {rows: remaining} = await pool.query('SELECT id FROM refresh_tokens WHERE user_id = $1',[deleted.id])
      assert.equal(remaining.length,0)
    })
    await t.test('role downgrade revokes old claims and new login cannot write', async () => {
      const user = await createUser()
      const session = await login(user.email)
      assert.equal((await patchUser(user.id,{role:'readonly'})).status,200)
      await isRevoked(session)
      const newSession = await login(user.email)
      assert.equal((await request('/protected',newSession.accessToken)).status,200)
      assert.equal((await request('/clinical-write',newSession.accessToken,{})).status,403)
    })
    await t.test('facility and platform reassignment revoke privileges; name-only edits preserve session', async () => {
      for (const fields of [{facilityId:'synthetic-other-facility'}, {platformAdmin:true}]) {
        const user = await createUser()
        const session = await login(user.email)
        assert.equal((await patchUser(user.id,fields)).status,200)
        await isRevoked(session)
      }
      const user = await createUser()
      const session = await login(user.email)
      assert.equal((await patchUser(user.id,{name:'Renamed synthetic user'})).status,200)
      assert.equal((await request('/protected',session.accessToken)).status,200)
      assert.equal(verifyAccessToken(session.accessToken).authVersion,0)
    })
    await t.test('password reset atomically revokes every session and permits only new password', async () => {
      const user = await createUser()
      const first = await login(user.email)
      const second = await login(user.email)
      const nextPassword = 'New-Synthetic-Only-Password-73!'
      assert.equal((await patchUser(user.id,{password:nextPassword})).status,200)
      await isRevoked(first)
      await isRevoked(second)
      assert.equal((await request('/api/auth/login',undefined,{email:user.email,password})).status,401)
      assert.equal(verifyAccessToken((await login(user.email,nextPassword)).accessToken).authVersion,1)
    })
    await t.test('logout revokes access immediately; rotated session id stays stable', async () => {
      const user = await createUser()
      const original = await login(user.email)
      const response = await request('/api/auth/refresh',undefined,{refreshToken:original.refreshToken})
      assert.equal(response.status,200)
      const rotated = await response.json() as any
      assert.equal(verifyAccessToken(rotated.accessToken).sessionId,verifyAccessToken(original.accessToken).sessionId)
      assert.equal((await request('/protected',original.accessToken)).status,200)
      // A concurrent rotation cannot evade logout when the caller supplies its bound access token.
      assert.equal((await request('/api/auth/logout',original.accessToken,{refreshToken:original.refreshToken})).status,204)
      await isRevoked(rotated)
      assert.equal((await request('/protected',original.accessToken)).status,401)
    })
    await t.test('same refresh raced concurrently has exactly one winner', async () => {
      const user = await createUser()
      const session = await login(user.email)
      const responses = await Promise.all(Array.from({length:4}, () => request('/api/auth/refresh',undefined,{refreshToken:session.refreshToken})))
      assert.deepEqual(responses.map(response => response.status).sort(),[200,401,401,401])
      const winner = await responses.find(response => response.status === 200)!.json() as any
      assert.equal((await request('/protected',winner.accessToken)).status,200)
      assert.equal(verifyAccessToken(winner.accessToken).sessionId,verifyAccessToken(session.accessToken).sessionId)
      const {rows} = await pool.query('SELECT id FROM refresh_tokens WHERE user_id = $1',[user.id])
      assert.equal(rows.length,1)
    })
    await t.test('unexpired session cannot bypass current DB identity even without explicit version increment', async () => {
      for (const change of ['role','facility_id','platform_admin']) {
        const user = await createUser()
        const session = await login(user.email)
        const next = change === 'role' ? 'readonly' : change === 'facility_id' ? 'other' : true
        await pool.query(`UPDATE users SET ${change} = $1 WHERE id = $2`,[next,user.id])
        assert.equal((await request('/protected',session.accessToken)).status,401)
      }
    })
    await t.test('auth DB outage and unavailable MFA policy fail closed', async () => {
      const user = await createUser()
      const session = await login(user.email)
      const original = pool.query
      try {
        pool.query = async () => {throw new Error('synthetic auth outage')}
        assert.equal((await request('/protected',session.accessToken)).status,503)
        assert.equal((await request('/protected')).status,401)
        pool.query = async (sql,params) => {
          if (sql.includes('SELECT mfa_required')) throw new Error('synthetic policy outage')
          return original.call(pool,sql,params)
        }
        assert.equal((await request('/api/auth/login',undefined,{email:user.email,password})).status,503)
        assert.equal((await request('/api/auth/refresh',undefined,{refreshToken:session.refreshToken})).status,503)
      } finally {pool.query=original}
    })
    await t.test('MFA challenge issued before password reset or downgrade cannot finish login/enrollment', async () => {
      const enrolled = await createUser()
      const secret = new OTPAuth.Secret({size:20}).base32
      await pool.query('UPDATE users SET mfa_enabled = true, mfa_secret = $1 WHERE id = $2',[secret,enrolled.id])
      const challenge = await login(enrolled.email)
      assert.equal(challenge.mfaRequired,true)
      assert.equal((await patchUser(enrolled.id,{password:'Reset-Synthetic-MFA-Password!'})).status,200)
      const code = new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(secret)}).generate()
      assert.equal((await request('/api/auth/mfa/verify',undefined,{mfaToken:challenge.mfaToken,code})).status,401)
      const pending = await createUser()
      await pool.query('UPDATE system_settings SET mfa_required = true WHERE id = 1')
      const enrollment = await login(pending.email)
      assert.equal(enrollment.mfaEnrollmentRequired,true)
      assert.equal((await patchUser(pending.id,{role:'readonly'})).status,200)
      assert.equal((await request('/api/auth/mfa/setup/begin',undefined,{mfaToken:enrollment.mfaToken})).status,401)
      await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
    })
    await t.test('logged-out access cannot begin MFA enrollment via the direct-token path', async () => {
      const user = await createUser()
      const session = await login(user.email)
      assert.equal((await request('/api/auth/logout',undefined,{refreshToken:session.refreshToken})).status,204)
      assert.equal((await request('/api/auth/mfa/setup/begin',session.accessToken,{})).status,401)
    })
    await t.test('audit failure rolls back security changes and session deletion', async () => {
      const user = await createUser()
      const session = await login(user.email)
      const originalConnect = pool.connect
      try {
        pool.connect = async () => {
          const client = await originalConnect.call(pool)
          const originalQuery = client.query.bind(client)
          client.query = (sql:string,params:any[]) => {
            if (sql.includes("VALUES ('UPDATE_USER'")) throw new Error('synthetic audit outage')
            return originalQuery(sql,params)
          }
          return client
        }
        assert.equal((await patchUser(user.id,{active:false})).status,500)
      } finally {pool.connect=originalConnect}
      assert.equal((await request('/protected',session.accessToken)).status,200)
      const {rows} = await pool.query('SELECT active, auth_version FROM users WHERE id = $1',[user.id])
      assert.equal(!!rows[0].active,true)
      assert.equal(Number(rows[0].auth_version),0)
    })
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    await pool.end()
    rmSync(directory,{recursive:true,force:true})
  }
})
