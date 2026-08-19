#!/usr/bin/env bash
# ==============================================================================
# ShorelineOps Automated Facility Backup Script (Linux / macOS)
# Runs PostgreSQL logical backup with rotation (retains last 30 days)
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/shorelineops_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="${CONTAINER_NAME:-shoreline-postgres}"
DB_USER="${DB_USER:-shoreline}"
DB_NAME="${DB_NAME:-shorelineops}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting ShorelineOps database backup..."

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "${CONTAINER_NAME}"; then
  docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
  pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
fi

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"

# Rotate backups older than 30 days
find "${BACKUP_DIR}" -name "shorelineops_backup_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Backup rotation complete (retained last 30 days)."
