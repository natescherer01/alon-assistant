#!/bin/bash

##############################################################################
# PostgreSQL Database Backup Script
#
# This script creates a backup of the PostgreSQL database using pg_dump.
# Backups are stored with timestamps for easy identification.
#
# Usage:
#   ./backup-db.sh [backup-directory]
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#
# Example:
#   DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./backup-db.sh
##############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="calendar_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
  echo "Usage: DATABASE_URL='postgresql://...' $0 [backup-directory]"
  exit 1
fi

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Starting database backup...${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Backup file: $BACKUP_PATH"

# Perform backup
export PGPASSWORD="$DB_PASS"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --clean \
  --if-exists \
  --verbose \
  --file="$BACKUP_PATH"

# Compress backup
echo -e "${YELLOW}Compressing backup...${NC}"
gzip "$BACKUP_PATH"
COMPRESSED_PATH="${BACKUP_PATH}.gz"

# Get file size
FILE_SIZE=$(ls -lh "$COMPRESSED_PATH" | awk '{print $5}')

echo -e "${GREEN}Backup completed successfully!${NC}"
echo "Backup file: $COMPRESSED_PATH"
echo "File size: $FILE_SIZE"

# Clean up old backups (keep last 7 days)
echo -e "${YELLOW}Cleaning up old backups (keeping last 7 days)...${NC}"
find "$BACKUP_DIR" -name "calendar_backup_*.sql.gz" -type f -mtime +7 -delete

# List recent backups
echo -e "${GREEN}Recent backups:${NC}"
ls -lht "$BACKUP_DIR"/calendar_backup_*.sql.gz | head -5

echo -e "${GREEN}Done!${NC}"
