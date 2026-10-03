# Deployment Remediation Implementation — 2026-10-01

Follow-up to the production readiness audits in this directory. Scope: database
TLS policy, container/orchestrator manifests, backup scripts, and the
`deployment-config` regression suite. Security middleware, routes, EHR, and
admin surfaces are owned by other workstreams and untouched here.

## What changed

- `server/src/db/pool.ts` — single-authority PostgreSQL TLS resolver:
  - Remote hosts verify certificates by default; plaintext
    (`sslmode=disable` / `ssl=0`) is accepted only for loopback,
    private-network, socket, `.local`/`.internal`, or single-label
    (Compose-service) hosts, classified against the *effective* host
    (single `?host=` override honored; duplicate `?host=` values fail fast —
    pg would silently apply the last, but a blank last value falls back to
    the URL hostname, so silent last-wins would misclassify).
  - IPv6 scope validated with `net.isIP` plus bitmask checks
    (loopback, `fe80::/10`, `fc00::/7`, mapped-V4); no string-prefix matching.
  - Every TLS query parameter pg understands (`sslmode`, `ssl`, `sslcert`,
    `sslkey`, `sslrootcert`, `uselibpqcompat`, `sslnegotiation`) is resolved
    or rejected before the driver sees it, because installed pg
    `ConnectionParameters` overwrites an explicit `ssl` object from the URL.
    Certificate files are read into the `ssl` object; `sslnegotiation` is
    validated and passed through; duplicates, contradictions, unknown values,
    and unparseable URLs fail fast with actionable errors.
  - `DATABASE_SSL_REJECT_UNAUTHORIZED=false` remains the explicit escape hatch
    for managed providers with untrusted chains; it never overrides
    `verify-ca`/`verify-full` or re-enables TLS over plaintext.
- Compose files — external required secrets (`:?...`, no soft defaults, no
  usable default credentials), `$$`-scoped container healthchecks, readiness
  (`/ready`) probes, private production database; production `reverse-proxy`
  is now opt-in (`--profile proxy`), HTTP-only (no `:443` mapping), proxies
  all traffic to the unified api, and mounts `nginx.conf` as a `conf.d`
  snippet instead of replacing the main config.
- `Dockerfile`, `server/Dockerfile`, `railway.json`, `render.yaml` — all
  orchestrator probes target readiness (`/ready`); `/health` is liveness only.
- `scripts/backup.sh` / `scripts/backup.ps1` — temp-file-first flow: publish
  only on exit-0 plus validated output (bash validates the *uncompressed*
  dump before gzip, since empty input still yields non-empty gzip),
  restricted permissions (bash: `umask 077` + `chmod 600`; PS:
  pre-restricted temp, SID-based ACLs, byte-faithful `ProcessStartInfo` +
  `BaseStream.CopyTo` with no `cmd.exe` and no string-built command line
  instead of UTF-16-mangling `>`), explicit DB identity with no stale
  defaults (bash: `DB_USER`/`DB_NAME` required for the container dump path,
  `DATABASE_URL` fallback runs without them; PS: `-DbUser`/`-DbName`
  required with shell-metacharacter allowlisting), no pseudo-TTY flags,
  absolute-path rotation that runs only after a successful publish and can
  never fail the run.
- `server/src/deployment-config.test.ts` — 42 isolated tests: TLS policy,
  effective-host overrides with fail-fast duplicate `?host=`, installed-pg
  `ConnectionParameters` behavior with synthetic credentials (never
  connected), structural js-yaml manifest checks, external-DB override docs
  (`--no-deps`, base-file interpolation), actual `HEALTHCHECK` instructions
  (not comments), explicit DB identity (bash + powershell, no stale
  defaults), and synthetic backup success/failure/missing-identity runs
  (fake docker shims, no DB/Docker; missing identity proves no docker
  execution, no publish, rotation skipped).
- `.dockerignore` / `.gitignore` — backup artifacts (`backups/`,
  `shorelineops_backup_*`, `*.sql.gz`, `*.sql.dump`) excluded from images
  and version control (may contain PHI).

## Acceptance status: encrypted backups and restore drill (PENDING)

Backup output is currently a **plaintext** dump. Encryption at rest and an
isolated restore drill (restore into a scratch database, verify integrity,
document steps) are accepted as a **pending gate**: do not store artifacts as
if encrypted, and do not claim restore readiness until that drill is executed
and recorded here.

## Not covered / untested (do not claim otherwise)

- TLS termination in the Compose `reverse-proxy` (HTTP-only by design).
- The `DATABASE_URL` fallback path in `backup.sh` (used only when the
  database container is not running) — exercised paths are the docker-exec
  flow; the shared validate/compress/publish/rotate code is identical.
- Managed-provider certificate chains (Railway/Render): default is verified
  TLS; use the documented escape hatch only when verification provably fails.

## Runtime gates (must hold in every environment)

- `JWT_SECRET` (32+ random chars), `SHORELINE_FACILITY_ID`, and database
  credentials are required; manifests fail fast when unset.
- Remote `DATABASE_URL` values verify TLS by default; local plaintext
  requires an explicit `?sslmode=disable` (or `?ssl=0`) on a local host.
- Orchestrators (Compose, Docker HEALTHCHECK, Railway, Render) must probe
  `/ready`, never `/health`, before sending traffic.
