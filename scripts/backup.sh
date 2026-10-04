#!/usr/bin/env bash
# ==============================================================================
# ShorelineOps Automated Facility Backup Script (Linux / macOS)
# Runs PostgreSQL logical backup with rotation (retains last 30 days).
#
# Failure handling: pg_dump output goes to a temporary raw file first and is
# validated BEFORE compression — an empty dump still compresses to a
# non-empty gzip stream, so checking only the .gz size would publish empty
# backups. The final artifact is published only when the dump exit code is 0
# and the raw output is non-empty; rotation runs only after a successful
# publish and can never fail the run. A failure discards temp files, skips
# rotation, and exits nonzero.
#
# DB identity is explicit (no stale defaults): DB_USER/DB_NAME are required
# for the container dump path and must match the deployment's
# Compose-required values (production DB_USER/DB_NAME, local
# POSTGRES_USER/POSTGRES_DB). Missing identity fails fast with no docker
# exec, no artifact published, and rotation skipped. The DATABASE_URL
# fallback (used only when the database container is not running) does not
# require DB_USER/DB_NAME.
#
# Published output is authenticated AES-256-GCM ciphertext. The isolated restore drill
# remains a pending acceptance gate (see
# docs/audits/DEPLOYMENT_IMPLEMENTATION_2026-10-01.md); store artifacts
# accordingly; keys must be kept separately from artifacts.
# ==============================================================================

set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/shorelineops_backup_${TIMESTAMP}.sql.gz.enc"
TMP_RAW=""
TMP_GZ=""
CONTAINER_NAME="${CONTAINER_NAME:-shoreline-postgres}"
DB_USER="${DB_USER:-}"
DB_NAME="${DB_NAME:-}"

cleanup_tmp() {
  [ -z "${TMP_RAW}" ] || rm -f -- "${TMP_RAW}"
  [ -z "${TMP_GZ}" ] || rm -f -- "${TMP_GZ}"
}
trap cleanup_tmp EXIT

# Explicit DB identity for the container dump path (no stale defaults).
# When neither container identity nor a DATABASE_URL fallback is available,
# fail fast before any docker or filesystem work. When DATABASE_URL is set,
# defer the identity check to the container branch below so the fallback
# path can run without DB_USER/DB_NAME.
if [ -z "${DB_USER}" ] || [ -z "${DB_NAME}" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    if [ -z "${DB_USER}" ]; then
      echo "[$(date)] Backup FAILED (DB_USER is required: export explicit DB identity matching Compose-required DB_USER / POSTGRES_USER; no defaults). Temp output discarded; rotation skipped; no artifact published." >&2
    else
      echo "[$(date)] Backup FAILED (DB_NAME is required: export explicit DB identity matching Compose-required DB_NAME / POSTGRES_DB; no defaults). Temp output discarded; rotation skipped; no artifact published." >&2
    fi
    exit 1
  fi
fi

CRYPTO_TOOL="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/backup-tool.mjs"
: "${BACKUP_KEY_FILE:?BACKUP_KEY_FILE must reference a separate restricted key file.}"
node "${CRYPTO_TOOL}" check --key-file "${BACKUP_KEY_FILE}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
TMP_RAW=$(mktemp "${BACKUP_FILE}.tmp.XXXXXX.raw")
TMP_GZ=$(mktemp "${BACKUP_FILE}.tmp.XXXXXX.gz")

echo "[$(date)] Starting ShorelineOps database backup..."

# No -t/--tty flag on docker exec: a pseudo-TTY mangles piped output and
# fails without a console; pg_dump streams to stdout and needs no terminal.
dump_status=1
set +e
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER_NAME}"; then
  # Container path requires explicit identity even when DATABASE_URL is also
  # set (container takes precedence). Fail before docker exec: no dump, no
  # publish, rotation skipped.
  if [ -z "${DB_USER}" ]; then
    echo "[$(date)] Backup FAILED (DB_USER is required for the container dump path: export explicit DB identity matching Compose-required DB_USER / POSTGRES_USER; no defaults). Temp output discarded; rotation skipped; no artifact published." >&2
    exit 1
  fi
  if [ -z "${DB_NAME}" ]; then
    echo "[$(date)] Backup FAILED (DB_NAME is required for the container dump path: export explicit DB identity matching Compose-required DB_NAME / POSTGRES_DB; no defaults). Temp output discarded; rotation skipped; no artifact published." >&2
    exit 1
  fi
  docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${TMP_RAW}"
  dump_status=$?
else
  : "${DATABASE_URL:?DATABASE_URL must be set when the '${CONTAINER_NAME}' container is not running.}"
  pg_dump "${DATABASE_URL}" > "${TMP_RAW}"
  dump_status=$?
fi
set -e

if [ "${dump_status}" -ne 0 ]; then
  echo "[$(date)] Backup FAILED (pg_dump exit ${dump_status}). Temp output discarded; rotation skipped; no artifact published." >&2
  exit 1
fi

# Validate the UNCOMPRESSED dump: gzip output is never empty even for empty
# input, so this check must run before compression.
if [ ! -s "${TMP_RAW}" ]; then
  echo "[$(date)] Backup FAILED (empty dump output). Temp output discarded; rotation skipped; no artifact published." >&2
  exit 1
fi

if ! gzip -c "${TMP_RAW}" > "${TMP_GZ}"; then
  echo "[$(date)] Backup FAILED (gzip error). Temp output discarded; rotation skipped; no artifact published." >&2
  exit 1
fi

if [ ! -s "${TMP_GZ}" ]; then
  echo "[$(date)] Backup FAILED (empty compressed output). Temp output discarded; rotation skipped; no artifact published." >&2
  exit 1
fi

chmod 600 "${TMP_GZ}"
node "${CRYPTO_TOOL}" encrypt --key-file "${BACKUP_KEY_FILE}" "${TMP_GZ}" "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"
trap - EXIT
rm -f "${TMP_RAW}" "${TMP_GZ}"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"

# Rotate backups older than 30 days (only after a successful publish).
# Housekeeping must never fail a completed backup: resolve to an absolute
# path, refuse unsafe roots, and treat rotation errors as warnings.
BACKUP_DIR_ABS="$(cd "${BACKUP_DIR}" && pwd)"
if [ -z "${BACKUP_DIR_ABS}" ] || [ "${BACKUP_DIR_ABS}" = "/" ]; then
  echo "[$(date)] Backup rotation skipped: refusing to prune in '${BACKUP_DIR_ABS}'." >&2
elif ! find "${BACKUP_DIR_ABS}" -maxdepth 1 -type f -name "shorelineops_backup_*.sql.gz.enc" -mtime +30 -delete; then
  echo "[$(date)] Backup rotation warning: pruning old backups failed (non-fatal; published artifact kept)." >&2
else
  echo "[$(date)] Backup rotation complete (retained last 30 days)."
fi
