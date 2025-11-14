# Documentation Index

Quick reference guide to all project documentation.

---

## Core Documentation

### [README.md](README.md)
**Project overview and quick start guide**

- Project architecture and tech stack
- Production-first development approach
- Security features (OWASP/NIST compliant)
- API documentation links
- Environment variables reference
- Troubleshooting production issues

**Start here** if you're new to the project.

---

### [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) ⭐ **MOST IMPORTANT**
**Master security guide - READ THIS FIRST**

Complete security practices and development workflow:

**Core Principles:**
- Production-first development (no localhost testing)
- Zero trust architecture (no credentials in git)
- Security by default (all features enabled)

**Absolute No-Gos:**
1. ❌ NEVER commit credentials to git
2. ❌ NEVER use localhost for production testing
3. ❌ NEVER hardcode secrets in code
4. ❌ NEVER use wildcards in CORS
5. ❌ NEVER store secrets in documentation
6. ❌ NEVER skip security validation
7. ❌ NEVER delete production data without backup
8. ❌ NEVER share credentials in plain text
9. ❌ NEVER trust user input
10. ❌ NEVER ignore security warnings

**Covers:**
- Development workflow
- Testing strategy (production testing)
- Security implementation details
- Deployment procedures
- Credential management
- Monitoring & incident response
- Emergency procedures

**Read this before writing any code.**

---

## Deployment Documentation

### [DEPLOYMENT.md](DEPLOYMENT.md)
**Complete guide to deploying on Railway & Vercel**

**Step-by-step:**
1. Deploy backend to Railway
2. Add PostgreSQL and Redis
3. Configure environment variables (SECURITY CRITICAL)
4. Deploy frontend to Vercel
5. Update CORS settings
6. Run database migrations
7. Test and verify

**Includes:**
- Environment variable configuration
- Security checklist (comprehensive)
- Testing & verification procedures
- Troubleshooting common issues
- Cost breakdown

**Use this when deploying to production.**

---

### [RAILWAY_ENVIRONMENT_SETUP.md](RAILWAY_ENVIRONMENT_SETUP.md)
**Detailed guide to Railway environment variables**

**Required variables:**
- `SECRET_KEY` - JWT signing (generate locally, NEVER commit)
- `ANTHROPIC_API_KEY` - Claude API access
- `ENVIRONMENT` - Must be "production"
- `CORS_ORIGINS` - Exact production domain (no wildcards)

**Auto-configured by Railway:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection

**Recommended:**
- `ACCESS_TOKEN_EXPIRE_MINUTES=30` (shorter = more secure)
- `REFRESH_TOKEN_EXPIRE_DAYS=7`

**Each variable includes:**
- Purpose and security requirements
- How to generate/find the value
- What NOT to do (security warnings)
- Testing procedures

**Reference this when configuring Railway.**

---

## Security & Operations

### [backend/ENCRYPTION_GUIDE.md](backend/ENCRYPTION_GUIDE.md) ⭐ **NEW**
**Field-level encryption for sensitive data**

**What's encrypted:**
- User emails, names
- Chat messages and responses
- Task titles and descriptions

**Features:**
- AES-128-CBC + HMAC-SHA256 (Fernet)
- Key management via Secrets Manager
- Zero-downtime migration
- Prometheus monitoring
- **Security rating: 95/100** (production-ready)

**Quick start:**
1. Generate encryption key
2. Run migration
3. Encrypt existing data

**See also:** [backend/PRODUCTION_DEPLOYMENT_RUNBOOK.md](backend/PRODUCTION_DEPLOYMENT_RUNBOOK.md) for detailed deployment procedures.

---

### [DATABASE_ROTATION_GUIDE.md](DATABASE_ROTATION_GUIDE.md)
**How to rotate database credentials safely**

**When to use:**
- Database password exposed in git
- Credential compromise suspected
- Regular security maintenance (90-day rotation)

**Process:**
1. Create new PostgreSQL service in Railway
2. Run `migrate_database_secure.py` (prompts for credentials)
3. Verify data integrity
4. Update Railway backend `DATABASE_URL`
5. Test application
6. Delete old database

**Includes:**
- Step-by-step migration process
- Data verification procedures
- Rollback instructions
- Troubleshooting

**Use this if credentials are ever exposed.**

