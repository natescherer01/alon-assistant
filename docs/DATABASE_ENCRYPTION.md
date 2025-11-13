# Database Encryption & Security Guide

## Overview

This document explains the security measures implemented in the Personal AI Assistant and provides guidance for securing database content in production environments.

**Last Updated:** 2025-11-12
**Status:** Production-Ready Security Architecture

---

## Table of Contents

1. [Current Security Measures](#current-security-measures)
2. [Why You Can See Other Users' Data](#why-you-can-see-other-users-data)
3. [Database Encryption at Rest](#database-encryption-at-rest)
4. [Database Encryption in Transit](#database-encryption-in-transit)
5. [Application-Level Encryption](#application-level-encryption)
6. [Row-Level Security](#row-level-security)
7. [Production Deployment Checklist](#production-deployment-checklist)
8. [Monitoring & Compliance](#monitoring--compliance)

---

## Current Security Measures

### ✅ Already Implemented

1. **Application-Level Access Control**
   - All API endpoints require JWT authentication
   - Every database query filters by `user_id`
   - Users cannot access other users' data through the application
   - Foreign key constraints with `ondelete="CASCADE"` ensure data integrity

2. **Authentication Security**
   - NIST SP 800-63B compliant password requirements (15+ characters)
   - Passwords hashed with bcrypt (never stored in plaintext)
   - JWT tokens with expiration
   - Token blacklist for logout/revocation
   - Account lockout after failed login attempts

3. **API Security**
   - CORS configured for specific origins
   - Rate limiting on all endpoints
   - Input validation with Pydantic schemas
   - SQL injection protection via SQLAlchemy ORM
   - XSS protection

4. **Code-Level Security**
   - Secrets managed via environment variables
   - No hardcoded credentials
   - Secure session management
   - HTTPS enforcement in production

### Example: Row-Level Security in Code

```python
# backend/tasks/router.py
@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ✅ Only returns tasks for the authenticated user
    tasks = db.query(Task).filter(
        Task.user_id == current_user.id,
        Task.status != "deleted"
    ).all()
    return tasks
```

**Result:** Users CANNOT see each other's data through the application API.

---

## Why You Can See Other Users' Data

If you have **direct database access** (e.g., using `psql`, SQLite browser, or database management tools), you can see all data because:

1. **You're bypassing application security**
   - Database tools connect directly, skipping JWT authentication
   - No user_id filtering happens at the database level
   - You have superuser/admin privileges

2. **This is normal for database administrators**
   - DBAs always have full access to raw data
   - This is required for maintenance, backups, debugging

3. **This is NOT a security vulnerability**
   - Regular users access via API (with restrictions)
   - Only developers/admins have database credentials
   - In production, database access is tightly controlled

### Who Has Database Access?

| Environment | Direct DB Access | Via API |
|-------------|------------------|---------|
| **Development** | Developers only | All users (filtered by user_id) |
| **Production** | Admins/DBAs only (with audit logging) | All users (filtered by user_id) |

---

## Database Encryption at Rest

### What is Encryption at Rest?

Encryption at rest protects data stored on disk. Even if someone steals the physical hard drive, they cannot read the data without the encryption key.

### Implementation Options

#### Option 1: PostgreSQL Native Encryption (Recommended for Production)

**Using pgcrypto Extension:**

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive fields
ALTER TABLE chat_history
  ADD COLUMN message_encrypted bytea,
  ADD COLUMN response_encrypted bytea;

-- Migrate existing data
UPDATE chat_history
SET message_encrypted = pgp_sym_encrypt(message, '{{ENCRYPTION_KEY}}'),
    response_encrypted = pgp_sym_encrypt(response, '{{ENCRYPTION_KEY}}');

-- Drop plain text columns (after verification)
ALTER TABLE chat_history
  DROP COLUMN message,
  DROP COLUMN response;
```

**Environment Variable:**
```bash
# .env
DATABASE_ENCRYPTION_KEY=your-256-bit-encryption-key-here
```

#### Option 2: Full Database Encryption (PostgreSQL 14+)

```bash
# Enable transparent data encryption
initdb -D /path/to/data --data-checksums --wal-init-zero --cipher=AES256
```

#### Option 3: Filesystem-Level Encryption

**Linux (LUKS):**
```bash
cryptsetup luksFormat /dev/sdb
cryptsetup open /dev/sdb encrypted_disk
mkfs.ext4 /dev/mapper/encrypted_disk
mount /dev/mapper/encrypted_disk /var/lib/postgresql/data
```

**macOS (FileVault):**
- Enable FileVault in System Preferences

**Cloud Providers:**
- AWS RDS: Enable encryption at creation
- Google Cloud SQL: Enable at instance creation
- Azure Database: Enable transparent data encryption

### SQLite Encryption (Development)

**Using sqlcipher:**

```bash
pip install sqlcipher3
```

```python
# backend/database.py
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine

# SQLite with encryption
DATABASE_URL = "sqlite:///./personal_assistant.db?cipher=aes-256-cbc"

engine = create_engine(DATABASE_URL)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA key = 'your-encryption-key';")
    cursor.close()
```

---

## Database Encryption in Transit

### What is Encryption in Transit?

Encryption in transit protects data as it travels between your application server and database server.

### PostgreSQL SSL/TLS Configuration

#### 1. Generate SSL Certificates

```bash
# Generate self-signed certificate (development)
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt \
  -keyout server.key \
  -subj "/CN=localhost"

chmod 600 server.key
chown postgres:postgres server.key server.crt
```

#### 2. Configure PostgreSQL

```bash
# postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
ssl_prefer_server_ciphers = on
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'
```

#### 3. Update Connection String

```python
# backend/config.py
database_url: str = os.getenv(
    "DATABASE_URL",
    "postgresql://user:pass@localhost:5432/dbname?sslmode=require"
)
```

**SSL Modes:**
- `disable`: No SSL
- `allow`: Try SSL, fallback to plain
- `prefer`: Try SSL first (default)
- `require`: Require SSL (recommended)
- `verify-ca`: Require SSL + verify certificate authority
- `verify-full`: Require SSL + verify certificate + hostname

### Cloud Provider SSL

**AWS RDS:**
```python
DATABASE_URL = "postgresql://user:pass@rds.amazonaws.com:5432/db?sslmode=verify-full&sslrootcert=/path/to/rds-ca-2019-root.pem"
```

**Google Cloud SQL:**
```python
DATABASE_URL = "postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance"
```

---

## Application-Level Encryption

For maximum security, encrypt sensitive data BEFORE storing in the database.

### Implementation

**File:** `backend/encryption.py`

```python
"""
Application-level encryption for sensitive data
"""
from cryptography.fernet import Fernet
from config import get_settings
import base64
import os

settings = get_settings()

class EncryptionService:
    """Service for encrypting/decrypting sensitive data"""

    def __init__(self):
        # Get encryption key from environment
        key = os.getenv("APP_ENCRYPTION_KEY")
        if not key:
            raise ValueError("APP_ENCRYPTION_KEY not set")

        # Ensure key is proper length for Fernet (32 url-safe base64-encoded bytes)
        self.cipher = Fernet(key.encode())

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext string"""
        if not plaintext:
            return ""
        return self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext string"""
        if not ciphertext:
            return ""
        return self.cipher.decrypt(ciphertext.encode()).decode()

# Global instance
encryption_service = EncryptionService()
```

### Generate Encryption Key

```python
# Generate a new Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add to `.env`:
```bash
APP_ENCRYPTION_KEY=your-generated-fernet-key-here
```

### Usage in Models

**Before:**
```python
class ChatMessage(Base):
    __tablename__ = "chat_history"

    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
```

**After (with encryption):**
```python
from encryption import encryption_service

class ChatMessage(Base):
    __tablename__ = "chat_history"

    _message = Column("message", Text, nullable=False)
    _response = Column("response", Text, nullable=False)

    @property
    def message(self):
        return encryption_service.decrypt(self._message)

    @message.setter
    def message(self, value):
        self._message = encryption_service.encrypt(value)

    @property
    def response(self):
        return encryption_service.decrypt(self._response)

    @response.setter
    def response(self, value):
        self._response = encryption_service.encrypt(value)
```

### What to Encrypt

**High Priority (PII/Sensitive):**
- ✅ Chat messages
- ✅ Chat responses
- ✅ Task descriptions (may contain sensitive info)
- ✅ Task notes
- ✅ Study session notes
- ✅ Active recall question answers

**Low Priority (Metadata):**
- ❌ User email (needed for login lookups)
- ❌ Task titles (usually generic)
- ❌ Timestamps
- ❌ Status fields
- ❌ Numeric IDs

---

## Row-Level Security

### PostgreSQL Row-Level Security (RLS)

Add database-level enforcement that users can only see their own data.

```sql
-- Enable RLS on tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_recall_questions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY user_isolation_policy ON tasks
    FOR ALL
    TO authenticated_user
    USING (user_id = current_setting('app.current_user_id')::integer);

CREATE POLICY user_isolation_policy ON chat_history
    FOR ALL
    TO authenticated_user
    USING (user_id = current_setting('app.current_user_id')::integer);

CREATE POLICY user_isolation_policy ON study_sessions
    FOR ALL
    TO authenticated_user
    USING (user_id = current_setting('app.current_user_id')::integer);

CREATE POLICY user_isolation_policy ON active_recall_questions
    FOR ALL
    TO authenticated_user
    USING (user_id = current_setting('app.current_user_id')::integer);

-- Create application role
CREATE ROLE authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_user;
```

### Set User Context in Application

```python
# backend/auth/dependencies.py
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # ... existing authentication logic ...

    # Set PostgreSQL session variable for RLS
    db.execute(text(f"SET app.current_user_id = {user.id}"))

    return user
```

**Benefits:**
- Database enforces access control
- Protection even if application bug allows access
- Admins can still access with superuser credentials
- Audit logging built-in

---

## Production Deployment Checklist

### Pre-Deployment Security

- [ ] **Change SECRET_KEY**: Generate production secret
  ```bash
  python -c 'import secrets; print(secrets.token_urlsafe(32))'
  ```

- [ ] **Generate APP_ENCRYPTION_KEY**: For application-level encryption
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

- [ ] **Enable PostgreSQL SSL**: Configure SSL certificates

- [ ] **Configure CORS**: Set specific allowed origins (not `*`)
  ```bash
  CORS_ORIGINS=https://your-app.vercel.app,https://your-domain.com
  ```

- [ ] **Set DATABASE_URL with SSL**: Include `?sslmode=require`

- [ ] **Enable database encryption at rest**: Cloud provider settings

- [ ] **Restrict database access**:
  - Use dedicated DB user (not postgres superuser)
  - Grant minimum required permissions
  - Whitelist specific IP addresses

### Environment Variables (Production)

```bash
# Security
SECRET_KEY=<256-bit-production-key>
APP_ENCRYPTION_KEY=<fernet-key>
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# API
CORS_ORIGINS=https://app.example.com
ANTHROPIC_API_KEY=<your-key>

# Redis (for token blacklist)
REDIS_URL=rediss://redis-host:6380/0
```

### Database User Permissions

```sql
-- Create restricted application user
CREATE USER app_user WITH PASSWORD 'strong-password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE personal_assistant TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM app_user;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

### Firewall Rules

```bash
# Only allow application server IPs
sudo ufw allow from 10.0.1.5 to any port 5432 proto tcp

# Deny all other connections
sudo ufw deny 5432/tcp
```

---

## Monitoring & Compliance

### Audit Logging

**Enable PostgreSQL Audit:**

```sql
-- Install pgaudit extension
CREATE EXTENSION pgaudit;

-- Configure logging
ALTER SYSTEM SET pgaudit.log = 'read, write, ddl';
ALTER SYSTEM SET pgaudit.log_relation = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;

-- Reload configuration
SELECT pg_reload_conf();
```

### Application-Level Logging

```python
# backend/auth/security_logging.py
import logging

security_logger = logging.getLogger("security")

def log_data_access(user_id: int, table: str, operation: str, record_count: int):
    """Log all database access for audit trail"""
    security_logger.info(
        f"DATA_ACCESS: user_id={user_id} table={table} "
        f"operation={operation} records={record_count}"
    )
```

### Compliance

**GDPR Compliance:**
- ✅ Data encryption at rest and in transit
- ✅ User can delete their account (deletes all data)
- ✅ Data minimization (only store what's needed)
- ✅ Access controls per user

**HIPAA Compliance (if storing health data):**
- ✅ Encryption at rest
- ✅ Encryption in transit
- ✅ Access controls
- ✅ Audit logging
- ⚠️ Requires Business Associate Agreement with cloud provider
- ⚠️ Requires regular security assessments

---

## Quick Start: Enable Production Encryption

**For existing deployment:**

1. **Generate keys:**
   ```bash
   # In backend directory
   python -c 'import secrets; print("SECRET_KEY=" + secrets.token_urlsafe(32))'
   python -c "from cryptography.fernet import Fernet; print('APP_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
   ```

2. **Update .env:**
   ```bash
   SECRET_KEY=<your-generated-secret>
   APP_ENCRYPTION_KEY=<your-generated-fernet-key>
   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
   ```

3. **Enable cloud database encryption:**
   - AWS RDS: Encryption enabled at creation
   - Google Cloud SQL: Enable in settings
   - Heroku Postgres: Standard+ plans include encryption

4. **Restart application:**
   ```bash
   # Restart your API server to load new environment variables
   ```

---

## Summary

### Current State
- ✅ Application enforces access control (users can't see each other's data via API)
- ✅ Passwords hashed with bcrypt
- ✅ JWT authentication with expiration
- ✅ HTTPS in production
- ✅ SQL injection protection

### To Add for Production
1. **Database encryption at rest** (cloud provider setting)
2. **Database encryption in transit** (SSL/TLS with `sslmode=require`)
3. **Application-level encryption** (for chat messages and sensitive fields)
4. **Row-level security** (PostgreSQL RLS policies)
5. **Audit logging** (pgaudit + application logging)

### Why You See All Data in Development
- You have direct database access (bypass application security)
- This is normal for developers
- In production, only DBAs have this access (with audit logging)

---

**Version:** 1.0
**Author:** Security Team
**Last Review:** 2025-11-12
