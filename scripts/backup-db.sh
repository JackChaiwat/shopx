#!/bin/bash
# Database backup script - run via cron: 0 2 * * * /opt/shopx/scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="/opt/backups/shopx"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/shopx_${DATE}.sql.gz"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Load env
if [ -f /opt/shopx/.env ]; then
  export $(grep -v '^#' /opt/shopx/.env | xargs)
fi

# Dump and compress
docker exec ecommerce-postgres pg_dump \
  -U "${POSTGRES_USER:-ecommerce_user}" \
  -d "${POSTGRES_DB:-ecommerce}" \
  --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup saved: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Cleanup old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"

echo "[$(date)] Backup complete"