---

### [SECURITY_AUDIT_ADDITIONAL_MEASURES.md](SECURITY_AUDIT_ADDITIONAL_MEASURES.md)
**Roadmap of additional security improvements**

**15 additional security measures prioritized:**

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

**Use this to plan future security enhancements.**

---

## Scripts & Tools

### [migrate_database_secure.py](migrate_database_secure.py)
**Secure database migration script**

**Features:**
- Prompts for credentials (never hardcoded)
- Verifies connections before migrating
- Shows data counts (users, tasks, chats)
- Creates local backup
- Migrates data using pg_dump/psql
- Verifies data integrity
- Provides next steps

**Usage:**
```bash
python3 migrate_database_secure.py
# Follow prompts to enter OLD and NEW database URLs
# Script handles backup, migration, and verification
```

**Requirements:**
- PostgreSQL 17 client tools installed
- Railway database URLs (from Variables tab)
- Public proxy hostnames (`.proxy.rlwy.net`, NOT `.railway.internal`)

**Use this for database credential rotation.**

---

## Quick Reference

### What Goes Where

| Item | Storage Location | ❌ Never Store In |
|------|-----------------|-------------------|
| `SECRET_KEY` | Railway Dashboard | Git, code, docs |
| `ANTHROPIC_API_KEY` | Railway Dashboard | Git, code, docs |
| `DATABASE_URL` | Railway (auto) | Git, code, docs |
| `REDIS_URL` | Railway (auto) | Git, code, docs |
| Code changes | Git repository | With credentials |
| Documentation | Git repository | With passwords |
| Database backups | Encrypted storage | Git repository |
| Environment config | Railway dashboard | `.env` files in git |

---

### Testing Checklist

Before merging to main:

- [ ] No credentials in code: `git log -p | grep -i "password\|secret\|api"`
- [ ] Railway deployed successfully
- [ ] Health check: `curl https://alon-assistant.up.railway.app/health`
- [ ] Login/signup works at https://sam.alontechnologies.com
- [ ] Tasks CRUD works
- [ ] AI chat works
- [ ] CORS works from production domain
- [ ] Rate limiting works (test 100+ requests)
- [ ] Security headers: `curl -I https://alon-assistant.up.railway.app/health`
- [ ] Railway logs show no errors

---

### Emergency Contacts

**If credentials are exposed:**
1. **IMMEDIATELY** rotate all credentials
2. Follow [DATABASE_ROTATION_GUIDE.md](DATABASE_ROTATION_GUIDE.md)
3. Check Railway logs for unauthorized access
4. Revoke old credentials in Railway/Anthropic console
5. Consider rewriting git history (careful!)

**If production is down:**
1. Check Railway logs: Railway Dashboard → Backend Service → Logs
2. Check Railway service status
3. Verify environment variables are set
4. Try manual redeploy: Railway → Deployments → Redeploy
5. Check database/Redis status

**Security incident:**
1. Review [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) → Incident Response
2. Check logs for suspicious activity
3. Rotate credentials immediately
4. Document incident

---

## Current Production Environment

- **Backend:** https://alon-assistant.up.railway.app
- **Frontend:** https://sam.alontechnologies.com
- **Database:** Railway PostgreSQL (managed)
- **Cache:** Railway Redis (managed)
- **Hosting:** Railway (backend) + Vercel (frontend)

**API Docs:** https://alon-assistant.up.railway.app/docs

---

## Documentation Hierarchy

```
START HERE
    ↓
[README.md] ──────────────────────┐
    ↓                             │
[SECURITY_AND_BEST_PRACTICES.md]  │ Reference
    ↓                             │ as needed
DEPLOYING?                        │
    ↓                             │
[DEPLOYMENT.md] ←─────────────────┤
    ↓                             │
[RAILWAY_ENVIRONMENT_SETUP.md]    │
    ↓                             │
ROTATING CREDENTIALS?             │
    ↓                             │
[DATABASE_ROTATION_GUIDE.md]      │
    ↓                             │
PLANNING SECURITY?                │
    ↓                             │
[SECURITY_AUDIT_ADDITIONAL_MEASURES.md]
```

---

**Last Updated:** 2025-01-13

**Maintained by:** Development Team

**Questions?** Check Railway logs first, then review relevant documentation above.
