#!/usr/bin/env python3
"""
Safely migrate PostgreSQL database to new instance in Railway
This script prompts for credentials securely - no hardcoded passwords
"""
import subprocess
import sys
import os
import getpass
from datetime import datetime
import psycopg2

# Ensure PostgreSQL 17 tools are in PATH
os.environ['PATH'] = '/opt/homebrew/opt/postgresql@17/bin:' + os.environ.get('PATH', '')

def get_database_url(prompt_text):
    """Securely prompt for database URL"""
    print(f"\n{prompt_text}")
    print("Format: postgresql://postgres:PASSWORD@host:port/railway")
    print("(Paste from Railway Variables tab)")
    return input("Database URL: ").strip()

def run_command(cmd, description):
    """Run a shell command and handle errors"""
    print(f"\n{'='*60}")
    print(f"🔄 {description}")
    print(f"{'='*60}")

    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False

    print(result.stdout)
    print(f"✅ {description} - DONE")
    return True

def verify_connection(db_url, label):
    """Verify database connection works"""
    try:
        conn = psycopg2.connect(db_url)
        conn.close()
        print(f"✅ {label} connection successful")
        return True
    except Exception as e:
        print(f"❌ {label} connection failed: {e}")
        return False

def get_record_counts(db_url):
    """Get counts of records in database"""
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM users;")
    users = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM tasks;")
    tasks = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM chat_history;")
    chats = cur.fetchone()[0]

    cur.close()
    conn.close()

    return users, tasks, chats

def main():
    """Main migration process"""

    print("\n" + "="*60)
    print("DATABASE MIGRATION - PRODUCTION")
    print("="*60)
    print("\n⚠️  This script will:")
    print("   1. Prompt you for OLD database URL (current one)")
    print("   2. Prompt you for NEW database URL (from new Railway PostgreSQL)")
    print("   3. Create a backup of your current database")
    print("   4. Migrate all data to the new database")
    print("   5. Verify data integrity")
    print("\n⚠️  Prerequisites:")
    print("   ✅ PostgreSQL tools installed (pg_dump, psql)")
    print("   ✅ Created NEW PostgreSQL database in Railway")
    print("   ✅ Have DATABASE_URL from BOTH databases ready")

    response = input("\n✅ Ready to proceed? (yes/no): ")
    if response.lower() != "yes":
        print("❌ Aborted.")
        sys.exit(0)

    # Get OLD database URL
    print("\n" + "="*60)
    print("STEP 1: OLD Database (Current)")
    print("="*60)
    old_db_url = get_database_url("Enter OLD database URL (current production database):")

    if not verify_connection(old_db_url, "OLD database"):
        sys.exit(1)

    # Get NEW database URL
    print("\n" + "="*60)
    print("STEP 2: NEW Database (Fresh credentials)")
    print("="*60)
    new_db_url = get_database_url("Enter NEW database URL (new PostgreSQL from Railway):")

    if not verify_connection(new_db_url, "NEW database"):
        sys.exit(1)

    # Show current data
    print("\n" + "="*60)
    print("STEP 3: Verify Current Data")
    print("="*60)

    old_users, old_tasks, old_chats = get_record_counts(old_db_url)

    print(f"\n📊 Current Database Contents:")
    print(f"   Users:        {old_users}")
    print(f"   Tasks:        {old_tasks}")
    print(f"   Chat History: {old_chats}")

    confirm = input(f"\n✅ Proceed with migrating this data? (yes/no): ")
    if confirm.lower() != "yes":
        print("❌ Aborted.")
        sys.exit(0)

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_file = f"backup_production_{timestamp}.sql"

    # Step 4: Create backup
    print("\n" + "="*60)
    print("STEP 4: Creating Backup")
    print("="*60)

    if not run_command(
        f"pg_dump '{old_db_url}' > {backup_file}",
        "Creating backup of current database"
    ):
        sys.exit(1)

    print(f"\n💾 Backup saved to: {backup_file}")
    print(f"   Size: {subprocess.check_output(['du', '-h', backup_file]).decode().split()[0]}")

    # Step 5: Restore to new database
    print("\n" + "="*60)
    print("STEP 5: Restoring to New Database")
    print("="*60)

    if not run_command(
        f"psql '{new_db_url}' < {backup_file}",
        "Restoring data to new database"
    ):
        print("⚠️  Note: Some warnings are normal (e.g., role already exists)")

    # Step 6: Verify data
    print("\n" + "="*60)
    print("STEP 6: Verifying Data Integrity")
    print("="*60)

    new_users, new_tasks, new_chats = get_record_counts(new_db_url)

    # Compare
    print(f"\n📊 Data Comparison:")
    print(f"   Users:        Old: {old_users:4d}  →  New: {new_users:4d}  {'✅' if old_users == new_users else '❌'}")
    print(f"   Tasks:        Old: {old_tasks:4d}  →  New: {new_tasks:4d}  {'✅' if old_tasks == new_tasks else '❌'}")
    print(f"   Chat History: Old: {old_chats:4d}  →  New: {new_chats:4d}  {'✅' if old_chats == new_chats else '❌'}")

    if old_users == new_users and old_tasks == new_tasks and old_chats == new_chats:
        print("\n" + "="*60)
        print("✅ MIGRATION SUCCESSFUL!")
        print("="*60)
        print("\n📋 Next Steps:")
        print("\n1. Update Railway Backend Service:")
        print("   - Go to Railway dashboard")
        print("   - Click on your BACKEND service (not database)")
        print("   - Go to 'Variables' tab")
        print("   - Update DATABASE_URL to the NEW database URL")
        print("   - Railway will auto-redeploy")
        print("\n2. Wait for deployment (1-2 minutes)")
        print("\n3. Test your app:")
        print("   - Go to https://sam.alontechnologies.com")
        print("   - Try logging in")
        print("   - Check that all tasks are visible")
        print("\n4. Once verified working:")
        print("   - Delete the OLD PostgreSQL service in Railway")
        print("   - Keep the backup file safe for 30 days")
        print(f"\n💾 Backup file: {backup_file}")
        print("   Store this somewhere safe (external drive, cloud storage)")
    else:
        print("\n" + "="*60)
        print("❌ WARNING: Data counts don't match!")
        print("="*60)
        print("   DO NOT proceed with updating DATABASE_URL")
        print("   Investigate the discrepancy first")
        print("   The old database is still intact")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
