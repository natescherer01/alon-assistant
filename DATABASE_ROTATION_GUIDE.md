# Safe Database Password Rotation Guide

**Goal:** Rotate database credentials without losing any data

**Current Database State:**
- 5 users
- 54 tasks
- 27 chat messages
- All data will be preserved ✅

---

## Method 1: Railway Automatic Rotation (RECOMMENDED)

This is the **easiest and safest** method. Railway handles everything automatically.

### Steps:

1. **Login to Railway**
   - Go to https://railway.app
   - Login to your account
   - Select your project (alon-assistant)

2. **Find PostgreSQL Service**
   - You should see a "PostgreSQL" service in your project
   - Click on it

3. **Look for Credential Rotation**

   **Option A: If you see "Rotate Credentials" button:**
   - Go to **"Settings"** tab
   - Scroll to find **"Rotate Credentials"** or **"Reset Password"**
   - Click it
   - Confirm the rotation
   - **Done!** Railway updates DATABASE_URL automatically

   **Option B: If you don't see that button:**
   - Railway might auto-rotate when you redeploy
   - Or try Method 2 below (create new database)

4. **Verify It Worked**
   - Wait 1-2 minutes for Railway to update environment variables
   - Your backend will automatically restart with new credentials
   - Test login at: https://sam.alontechnologies.com
   - If login works, rotation was successful!

5. **Confirm Data Intact**
   - Login to your app
   - Check that your tasks are still there
   - Check that chat history is preserved

**That's it!** Railway handles the password rotation automatically. No data loss.

---

## Method 2: Create New Database & Migrate (If Method 1 Unavailable)

If Railway doesn't offer automatic credential rotation, create a new database and migrate data.

### Prerequisites:

1. **Install PostgreSQL tools:**
   ```bash
   brew install postgresql
   ```

2. **Verify tools installed:**
   ```bash
   pg_dump --version
   psql --version
   ```

### Steps:

#### Step 1: Create New Database in Railway

1. Go to Railway dashboard
2. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
3. Railway creates a new PostgreSQL database with fresh credentials
4. Click on the new database service
5. Go to **"Variables"** tab
6. **Copy the DATABASE_URL** (this has new, secure credentials)
7. Save it somewhere safe (you'll need it in Step 3)

#### Step 2: Run Migration Script

1. **Update the migration script:**
   ```bash
   cd "/Users/natescherer/Developer/personal AI"
   nano migrate_database_safely.py
   ```

2. **Replace the NEW_DB_URL line:**
   ```python
   # Find this line:
   NEW_DB_URL = "postgresql://postgres:NEW_PASSWORD@NEW_HOST:PORT/railway"

   # Replace with your NEW database URL from Railway:
   NEW_DB_URL = "postgresql://postgres:ACTUAL_NEW_PASSWORD@actual.host:12345/railway"
   ```

3. **Save and exit:** `Ctrl+X`, `Y`, `Enter`

4. **Run the migration:**
   ```bash
   python3 migrate_database_safely.py
   ```

5. **Follow the prompts:**
   - Script will create a backup
   - Migrate data to new database
   - Verify all data transferred correctly

#### Step 3: Update Railway Environment Variables

1. Go to Railway dashboard
2. Click on your **backend service** (not the database)
3. Go to **"Variables"** tab
4. Find **DATABASE_URL**
5. **Update it** with the NEW database URL (from Step 1)
6. Click **"Save"** or it auto-saves

#### Step 4: Redeploy Backend

Railway will automatically redeploy when you change environment variables.

**Or manually trigger:**
1. Go to **"Deployments"** tab
2. Click **"Deploy"**

#### Step 5: Verify Everything Works

1. Wait for deployment to complete (1-2 minutes)
2. Go to https://sam.alontechnologies.com
3. **Login** with your credentials
4. **Check your tasks** - should all be there
5. **Check chat history** - should be preserved

#### Step 6: Delete Old Database

**ONLY after confirming everything works:**

1. Go to Railway dashboard
2. Click on the **OLD PostgreSQL service** (the one with compromised credentials)
3. Go to **"Settings"** → **"Danger Zone"**
4. Click **"Delete Service"**
5. Confirm deletion

The old database (with exposed password) is now gone! ✅

#### Step 7: Keep Backup Safe

The migration script created a backup file:
```
backup_production_YYYYMMDD_HHMMSS.sql
```

**Store this somewhere safe:**
- External hard drive
- Cloud storage (encrypted)
- Keep for at least 30 days

---

## Verification Checklist

After rotation, verify:

- [ ] Can login at https://sam.alontechnologies.com
- [ ] All 5 users still exist
- [ ] All 54 tasks visible and correct
- [ ] All 27 chat messages preserved
- [ ] New tasks can be created
- [ ] Chat still works
- [ ] No errors in Railway logs

**If anything doesn't work:**
1. DON'T delete the old database yet
2. Restore the DATABASE_URL to the old value
3. Investigate the issue
4. Contact me for help

---

## Expected Results

### Before Rotation:
- Database URL: `postgresql://postgres:gWQAnFlcSsawPQeFIYJLciNxOPRnLWDz@...`
- Password: `gWQAnFlcSsawPQeFIYJLciNxOPRnLWDz` (⚠️ exposed)
- Data: 5 users, 54 tasks, 27 messages

### After Rotation:
- Database URL: `postgresql://postgres:NEW_SECURE_PASSWORD@...`
- Password: New, secure, NOT in git history
- Data: 5 users, 54 tasks, 27 messages (unchanged)
- Old password no longer works

---

## Troubleshooting

### "Connection refused" after rotation

**Cause:** DATABASE_URL not updated in Railway

**Fix:**
1. Go to Railway backend service
2. Check "Variables" tab
3. Ensure DATABASE_URL matches your NEW database

### "Login fails" after rotation

**Cause:** Backend hasn't redeployed with new DATABASE_URL

**Fix:**
1. Go to Railway backend service
2. Click "Deployments"
3. Click "Deploy" to trigger redeploy
4. Wait 2 minutes

### "Data missing" after rotation

**Cause:** Migration didn't complete

**Fix:**
1. Restore DATABASE_URL to old database
2. Check migration script output for errors
3. Re-run migration script
4. Verify data counts match before switching

### Migration script fails

**Common issues:**
- `pg_dump: command not found` → Install: `brew install postgresql`
- `Permission denied` → Make script executable: `chmod +x migrate_database_safely.py`
- `Connection error` → Check DATABASE_URL is correct

---

## Which Method Should I Use?

**Use Method 1 (Railway Automatic) if:**
- Railway offers a "Rotate Credentials" button ✅
- You want the easiest, fastest option ✅
- You want Railway to handle everything ✅

**Use Method 2 (New Database) if:**
- Railway doesn't have automatic rotation
- You want complete control over the process
- You want to verify data migration yourself

**Both methods are safe and preserve all data!**

---

## Questions?

- **Will I lose data?** No, both methods preserve all data
- **How long does it take?** Method 1: 2 minutes. Method 2: 10-15 minutes
- **Is there downtime?** Method 1: ~30 seconds. Method 2: ~2 minutes
- **Can I rollback?** Method 1: No easy rollback. Method 2: Yes (keep old database until verified)

---

**Recommendation:** Try Method 1 first. If Railway doesn't offer automatic rotation, use Method 2.

**Next:** Once password is rotated, implement additional security measures from [SECURITY_AUDIT_ADDITIONAL_MEASURES.md](SECURITY_AUDIT_ADDITIONAL_MEASURES.md)
