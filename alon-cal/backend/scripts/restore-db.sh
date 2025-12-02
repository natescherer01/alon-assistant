#!/bin/bash

##############################################################################
# PostgreSQL Database Restore Script
#
# This script restores a PostgreSQL database from a backup file.
#
# Usage:
#   ./restore-db.sh <backup-file>
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#
# Example:
#   DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./restore-db.sh backups/backup.sql.gz
##############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -eq 0 ]; then
  echo -e "${RED}Error: No backup file specified${NC}"
  echo "Usage: $0 <backup-file>"
  echo "Example: $0 backups/calendar_backup_20240101_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
  echo "Usage: DATABASE_URL='postgresql://...' $0 <backup-file>"
  exit 1
fi

# Parse DATABASE_URL
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${RED}WARNING: This will replace all data in the database!${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Decompress if needed
TEMP_FILE=""
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo -e "${YELLOW}Decompressing backup file...${NC}"
  TEMP_FILE="/tmp/restore_$(date +%s).sql"
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  SQL_FILE="$TEMP_FILE"
else
  SQL_FILE="$BACKUP_FILE"
fi

# Perform restore
echo -e "${YELLOW}Restoring database...${NC}"
export PGPASSWORD="$DB_PASS"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --quiet \
  --file="$SQL_FILE"

# Clean up temporary file
if [ -n "$TEMP_FILE" ]; then
  rm -f "$TEMP_FILE"
fi

echo -e "${GREEN}Database restored successfully!${NC}"
echo "Database: $DB_NAME"
echo "From backup: $BACKUP_FILE"

# Run migrations to ensure schema is up to date
echo -e "${YELLOW}Running migrations...${NC}"
npm run prisma:migrate:prod

echo -e "${GREEN}Done!${NC}"
