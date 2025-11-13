#!/usr/bin/env python3
"""
Safely migrate PostgreSQL database to new instance in Railway
This creates a backup and migrates data to a new database with fresh credentials
"""
import subprocess
import sys
from datetime import datetime

# OLD database URL (current - will be deleted after migration)
OLD_DB_URL = "postgresql://postgres:gWQAnFlcSsawPQeFIYJLciNxOPRnLWDz@crossover.proxy.rlwy.net:48825/railway"

# NEW database URL (get this from Railway after creating new PostgreSQL service)
# REPLACE THIS with your new database URL from Railway:
NEW_DB_URL = "postgresql://postgres:NEW_PASSWORD@NEW_HOST:PORT/railway"

def run_command(cmd, description):
    """Run a shell command and handle errors"""
    print(f"\n{'='*60}")
    print(f"🔄 {description}")
    print(f"{'='*60}")

    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        sys.exit(1)

    print(result.stdout)
    print(f"✅ {description} - DONE")
    return result.stdout

def main():
    """Main migration process"""

    print("\n" + "="*60)
    print("DATABASE MIGRATION - PRODUCTION")
    print("="*60)
    print("\n⚠️  This script will:")
    print("   1. Create a backup of your current database")
    print("   2. Migrate all data to a new database")
    print("   3. Verify data integrity")
    print("\n⚠️  Prerequisites:")
    print("   1. Create NEW PostgreSQL database in Railway")
    print("   2. Copy NEW DATABASE_URL and update NEW_DB_URL in this script")
    print("   3. Install pg_dump and psql: brew install postgresql")

    response = input("\n✅ Have you completed all prerequisites? (yes/no): ")
    if response.lower() != "yes":
        print("❌ Aborted. Complete prerequisites first.")
        sys.exit(0)

    # Verify NEW_DB_URL was updated
    if "NEW_PASSWORD" in NEW_DB_URL or "NEW_HOST" in NEW_DB_URL:
        print("❌ Error: You must update NEW_DB_URL with your new database URL!")
        print("   1. Go to Railway → Create new PostgreSQL service")
        print("   2. Copy DATABASE_URL from new service")
        print("   3. Paste it into NEW_DB_URL in this script")
        sys.exit(1)

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_file = f"backup_production_{timestamp}.sql"

    # Step 1: Create backup
    run_command(
        f"pg_dump '{OLD_DB_URL}' > {backup_file}",
        "Creating backup of current database"
    )

    print(f"\n💾 Backup saved to: {backup_file}")
    print(f"   Size: {subprocess.check_output(['du', '-h', backup_file]).decode().split()[0]}")

    # Step 2: Restore to new database
    run_command(
        f"psql '{NEW_DB_URL}' < {backup_file}",
        "Restoring data to new database"
    )

    # Step 3: Verify data
    print("\n" + "="*60)
    print("🔍 Verifying Data Integrity")
    print("="*60)

    import psycopg2

    # Check old database
    old_conn = psycopg2.connect(OLD_DB_URL)
    old_cur = old_conn.cursor()

    old_cur.execute("SELECT COUNT(*) FROM users;")
    old_users = old_cur.fetchone()[0]

    old_cur.execute("SELECT COUNT(*) FROM tasks;")
    old_tasks = old_cur.fetchone()[0]

    old_cur.execute("SELECT COUNT(*) FROM chat_history;")
    old_chats = old_cur.fetchone()[0]

    old_cur.close()
    old_conn.close()

    # Check new database
    new_conn = psycopg2.connect(NEW_DB_URL)
    new_cur = new_conn.cursor()

    new_cur.execute("SELECT COUNT(*) FROM users;")
    new_users = new_cur.fetchone()[0]

    new_cur.execute("SELECT COUNT(*) FROM tasks;")
    new_tasks = new_cur.fetchone()[0]

    new_cur.execute("SELECT COUNT(*) FROM chat_history;")
    new_chats = new_cur.fetchone()[0]

    new_cur.close()
    new_conn.close()

    # Compare
    print(f"\n📊 Data Comparison:")
    print(f"   Users:        Old: {old_users:4d}  →  New: {new_users:4d}  {'✅' if old_users == new_users else '❌'}")
    print(f"   Tasks:        Old: {old_tasks:4d}  →  New: {new_tasks:4d}  {'✅' if old_tasks == new_tasks else '❌'}")
    print(f"   Chat History: Old: {old_chats:4d}  →  New: {new_chats:4d}  {'✅' if old_chats == new_chats else '❌'}")

    if old_users == new_users and old_tasks == new_tasks and old_chats == new_chats:
        print("\n✅ Data migration successful! All counts match.")
        print("\n📋 Next Steps:")
        print("   1. Go to Railway dashboard")
        print("   2. Update backend service environment variables:")
        print(f"      DATABASE_URL = {NEW_DB_URL}")
        print("   3. Deploy backend service")
        print("   4. Test login at https://sam.alontechnologies.com")
        print("   5. Once verified working, delete OLD database service in Railway")
        print(f"   6. Keep backup file safe: {backup_file}")
    else:
        print("\n❌ WARNING: Data counts don't match!")
        print("   DO NOT proceed. Investigate the discrepancy.")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
