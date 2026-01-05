#!/bin/bash
#
# SQLite Database Backup Script for DimeTime
#
# Creates a safe, atomic backup of the SQLite database using a temporary
# Alpine container with sqlite3 (since the app container is distroless).
#
# Usage:
#   ./scripts/backup-db.sh [backup_dir]
#
# Arguments:
#   backup_dir  - Directory to store backups (default: ./backups)
#
# Examples:
#   ./scripts/backup-db.sh              # Backup to ./backups/
#   ./scripts/backup-db.sh /mnt/backup  # Backup to /mnt/backup/
#

set -e

VOLUME_NAME="dimetime_dimetime-data"
DB_PATH="/data/sqlite.db"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILENAME="dimetime-${TIMESTAMP}.db"

echo "DimeTime Database Backup"
echo "========================"
echo ""

# Check if volume exists
if ! docker volume ls --format '{{.Name}}' | grep -q "^${VOLUME_NAME}$"; then
    echo "Error: Volume '${VOLUME_NAME}' not found."
    echo "Check available volumes with: docker volume ls"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Convert to absolute path for Docker mount
BACKUP_DIR_ABS=$(cd "${BACKUP_DIR}" && pwd)

echo "Volume:     ${VOLUME_NAME}"
echo "Database:   ${DB_PATH}"
echo "Backup dir: ${BACKUP_DIR_ABS}"
echo ""

# Run backup using temporary Alpine container with sqlite3
echo "Creating backup using temporary Alpine container..."
docker run --rm \
  -v "${VOLUME_NAME}:/data:ro" \
  -v "${BACKUP_DIR_ABS}:/backups" \
  alpine:latest \
  sh -c "apk add --no-cache sqlite >/dev/null 2>&1 && sqlite3 /data/sqlite.db '.backup /backups/${BACKUP_FILENAME}'"

# Show result
BACKUP_PATH="${BACKUP_DIR_ABS}/${BACKUP_FILENAME}"
BACKUP_SIZE=$(ls -lh "${BACKUP_PATH}" | awk '{print $5}')

echo ""
echo "Backup complete!"
echo "  File: ${BACKUP_PATH}"
echo "  Size: ${BACKUP_SIZE}"
