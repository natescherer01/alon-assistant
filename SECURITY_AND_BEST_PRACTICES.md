# Security & Best Practices Guide

**Production-First Development - Zero Trust Architecture**

This document consolidates all security practices, development guidelines, and absolute no-gos for this project.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Absolute No-Gos](#absolute-no-gos)
3. [Development Workflow](#development-workflow)
4. [Testing Strategy](#testing-strategy)
5. [Security Implementation](#security-implementation)
6. [Deployment & Operations](#deployment--operations)
7. [Credential Management](#credential-management)
8. [Monitoring & Incident Response](#monitoring--incident-response)

---

## Core Principles

### 1. Production-First Development

**We DO NOT use localhost for testing production features.**

✅ **DO:**
- Test directly in Railway production environment
- Use Railway's environment variables (never `.env` files)
- Deploy changes and test on live infrastructure
- Use production PostgreSQL and Redis instances
- Test CORS, authentication, and security features in production

❌ **DON'T:**
- Run backend locally with `uvicorn main:app --reload`
- Use `localhost:8000` for API testing
- Test security features on localhost (they behave differently)
- Use SQLite or local PostgreSQL for testing production features
- Rely on local `.env` files

**Why?** Security features (CORS, HTTPS headers, authentication) work differently on localhost. Testing in production ensures features work as intended.

---

### 2. Zero Trust - Never Commit Secrets

**Credentials, API keys, and passwords NEVER go in git. Period.**

✅ **DO:**
- Use Railway dashboard environment variables ONLY
- Generate secrets locally and paste into Railway
- Use `.gitignore` to block `.env` files
- Use secure prompts when credentials are needed (like `migrate_database_secure.py`)
- Rotate credentials immediately if accidentally committed

❌ **DON'T:**
- Commit `.env` files
- Hardcode passwords in Python/JavaScript files
- Put credentials in documentation files
- Share credentials in chat (use secure prompts instead)
- Commit example credentials (even fake ones)

---

### 3. Security by Default

**All security features enabled in production. No exceptions.**

✅ **DO:**
- Set `ENVIRONMENT=production` in Railway
- Enable HSTS, CSP, and OWASP security headers
- Use strong passwords (12+ chars, NIST validation)
- Implement account lockout (5 failed attempts)
- Use rate limiting on all endpoints
- Log all security events in JSON format
- Use HTTPS everywhere (Railway provides this)

❌ **DON'T:**
- Use `ENVIRONMENT=development` in production
- Disable security headers for "debugging"
- Allow weak passwords
- Skip rate limiting
- Turn off security logging
- Use HTTP (Railway forces HTTPS)

---

## Absolute No-Gos

### 🚨 NEVER Do These:

1. **NEVER commit credentials to git**
   - No API keys, passwords, database URLs, secret keys
   - No `.env` files
   - No example credentials
   - Check git history: `git log -p | grep -i "password\|secret\|api_key"`

2. **NEVER use localhost for production testing**
   - Security features don't work the same
   - CORS behaves differently
   - HTTPS headers don't apply
   - Test in Railway production environment

3. **NEVER hardcode secrets in code**
   ```python
   # ❌ NEVER DO THIS
   SECRET_KEY = "my-secret-key"
   ANTHROPIC_API_KEY = "sk-ant-..."
   DATABASE_URL = "postgresql://postgres:password@..."

   # ✅ ALWAYS DO THIS
   SECRET_KEY = os.getenv("SECRET_KEY")
   ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
   DATABASE_URL = os.getenv("DATABASE_URL")
   ```

4. **NEVER use wildcards in CORS**
   ```python
   # ❌ NEVER
   CORS_ORIGINS = "*"

   # ✅ ALWAYS
   CORS_ORIGINS = "https://sam.alontechnologies.com"
   ```

5. **NEVER store secrets in documentation**
   ```markdown
   # ❌ NEVER
   DATABASE_URL=postgresql://postgres:gWQAnFlcSsawPQeFIYJLciNxOPRnLWDz@...

   # ✅ ALWAYS
   **To find your DATABASE_URL:**
   1. Go to Railway dashboard
   2. Click on PostgreSQL service
   3. Copy DATABASE_URL from Variables tab
   ```

6. **NEVER skip security validation**
   - Always validate environment variables on startup
   - Always check password strength
   - Always log security events
   - Always use rate limiting

7. **NEVER delete production data without backup**
   - Always create backup before migrations
   - Always verify data integrity after migration
   - Keep backups for 30+ days
   - Test restore procedure quarterly

8. **NEVER share credentials in plain text**
   - Use secure prompts (`input()` in Python)
   - Use password managers
   - Rotate immediately if exposed

9. **NEVER trust user input**
   - Always validate with Pydantic schemas
   - Always sanitize input
   - Always use parameterized queries (SQLAlchemy ORM)
   - Always limit request size

10. **NEVER ignore security warnings**
    - Failed login attempts
    - Unusual API usage
    - Database connection errors
    - Token blacklist failures

---

## Development Workflow

### Daily Development Process

```bash
# 1. Make code changes locally
git checkout -b feature/my-feature
# Edit code...

# 2. Commit changes (never include .env files)
git add .
git commit -m "Add feature: description"

# 3. Push to GitHub
git push origin feature/my-feature

# 4. Railway auto-deploys from main branch
# Wait 1-2 minutes for deployment

# 5. Test in production environment
curl https://alon-assistant.up.railway.app/health
# Test frontend: https://sam.alontechnologies.com

# 6. Check Railway logs for errors
# Railway Dashboard → Service → Logs

# 7. Merge to main when verified working
git checkout main
git merge feature/my-feature
git push origin main
```

### Environment Setup

**Backend:** Railway environment variables ONLY

```bash
# In Railway Dashboard → Backend Service → Variables

# REQUIRED
SECRET_KEY=<generated-with-secrets.token_urlsafe(32)>
ANTHROPIC_API_KEY=sk-ant-...
ENVIRONMENT=production
CORS_ORIGINS=https://sam.alontechnologies.com

# Auto-configured by Railway
DATABASE_URL=postgresql://...  # From PostgreSQL service
REDIS_URL=redis://...         # From Redis service

# OPTIONAL (defaults shown)
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
LOG_LEVEL=INFO
```

**Frontend:** Vercel environment variables

```bash
# In Vercel Dashboard → Project → Settings → Environment Variables
VITE_API_BASE_URL=https://alon-assistant.up.railway.app/api/v1
```

**Local Development:** ❌ We don't use local development for production features

---

## Testing Strategy

### Production Testing (Primary Method)

✅ **Test directly in Railway:**

1. **Deploy to production**
   ```bash
   git push origin main
   # Railway auto-deploys
   ```

2. **Test API endpoints**
   ```bash
   # Test authentication
   curl -X POST https://alon-assistant.up.railway.app/api/v1/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "TestPassword123!",
       "full_name": "Test User"
     }'

   # Test health check
   curl https://alon-assistant.up.railway.app/health
   ```

3. **Test frontend features**
   - Visit https://sam.alontechnologies.com
   - Test login, signup, logout
   - Test task creation, editing, deletion
   - Test AI chat functionality
   - Check browser console for errors

4. **Check Railway logs**
   ```bash
   # Railway Dashboard → Backend Service → Logs
   # Look for:
   # - Security events (login attempts, failed auth)
   # - Error messages
   # - Performance metrics
   ```

### Security Testing

**Test these regularly:**

1. **Authentication**
   - Failed login (should log security event)
   - Account lockout after 5 failures
   - Token refresh works
   - Logout revokes token (Redis blacklist)

2. **Authorization**
   - Users can only see their own data
   - Tasks filtered by user_id
   - Chat history filtered by user_id

3. **Input Validation**
   - Weak passwords rejected
   - Email validation works
   - SQL injection attempts blocked (Pydantic + ORM)
   - XSS attempts sanitized

4. **Rate Limiting**
   - 100 requests/minute enforced
   - 429 status returned when exceeded
   - Logs show rate limit violations

5. **CORS**
   - Only `https://sam.alontechnologies.com` allowed
   - Credentials included in requests
   - Preflight requests work

6. **Security Headers**
   ```bash
   curl -I https://alon-assistant.up.railway.app/health

   # Should include:
   # Strict-Transport-Security: max-age=31536000; includeSubDomains
   # X-Content-Type-Options: nosniff
   # X-Frame-Options: DENY
   # Content-Security-Policy: default-src 'self'
   # X-XSS-Protection: 1; mode=block
   ```

---

## Security Implementation

### Current Security Features

✅ **Implemented:**

1. **Authentication & Authorization**
   - JWT tokens (1-hour access, 7-day refresh)
   - Redis token blacklist for immediate revocation
   - Bcrypt password hashing (12 rounds)
   - NIST SP 800-63B password validation
   - Have I Been Pwned API breach checking

2. **Account Protection**
   - Account lockout after 5 failed attempts
   - 30-minute automatic unlock
   - Last login tracking
   - Failed login attempt logging

3. **API Security**
   - Rate limiting (100 req/min per IP)
   - OWASP security headers
   - CORS restricted to production domain
   - Request size limits (10MB max)
   - Input validation (Pydantic)

4. **Database Security**
   - PostgreSQL encryption at rest (Railway)
   - Connection pooling with timeouts
   - Parameterized queries (SQLAlchemy ORM)
   - Row-level security (user_id filtering)

5. **Logging & Monitoring**
   - Security event logging (JSON format)
   - Failed login tracking
   - Error logging with stack traces
   - Railway automatic log retention

6. **Production Hardening**
   - HSTS enabled (1 year)
   - HTTPS only (Railway enforced)
   - Environment validation on startup
   - Secrets in Railway dashboard only

### Password Requirements

```python
# Implemented in backend/auth/utils.py
def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    NIST SP 800-63B compliant password validation
    """
    # Minimum length: 12 characters
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"

    # Maximum length: 128 characters (prevent DoS)
    if len(password) > 128:
        return False, "Password must be less than 128 characters"

    # Require complexity
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)

    if not (has_upper and has_lower and has_digit and has_special):
        return False, "Password must contain uppercase, lowercase, number, and special character"

    # Check against Have I Been Pwned
    if check_password_breach(password):
        return False, "Password has been exposed in a data breach"

    return True, "Password is strong"
```

### Security Headers

```python
# Implemented in backend/main.py
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # HSTS - Force HTTPS for 1 year
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # CSP - Only allow same-origin resources
        response.headers["Content-Security-Policy"] = "default-src 'self'"

        # XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response
```

---

## Deployment & Operations

### Pre-Deployment Checklist

Before deploying to production:

- [ ] All secrets in Railway dashboard (not in code)
- [ ] `ENVIRONMENT=production` set in Railway
- [ ] `CORS_ORIGINS` set to exact production domain
- [ ] `SECRET_KEY` generated with `secrets.token_urlsafe(32)`
- [ ] PostgreSQL database provisioned in Railway
- [ ] Redis provisioned in Railway
- [ ] Database migrations run (`alembic upgrade head`)
- [ ] Frontend `VITE_API_BASE_URL` points to production
- [ ] Test signup, login, tasks, chat in production
- [ ] Check Railway logs for errors
- [ ] Verify security headers with `curl -I`
- [ ] Test rate limiting
- [ ] Test account lockout
- [ ] Verify CORS works from production domain only

### Deployment Process

```bash
# 1. Commit changes (verify no secrets)
git log -p | grep -i "password\|secret\|api"  # Should show nothing

# 2. Push to GitHub
git push origin main

# 3. Railway auto-deploys (1-2 minutes)
# Watch deployment in Railway Dashboard

# 4. Verify deployment
curl https://alon-assistant.up.railway.app/health

# 5. Check logs
# Railway Dashboard → Backend Service → Logs

# 6. Test production
# Visit https://sam.alontechnologies.com
# Test all critical features
```

### Database Migrations

**Production migration process:**

```bash
# Migrations run automatically on Railway deployment
# But if manual migration needed:

# 1. Create migration (locally)
cd backend
alembic revision --autogenerate -m "Add new column"

# 2. Test migration (locally if safe, or directly in Railway)
alembic upgrade head

# 3. Commit migration file
git add alembic/versions/*.py
git commit -m "Add database migration: description"

# 4. Push to trigger deployment
git push origin main

# 5. Verify migration succeeded
# Railway logs should show: "Running alembic upgrade head"
# Check database schema in Railway PostgreSQL
```

### Rollback Procedure

If deployment fails:

```bash
# 1. Railway allows instant rollback
# Railway Dashboard → Deployments → Click previous deployment → "Redeploy"

# 2. Or revert git commit
git revert HEAD
git push origin main

# 3. Database rollback (if needed)
alembic downgrade -1  # Downgrade one migration
```

---

## Credential Management

### Generating Secrets

**SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Copy output to Railway Dashboard → Backend Service → Variables**

### Storing Credentials

✅ **ONLY store credentials in:**
- Railway dashboard environment variables
- Vercel dashboard environment variables
- Password managers (1Password, Bitwarden, etc.)
- Encrypted backup files (for database backups)

❌ **NEVER store credentials in:**
- Git repository
- `.env` files (these are gitignored but still risky)
- Documentation files
- Chat logs
- Code comments
- README files

### Credential Rotation

**When to rotate:**
- Immediately if credential exposed in git
- Immediately if credential shared insecurely
- Every 90 days for SECRET_KEY (best practice)
- Every 30 days for database password (if exposed)
- When team member leaves

**How to rotate DATABASE_URL:**

See [DATABASE_ROTATION_GUIDE.md](DATABASE_ROTATION_GUIDE.md) for complete process.

**Quick version:**
1. Create new PostgreSQL service in Railway
2. Run `migrate_database_secure.py` (prompts for credentials)
3. Update Railway backend `DATABASE_URL` to new database
4. Verify application works
5. Delete old database

**How to rotate SECRET_KEY:**

```bash
# 1. Generate new key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# 2. Update in Railway
# Railway Dashboard → Backend Service → Variables → SECRET_KEY

# 3. Railway auto-redeploys

# 4. All users must re-login (old tokens invalid)
```

**How to rotate ANTHROPIC_API_KEY:**

```bash
# 1. Generate new key at console.anthropic.com
# 2. Update in Railway
# Railway Dashboard → Backend Service → Variables → ANTHROPIC_API_KEY
# 3. Railway auto-redeploys
# 4. Delete old key from Anthropic console
```

### Emergency Credential Exposure

If credentials are committed to git:

```bash
# 1. IMMEDIATELY rotate all exposed credentials
# Follow rotation procedures above

# 2. Revoke exposed credentials
# - Railway: Create new database, delete old one
# - Anthropic: Delete API key from console.anthropic.com

# 3. Rewrite git history (CAREFUL!)
# Use BFG Repo-Cleaner or git filter-branch
# Then force push: git push --force origin main

# 4. Notify team (if applicable)

# 5. Monitor logs for unauthorized access
# Check Railway logs for suspicious activity

# 6. Update all documentation
# Remove exposed credentials from docs
```

---

## Monitoring & Incident Response

### Railway Logs

**View logs:**
```bash
# Web dashboard
Railway Dashboard → Backend Service → Logs

# Or CLI
npm install -g @railway/cli
railway login
railway logs
```

**What to monitor:**

1. **Security events:**
   ```json
   {
     "event": "security",
     "type": "failed_login",
     "email": "user@example.com",
     "ip": "1.2.3.4",
     "user_agent": "Mozilla/5.0...",
     "reason": "Invalid password"
   }
   ```

2. **Account lockouts:**
   ```json
   {
     "event": "security",
     "type": "account_locked",
     "email": "user@example.com",
     "failed_attempts": 5
   }
   ```

3. **Token blacklist failures:**
   ```json
   {
     "event": "error",
     "message": "Failed to blacklist token",
     "token_jti": "abc123"
   }
   ```

4. **Rate limiting:**
   ```json
   {
     "event": "rate_limit",
     "ip": "1.2.3.4",
     "endpoint": "/api/v1/auth/login"
   }
   ```

### Incident Response

**Failed login spike:**
1. Check Railway logs for IP addresses
2. Verify rate limiting is working
3. Check if account lockouts triggered
4. Consider temporary IP blocking if needed

**Database connection errors:**
1. Check Railway PostgreSQL status
2. Verify connection pool settings
3. Check for connection leaks in code
4. Consider increasing pool size

**Redis connection failures:**
1. Check Railway Redis status
2. Verify REDIS_URL is correct
3. App continues working (tokens not blacklisted)
4. Restore Redis ASAP for security

**Unusual API usage:**
1. Check logs for patterns
2. Identify user or IP
3. Verify not automated attack
4. Consider rate limit adjustments

**Data breach suspected:**
1. IMMEDIATELY rotate all credentials
2. Review logs for unauthorized access
3. Notify affected users
4. Contact security team/legal

---

## Additional Security Measures (Roadmap)

See [SECURITY_AUDIT_ADDITIONAL_MEASURES.md](SECURITY_AUDIT_ADDITIONAL_MEASURES.md) for complete list.

**High Priority (Next 30 days):**
1. ✅ Database password rotation (COMPLETED)
2. ⬜ Secrets scanning pre-commit hooks
3. ⬜ Automated database backups
4. ⬜ Dependency vulnerability scanning
5. ⬜ Security monitoring/alerting

**Medium Priority (Next 90 days):**
6. ⬜ Distributed rate limiting (Redis-based)
7. ⬜ Refresh token rotation
8. ⬜ GDPR data export
9. ⬜ Error handling improvements
10. ⬜ Audit logging

**Long-term (6+ months):**
11. ⬜ Multi-factor authentication
12. ⬜ Advanced anomaly detection
13. ⬜ SOC 2 compliance

---

## Quick Reference

### What Goes Where

| Item | Storage Location | ❌ Never |
|------|-----------------|----------|
| `SECRET_KEY` | Railway Dashboard | Git, code, docs |
| `ANTHROPIC_API_KEY` | Railway Dashboard | Git, code, docs |
| `DATABASE_URL` | Railway (auto) | Git, code, docs |
| `REDIS_URL` | Railway (auto) | Git, code, docs |
| Code changes | Git repository | Secrets, credentials |
| Documentation | Git repository | Passwords, API keys |
| Database backups | Encrypted storage | Git repository |
| Environment config | Railway dashboard | `.env` files in git |

### Testing Checklist

Before merging to main:

- [ ] Code changes pushed to git
- [ ] No credentials in code or commit history
- [ ] Railway deployed successfully
- [ ] Health check returns 200
- [ ] Login/signup works
- [ ] Tasks CRUD works
- [ ] AI chat works
- [ ] CORS works from production domain
- [ ] Rate limiting works (test 100+ requests)
- [ ] Security headers present (`curl -I`)
- [ ] Railway logs show no errors
- [ ] Frontend loads without errors

---

**Last Updated:** 2025-01-13
**Next Review:** 2025-02-13

**Security Contact:** Check Railway logs and documentation for any security concerns.
