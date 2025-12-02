# Microsoft Outlook Integration - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
✅ Azure AD app configured with permissions
✅ Environment variables set in `.env`
✅ Database migration applied
✅ Prisma client generated

---

## Step 1: Start the Application

```bash
# Terminal 1 - Backend
cd /Users/natescherer/alon-cal/backend
npm run dev

# Terminal 2 - Frontend
cd /Users/natescherer/alon-cal/frontend
npm run dev
```

---

## Step 2: Test OAuth Flow

1. Open browser: http://localhost:5173
2. Go to "Connect Calendar" or Settings
3. Click **"Connect Outlook"** button
4. Sign in with Microsoft account
5. Grant permissions
6. Select calendars to sync
7. Done! Events appear in 30 seconds

---

## ⚠️ Important: Security Warning

**The integration works but has 3 CRITICAL security vulnerabilities.**

### Before Production:
1. 🔴 Fix webhook authentication
2. 🔴 Encrypt clientState in database
3. 🟡 Add replay attack protection

**See:** [SECURITY_FIXES_REQUIRED.md](SECURITY_FIXES_REQUIRED.md)

**Estimated fix time:** 1-2 days

---

## ✅ What Works Now

- ✅ Connect Microsoft accounts
- ✅ Sync personal + shared calendars
- ✅ View events with Teams meeting links
- ✅ See importance badges and categories
- ✅ Manual sync trigger
- ✅ Disconnect calendars

---

## ⚠️ What's Not Production-Ready

- ❌ Webhook endpoint security
- ❌ Production HTTPS deployment
- ❌ ClientState encryption

---

## 📚 Documentation

- **Setup Guide**: [docs/integrations/MICROSOFT_SETUP_COMPLETE.md](docs/integrations/MICROSOFT_SETUP_COMPLETE.md)
- **Security Fixes**: [docs/security/SECURITY_FIXES_REQUIRED.md](docs/security/SECURITY_FIXES_REQUIRED.md)
- **Technical Docs**: [backend/MICROSOFT_INTEGRATION.md](backend/MICROSOFT_INTEGRATION.md)
- **Test Report**: [docs/reports/TEST_REPORT_MICROSOFT_OUTLOOK.md](docs/reports/TEST_REPORT_MICROSOFT_OUTLOOK.md)
- **All Documentation**: [docs/README.md](docs/README.md)

---

## 🆘 Troubleshooting

**OAuth fails?**
→ Check redirect URI in Azure AD matches `.env`

**Events not syncing?**
→ Check backend logs, verify calendar connection

**Teams links not clickable?**
→ Check event has `teamsEnabled: true` in database

**Webhook subscription fails?**
→ Expected in development (needs HTTPS)

---

## 🎯 Next Steps

1. **Test the integration** (development only)
2. **Fix security issues** (before production)
3. **Deploy with HTTPS** (webhooks require it)
4. **Run full test suite** (`./RUN_TESTS.sh`)
5. **Setup monitoring** (alerts, logs)

---

## 💡 Quick Commands

```bash
# Run tests
./RUN_TESTS.sh

# Check database
psql $DATABASE_URL -c "SELECT * FROM calendar_connections WHERE provider = 'MICROSOFT';"

# View webhook subscriptions
psql $DATABASE_URL -c "SELECT * FROM webhook_subscriptions;"

# Trigger manual sync (in app)
# Click sync icon on calendar card
```

---

**Ready to test? Start both servers and visit http://localhost:5173!** 🚀

**Ready for production? Fix the 3 security issues first!** 🔒
