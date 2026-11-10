#!/usr/bin/env bash
# ==============================================================================
# Shehata Drive - Automated Backup Script (Files + Database + Audit Trail)
# Run manually or via cron: 0 2 * * * /path/to/scripts/backup.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${PROJECT_DIR}/backups/${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "[1/4] Enabling Nextcloud Maintenance Mode..."
docker compose exec -T -u www-data nextcloud php occ maintenance:mode --on || true

echo "[2/4] Backing up PostgreSQL Database (including Activity & File Version metadata)..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-nextcloud}" "${POSTGRES_DB:-nextcloud}" | gzip > "${BACKUP_DIR}/nextcloud_db.sql.gz"

echo "[3/4] Backing up Audit Logs & Forensics Database..."
docker compose cp nextcloud:/var/log/nextcloud/audit.log "${BACKUP_DIR}/audit.log" || true
docker compose cp audit-dashboard:/data/audit_events.db "${BACKUP_DIR}/audit_events.db" || true

echo "[4/4] Disabling Nextcloud Maintenance Mode..."
docker compose exec -T -u www-data nextcloud php occ maintenance:mode --off || true

echo "Backup saved to: ${BACKUP_DIR}"
