#!/bin/bash

# Encryption Deployment Script
# This script backs up the database, runs migrations, and encrypts existing data

set -e  # Exit on any error

echo "===================================================================="
echo "ENCRYPTION DEPLOYMENT - Automated Setup"
echo "===================================================================="
echo ""
echo "This script will:"
echo "1. Create a database backup"
echo "2. Run Phase 1 migration (add encrypted columns)"
echo "3. Encrypt all existing data"
echo "4. Verify encryption worked"
echo ""
echo "Prerequisites:"
echo "- Railway CLI installed (npm install -g @railway/cli)"
echo "- Logged into Railway (railway login)"
echo "- ENCRYPTION_KEY set in Railway environment variables"
echo ""
read -p "Press ENTER to continue or CTRL+C to cancel..."

# Step 1: Create database backup
echo ""
echo "===================================================================="
echo "STEP 1: Creating Database Backup"
echo "===================================================================="
echo ""

BACKUP_FILE="backup_before_encryption_$(date +%Y%m%d_%H%M%S).sql"
echo "Backing up database to: $BACKUP_FILE"

railway run pg_dump \$DATABASE_URL > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup created successfully: $SIZE"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Step 2: Run Phase 1 migration
echo ""
echo "===================================================================="
echo "STEP 2: Running Phase 1 Migration (Add Encrypted Columns)"
echo "===================================================================="
echo ""

railway run alembic upgrade head

echo "✓ Migration completed"

# Step 3: Encrypt existing data
echo ""
echo "===================================================================="
echo "STEP 3: Encrypting Existing Data"
echo "===================================================================="
echo ""

railway run python scripts/encrypt_existing_data.py --verbose

echo "✓ Data encryption completed"

# Step 4: Verify encryption
echo ""
echo "===================================================================="
echo "STEP 4: Verifying Encryption"
echo "===================================================================="
echo ""

echo "Checking for encrypted data in database..."
railway run psql \$DATABASE_URL -c "SELECT id, LEFT(email, 10) as email_preview, LEFT(email_encrypted, 20) as encrypted_preview FROM users LIMIT 3;"

echo ""
echo "===================================================================="
echo "✓ ENCRYPTION DEPLOYMENT COMPLETE!"
echo "===================================================================="
echo ""
echo "Next steps:"
echo "1. Test your application: https://sam.alontechnologies.com"
echo "2. Verify login/signup works"
echo "3. Check that tasks and chat load correctly"
echo ""
echo "Backup saved to: $BACKUP_FILE"
echo "Keep this backup in a safe place!"
echo ""
