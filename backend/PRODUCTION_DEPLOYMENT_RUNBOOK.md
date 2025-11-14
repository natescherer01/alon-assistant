# Production Deployment Runbook - Field-Level Encryption

**Version:** 1.0
**Date:** 2025-11-13
**Purpose:** Step-by-step guide for deploying field-level encryption to production

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Staging Deployment](#2-staging-deployment)
3. [Production Deployment](#3-production-deployment)
4. [Post-Deployment Validation](#4-post-deployment-validation)
5. [Rollback Procedures](#5-rollback-procedures)
6. [Monitoring and Alerting](#6-monitoring-and-alerting)
7. [Troubleshooting](#7-troubleshooting)
8. [Key Rotation](#8-key-rotation)

---

## 1. Pre-Deployment Checklist

### 1.1 Infrastructure Preparation

**CRITICAL: Complete ALL items before proceeding**

- [ ] **Generate Encryption Key**
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

- [ ] **Store Key in Secrets Manager**
  - **GCP Secret Manager** (if using GCP):
    ```bash
    echo -n "YOUR_ENCRYPTION_KEY" | gcloud secrets create ENCRYPTION_KEY --data-file=-
    ```
  - **AWS Secrets Manager** (if using AWS):
    ```bash
    aws secretsmanager create-secret --name prod/encryption-key --secret-string "YOUR_ENCRYPTION_KEY"
    ```
  - **Railway Environment Variables**:
    ```bash
    railway variables set ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY
    ```

- [ ] **Backup Encryption Key** (CRITICAL!)
  - **Primary**: Secrets Manager (automated)
  - **Secondary**: 1Password Team Vault
  - **Tertiary**: Print QR code and store in physical safe
  - **Verify**: Test recovery from each backup location

- [ ] **Database Backup**
  ```bash
  # PostgreSQL
  pg_dump $DATABASE_URL > backup_pre_encryption_$(date +%Y%m%d_%H%M%S).sql
  gzip backup_pre_encryption_*.sql

  # Verify backup integrity
  gunzip -c backup_pre_encryption_*.sql.gz | head -n 100
  ```

- [ ] **Test Backup Restore** (on separate database)
  ```bash
  # Create test database
  createdb test_restore_db

  # Restore backup
  gunzip -c backup_pre_encryption_*.sql.gz | psql test_restore_db

  # Verify data
  psql test_restore_db -c "SELECT COUNT(*) FROM users;"

  # Cleanup
  dropdb test_restore_db
  ```

### 1.2 Code Preparation

- [ ] **Dependencies Installed**
  ```bash
  cd backend
  pip install -r requirements.txt

  # Verify critical packages
  python -c "from cryptography.fernet import Fernet; print('✓ cryptography OK')"
  python -c "from prometheus_client import Counter; print('✓ prometheus_client OK')"
  ```

- [ ] **Tests Passing**
  ```bash
  # Unit tests
  pytest tests/test_encryption.py -v

  # Integration tests
  pytest tests/test_encrypted_models.py -v

  # All tests
  pytest tests/ -v --cov=app.core.encryption --cov=app.db.types
  ```

- [ ] **Code Review Complete**
  - Security review of encryption implementation
  - Best practices review of key management
  - Performance review of batch operations

### 1.3 Environment Configuration

- [ ] **Set Environment Variables** (on staging first)
  ```bash
  # Required
  ENCRYPTION_KEY=<44_char_base64_key>

  # Optional (for key rotation)
  ENCRYPTION_KEY_FALLBACK=<old_key_optional>
  ENCRYPTION_KEY_VERSION=1

  # Optional (configuration)
  ENCRYPTION_MAX_SIZE=10485760  # 10 MB
  ENCRYPTION_SANITIZE_INPUT=true
  ENCRYPTION_AUDIT_LOGGING=true
  ```

- [ ] **Verify Secrets Manager Access**
  ```bash
  # Test retrieval
  python -c "
  from secrets_manager import get_secrets_manager
  sm = get_secrets_manager()
  key = sm.get_secret('ENCRYPTION_KEY')
  print('✓ Key retrieved:', key[:10] + '...' if key else '✗ FAILED')
  "
  ```

### 1.4 Communication Plan

- [ ] **Schedule Maintenance Window**
  - Recommended: 2-4 hours
  - Off-peak hours (e.g., Sunday 2-6 AM EST)
  - Notify users 72 hours in advance

- [ ] **Prepare Stakeholder Communication**
  - Email template for start of maintenance
  - Email template for completion
  - Email template for rollback (if needed)

- [ ] **On-Call Team Ready**
  - Backend engineer
  - DevOps engineer
  - Database administrator

---

## 2. Staging Deployment

### 2.1 Deploy to Staging

**Timeline: 1-2 hours**

1. **Copy Production Database to Staging**
   ```bash
   # Export production data (anonymized if needed)
   pg_dump $PROD_DATABASE_URL > prod_snapshot.sql

   # Restore to staging
   psql $STAGING_DATABASE_URL < prod_snapshot.sql
   ```

2. **Deploy Code to Staging**
   ```bash
   git checkout main
   git pull origin main

   # Deploy to Railway staging
   railway up --service staging
   ```

3. **Run Phase 1 Migration** (Add encrypted columns)
   ```bash
   # SSH to staging or run via Railway CLI
   railway run --service staging alembic upgrade head
   ```

   Expected output:
   ```
   INFO  [alembic.runtime.migration] Running upgrade 001_add_performance_indexes -> 002_encryption_phase1
   Adding encrypted columns to users table...
   ✓ Users table updated
   Adding encrypted columns to tasks table...
   ✓ Tasks table updated
   Adding encrypted columns to chat_history table...
   ✓ Chat history table updated
   Phase 1 complete!
   ```

4. **Verify Columns Added**
   ```bash
   railway run --service staging psql $DATABASE_URL -c "\\d users"
   # Should show: email_encrypted, full_name_encrypted, email_hash
   ```

5. **Run Encryption Script (Dry Run)**
   ```bash
   railway run --service staging python scripts/encrypt_existing_data.py --dry-run
   ```

6. **Run Encryption Script (Actual)**
   ```bash
   railway run --service staging python scripts/encrypt_existing_data.py
   ```

   Monitor progress:
   ```
   MIGRATING USERS TABLE
   Found 150 users to encrypt
   Progress: 150/150 users processed
   ✓ Encrypted 150 users

   MIGRATING TASKS TABLE
   Found 890 tasks to encrypt
   Progress: 890/890 tasks processed
   ✓ Encrypted 890 tasks

   MIGRATING CHAT_HISTORY TABLE
   Found 3420 chat messages to encrypt
   Progress: 3420/3420 messages processed
   ✓ Encrypted 3420 chat messages
   ```

7. **Update Application Models**
   - Models are already updated to use EncryptedString/EncryptedText
   - Restart application to load new model definitions
   ```bash
   railway restart --service staging
   ```

8. **Verify Application Works**
   ```bash
   # Test API endpoints
   curl https://staging.app.railway.app/health

   # Test user login
   curl -X POST https://staging.app.railway.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"TestPassword123"}'

   # Test chat endpoint
   curl https://staging.app.railway.app/api/v1/chat \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello"}'
   ```

### 2.2 Staging Validation

- [ ] **Functional Tests**
  - User signup works
  - User login works
  - Chat messages load correctly
  - Tasks CRUD operations work
  - Encrypted data is correctly decrypted on read

- [ ] **Performance Tests**
  ```bash
  # Load testing with Apache Bench
  ab -n 1000 -c 10 https://staging.app.railway.app/api/v1/health

  # Check response times
  # Expected: <500ms p95 (acceptable overhead from encryption)
  ```

- [ ] **Security Tests**
  - Verify encrypted data in database (not plaintext)
  - Verify email_hash enables fast lookups
  - Verify no sensitive data in logs
  - Test key rotation mechanism

- [ ] **Rollback Test**
  ```bash
  # Test rollback procedure
  railway run --service staging alembic downgrade -1

  # Verify application still works with plaintext columns
  # Then upgrade again
  railway run --service staging alembic upgrade head
  ```

---

## 3. Production Deployment

### 3.1 Pre-Deployment

**Timeline: 30 minutes**

1. **Final Backup**
   ```bash
   # Create timestamped backup
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   pg_dump $PROD_DATABASE_URL > backup_prod_pre_encryption_$TIMESTAMP.sql
   gzip backup_prod_pre_encryption_$TIMESTAMP.sql

   # Upload to S3/GCS for safekeeping
   aws s3 cp backup_prod_pre_encryption_$TIMESTAMP.sql.gz s3://backups/
   ```

2. **Freeze Deployments**
   ```bash
   # Prevent accidental deployments
   railway variables set DEPLOYMENT_FROZEN=true
   ```

3. **Enable Maintenance Mode** (if supported)
   ```bash
   railway variables set MAINTENANCE_MODE=true
   railway restart
   ```

### 3.2 Migration Execution

**Timeline: 1-2 hours depending on data volume**

1. **Deploy Code**
   ```bash
   git checkout main
   railway deploy --service production
   ```

2. **Run Phase 1 Migration**
   ```bash
   railway run --service production alembic upgrade head
   ```

3. **Run Encryption Script**
   ```bash
   # Start encryption
   railway run --service production python scripts/encrypt_existing_data.py --verbose

   # Monitor in separate terminal
   railway logs --service production --tail
   ```

   **Expected Duration:**
   - 1,000 users: ~30 seconds
   - 10,000 tasks: ~2 minutes
   - 50,000 chat messages: ~5 minutes

4. **Verify Encryption Complete**
   ```bash
   railway run --service production psql $DATABASE_URL <<EOF
   SELECT 'users' as table, COUNT(*) as encrypted
   FROM users WHERE email_encrypted IS NOT NULL
   UNION ALL
   SELECT 'tasks', COUNT(*)
   FROM tasks WHERE title_encrypted IS NOT NULL
   UNION ALL
   SELECT 'chat_history', COUNT(*)
   FROM chat_history WHERE message_encrypted IS NOT NULL;
   EOF
   ```

5. **Restart Application**
   ```bash
   railway restart --service production
   ```

6. **Disable Maintenance Mode**
   ```bash
   railway variables unset MAINTENANCE_MODE
   railway restart
   ```

---

## 4. Post-Deployment Validation

### 4.1 Smoke Tests

Run immediately after deployment:

```bash
# Health check
curl https://app.railway.app/health

# User registration
curl -X POST https://app.railway.app/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"Test123!","full_name":"Smoke Test"}'

# User login
curl -X POST https://app.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"Test123!"}'

# Chat
curl -X POST https://app.railway.app/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test message"}'

# Tasks
curl https://app.railway.app/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN"
```

### 4.2 Data Validation

- [ ] **Verify Encryption in Database**
  ```sql
  -- Check sample encrypted data
  SELECT id, email, email_hash
  FROM users
  LIMIT 1;

  -- Email should start with 'gAAAAA' (Fernet format)
  -- Email_hash should be 64-character hex string
  ```

- [ ] **Verify Decryption Works**
  ```python
  # Python script to verify
  from database import SessionLocal
  from models import User

  db = SessionLocal()
  user = db.query(User).first()

  # Should be plaintext (automatically decrypted)
  print(f"Email: {user.email}")
  print(f"Full Name: {user.full_name}")

  assert '@' in user.email  # Should be readable email
  assert len(user.email_hash) == 64  # Should have hash
  ```

### 4.3 Performance Validation

- [ ] **Check API Response Times**
  ```bash
  # Monitor Prometheus metrics
  # Or use logging

  # Expected metrics:
  # - p50 latency: <200ms (same as before)
  # - p95 latency: <500ms (within acceptable range)
  # - p99 latency: <1000ms
  ```

- [ ] **Check Database Performance**
  ```sql
  -- Check slow queries
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE query LIKE '%users%' OR query LIKE '%tasks%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;
  ```

### 4.4 Security Validation

- [ ] **Verify No Plaintext in Database**
  ```sql
  -- Search for sample plaintext (should return 0 rows)
  SELECT COUNT(*) FROM users WHERE email LIKE '%@example.com%';
  -- Expected: 0 (emails are encrypted)

  -- Check encrypted columns
  SELECT COUNT(*) FROM users WHERE email_encrypted IS NOT NULL;
  -- Expected: All rows
  ```

- [ ] **Verify Audit Logs**
  ```bash
  # Check logs for encryption events
  railway logs --service production | grep "audit.encryption"

  # Should see:
  # - "Encryption service initialized"
  # - "Encryption operation completed"
  # - No plaintext data in logs
  ```

- [ ] **Verify Prometheus Metrics**
  ```bash
  # Check metrics endpoint
  curl https://app.railway.app/metrics | grep encryption

  # Should see:
  # - encryption_operations_total
  # - encryption_duration_seconds
  # - encryption_errors_total (should be 0)
  ```

---

## 5. Rollback Procedures

### 5.1 When to Rollback

Rollback if:
- Migration takes >2x expected time
- >1% of records fail to encrypt
- Critical errors in application logs
- User-facing errors increase >10%
- API response times increase >100%

### 5.2 Rollback Steps

**CRITICAL: Only execute if deployment fails**

1. **Stop Application**
   ```bash
   railway scale --service production 0
   ```

2. **Rollback Database Migration**
   ```bash
   railway run --service production alembic downgrade -1
   ```

3. **Restore from Backup** (if needed)
   ```bash
   # Download backup
   aws s3 cp s3://backups/backup_prod_pre_encryption_*.sql.gz .

   # Restore
   gunzip -c backup_prod_pre_encryption_*.sql.gz | railway run --service production psql $DATABASE_URL
   ```

4. **Revert Code**
   ```bash
   git revert HEAD~1  # Revert last commit
   railway deploy --service production
   ```

5. **Restart Application**
   ```bash
   railway scale --service production 1
   railway restart --service production
   ```

6. **Verify Application Works**
   ```bash
   curl https://app.railway.app/health
   ```

7. **Post-Mortem**
   - Document what went wrong
   - Create action items for fixes
   - Schedule new deployment attempt

---

## 6. Monitoring and Alerting

### 6.1 Key Metrics to Monitor

**Application Metrics (Prometheus)**:
```yaml
- encryption_operations_total{operation="encrypt", status="success"}
- encryption_operations_total{operation="decrypt", status="success"}
- encryption_errors_total{error_type="*"}
- encryption_duration_seconds (p50, p95, p99)
- active_encryption_key_version
```

**Database Metrics**:
```yaml
- Connection pool usage
- Query execution time
- Slow query count
- Database size
```

**Application Health**:
```yaml
- API response times (p50, p95, p99)
- Error rate (5xx responses)
- Request throughput
```

### 6.2 Alert Configuration

**Critical Alerts** (Page on-call):
```yaml
# Encryption failures
encryption_errors_total > 10 in 5 minutes

# Decryption failures
encryption_operations{operation="decrypt", status="error"} > 5 in 5 minutes

# API errors
http_requests_total{status=~"5.."} > 100 in 1 minute
```

**Warning Alerts** (Slack notification):
```yaml
# Slow API responses
api_response_time_p95 > 1000ms for 5 minutes

# Database slow queries
slow_query_count > 10 in 10 minutes
```

### 6.3 Dashboard Setup

Create Grafana dashboard with panels:
1. **Encryption Operations** (line chart)
2. **Encryption Errors** (counter)
3. **Encryption Duration** (histogram)
4. **API Response Times** (line chart)
5. **Database Performance** (line chart)
6. **Active Key Version** (gauge)

---

## 7. Troubleshooting

### 7.1 Common Issues

**Issue: "ENCRYPTION_KEY not set" error**

Solution:
```bash
# Verify key is in environment
railway run --service production env | grep ENCRYPTION_KEY

# If missing, set it
railway variables set ENCRYPTION_KEY=<your_key>
railway restart
```

**Issue: "Decryption failed" errors**

Causes:
1. Wrong encryption key
2. Data corrupted
3. Key rotation issue

Solution:
```bash
# Check key version
railway logs --service production | grep "Encryption service initialized"

# If key changed, set fallback key
railway variables set ENCRYPTION_KEY_FALLBACK=<old_key>
railway restart
```

**Issue: Slow API responses**

Causes:
1. Large batch of data being decrypted
2. Database queries not optimized
3. Missing indexes

Solution:
```bash
# Check slow queries
railway run --service production psql $DATABASE_URL -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;"

# Add caching for frequently accessed data
# Or optimize queries to use email_hash for lookups
```

**Issue: Migration script stuck**

Causes:
1. Database locked
2. Out of memory
3. Network issues

Solution:
```bash
# Check running processes
railway run --service production psql $DATABASE_URL -c "
SELECT pid, usename, state, query
FROM pg_stat_activity
WHERE state != 'idle';"

# Kill stuck process if needed
railway run --service production psql $DATABASE_URL -c "
SELECT pg_terminate_backend(PID);"
```

---

## 8. Key Rotation

### 8.1 When to Rotate Keys

- **Scheduled**: Every 90 days
- **Emergency**: If key compromised or suspected breach

### 8.2 Key Rotation Procedure

**Timeline: 2-4 hours**

1. **Generate New Key**
   ```bash
   NEW_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
   echo "New key: $NEW_KEY"
   ```

2. **Store New Key in Secrets Manager**
   ```bash
   # GCP
   echo -n "$NEW_KEY" | gcloud secrets versions add ENCRYPTION_KEY --data-file=-

   # AWS
   aws secretsmanager update-secret --secret-id prod/encryption-key --secret-string "$NEW_KEY"
   ```

3. **Set New Key as Primary, Old as Fallback**
   ```bash
   # Get old key first
   OLD_KEY=$(railway variables get ENCRYPTION_KEY)

   # Set new key and fallback
   railway variables set ENCRYPTION_KEY=$NEW_KEY
   railway variables set ENCRYPTION_KEY_FALLBACK=$OLD_KEY
   railway variables set ENCRYPTION_KEY_VERSION=2

   railway restart
   ```

4. **Verify Application Works**
   ```bash
   # Should decrypt old data using fallback key
   curl https://app.railway.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```

5. **Re-encrypt All Data**
   ```bash
   # Create re-encryption script (similar to encrypt_existing_data.py)
   railway run python scripts/reencrypt_with_new_key.py
   ```

6. **Remove Fallback Key**
   ```bash
   # After all data re-encrypted
   railway variables unset ENCRYPTION_KEY_FALLBACK
   railway restart
   ```

7. **Update Backup Documentation**
   ```bash
   echo "Key rotated on $(date)" >> docs/key_rotation_log.txt
   ```

---

## Contact Information

- **On-Call Engineer**: [Your contact]
- **DevOps Lead**: [Contact]
- **Security Team**: [Contact]

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-13 | Claude Code | Initial runbook |

---

**END OF RUNBOOK**
