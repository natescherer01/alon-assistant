"""
Run database migration to add deleted_at column
"""
import psycopg2
from config import get_settings

settings = get_settings()

# Read migration SQL
with open('migrations/add_deleted_at_column.sql', 'r') as f:
    migration_sql = f.read()

# Parse database URL to get connection parameters
# Format: postgresql://user:password@host:port/database
db_url = settings.database_url
db_url = db_url.replace('postgresql://', '')
user_pass, host_port_db = db_url.split('@')
user, password = user_pass.split(':')
host_port, database = host_port_db.split('/')
host, port = host_port.split(':')

# Connect and run migration
conn = psycopg2.connect(
    host=host,
    port=port,
    database=database,
    user=user,
    password=password
)
conn.autocommit = True
cursor = conn.cursor()

print("Running migration...")
try:
    cursor.execute(migration_sql)
    print("✓ Migration completed successfully!")
except Exception as e:
    print(f"✗ Migration failed: {e}")
finally:
    cursor.close()
    conn.close()
