// Audit-only harness: disposable SQLite, no inherited service credentials.
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const cwd = mkdtempSync(path.join(tmpdir(), 'shoreline-audit-runtime-'));
const secret = crypto.randomBytes(32).toString('hex');
const port = 13971;
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
  NODE_ENV: 'test', PORT: String(port), DATABASE_URL: '', SQLITE_PATH: path.join(cwd, 'audit.db'), JWT_SECRET: secret };
const child = spawn(process.execPath, [path.join(root, 'server/dist/index.js')], { cwd, env, windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch(`http://127.0.0.1:${port}/health`); if (r.ok) { ready = true; break; } } catch {}
      await pause(200);
    }
    if (!ready) throw new Error('Isolated server health unavailable within 10 seconds');
    for (const url of ['/health', '/api/setup/status', '/api/residents']) {
      const response = await fetch(`http://127.0.0.1:${port}${url}`);
      console.log(JSON.stringify({check:'isolated-http-smoke', path:url, status:response.status}));
    }
    // Direct middleware contract probe: no actual resident records or account needed.
    process.env.JWT_SECRET = secret;
    const jwt = require(path.join(root, 'node_modules/jsonwebtoken'));
    const { requireAuth } = require(path.join(root, 'server/dist/middleware/requireAuth.js'));
    const token = jwt.sign({sub:'synthetic-audit-user',purpose:'mfa_verify'},secret,{expiresIn:'1m'});
    let accepted = false, status = null;
    const req = {headers:{authorization:`Bearer ${token}`}};
    const res = {status(n){status=n;return this;},json(){return this;}};
    requireAuth(req,res,()=>{accepted=true;});
    console.log(JSON.stringify({check:'pending-purpose-token-middleware',accepted,status,expected:'reject; pending token must never be an access token'}));
  } finally {
    child.kill();
    console.log('Isolated child stopped; disposable synthetic database retained in OS temporary directory.');
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
