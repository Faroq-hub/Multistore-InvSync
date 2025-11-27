# Railway PostgreSQL Setup - Complete Guide

## Current Status
✅ Deployment is successful and running
✅ Server is healthy and responding
❌ **DATABASE_URL is not set** - app is using SQLite instead of PostgreSQL

## Step-by-Step Setup

### Step 1: Check if PostgreSQL Service Exists

1. Go to your Railway project: https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c
2. Look at the Architecture/Canvas view
3. Check if you see a **PostgreSQL** service (green box with database icon)

**If PostgreSQL service EXISTS:**
- Go to Step 2

**If PostgreSQL service DOES NOT EXIST:**
- Go to Step 1A below

---

### Step 1A: Create PostgreSQL Service

1. In Railway project dashboard, click **"+ New"** button (top right or in the canvas)
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically:
   - Create the PostgreSQL service
   - Generate connection credentials
   - Create `DATABASE_URL` environment variable automatically

**✅ PostgreSQL service created!**

---

### Step 2: Connect PostgreSQL to Web Service

**Option A: If Railway auto-created DATABASE_URL (Recommended)**
- Railway automatically shares `DATABASE_URL` from PostgreSQL service to your web service
- Skip to Step 3 to verify

**Option B: Manual Connection (if needed)**
1. Go to your **web service** → **Variables** tab
2. Click **"New Variable"**
3. Name: `DATABASE_URL`
4. Value: Get from PostgreSQL service:
   - Go to PostgreSQL service → **Variables** tab
   - Find `DATABASE_URL` or `POSTGRES_URL`
   - Copy the value
   - Paste it in the web service's `DATABASE_URL` variable

---

### Step 3: Verify DATABASE_URL is Set

1. Go to your **web service** → **Variables** tab
2. Look for `DATABASE_URL` in the list
3. It should show a value like: `postgresql://postgres:password@hostname:5432/railway`

**✅ If you see DATABASE_URL with a value, you're done!**

---

### Step 4: Wait for Redeployment

After setting `DATABASE_URL`:
1. Railway will automatically redeploy your service
2. Go to **Deployments** tab
3. Wait for the new deployment to complete (usually 2-3 minutes)
4. Check the logs to verify it's using PostgreSQL

---

### Step 5: Verify PostgreSQL is Being Used

1. Go to **Deployments** tab → Click on the latest deployment → **Deploy Log**
2. Look for these log messages:
   ```
   [DB] Using PostgreSQL database: postgresql://...
   [DB] Migration completed
   ```
3. You should **NOT** see:
   ```
   [DB] Using SQLite database: /app/data/app.db
   ```

**✅ If you see PostgreSQL connection, setup is complete!**

---

### Step 6: Test the Application

1. **Health Check:**
   ```bash
   curl https://web-production-33f26.up.railway.app/health
   ```
   Should return: `{"ok":true,"timestamp":"..."}`

2. **Test in Browser:**
   - Open your Shopify app
   - Verify connections are working
   - Check that data persists (not using SQLite)

---

## Troubleshooting

### Problem: DATABASE_URL not showing in web service

**Solution:**
1. Go to PostgreSQL service → **Variables** tab
2. Find `DATABASE_URL` or `POSTGRES_URL`
3. Copy the value
4. Go to web service → **Variables** → **New Variable**
5. Name: `DATABASE_URL`, Value: (paste the connection string)

### Problem: Still using SQLite after setting DATABASE_URL

**Solution:**
1. Check the variable name is exactly `DATABASE_URL` (case-sensitive)
2. Verify the value is a valid PostgreSQL connection string
3. Check deployment logs for connection errors
4. Restart the service: Go to service → **Settings** → **Restart**

### Problem: Migration errors

**Solution:**
The app automatically runs migrations on startup. If you see errors:
1. Check PostgreSQL service is running (green status)
2. Verify `DATABASE_URL` is correct
3. Check deployment logs for specific error messages

---

## Quick Reference

**Railway Project URL:**
https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c

**Web Service URL:**
https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d

**Variables Tab:**
https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables

**App URL:**
https://web-production-33f26.up.railway.app

---

## Next Steps After Setup

1. ✅ Verify PostgreSQL is being used (check logs)
2. ✅ Test the application
3. ✅ Push your latest commits (if not already pushed)
4. ✅ Monitor the deployment for any issues

---

## Summary

**What we're doing:**
- Creating/connecting PostgreSQL database
- Setting `DATABASE_URL` environment variable
- Verifying the app uses PostgreSQL instead of SQLite

**Why this matters:**
- SQLite is not suitable for production (file-based, no concurrent writes)
- PostgreSQL is production-ready (handles multiple users, transactions, etc.)
- Your app already supports PostgreSQL - just needs the connection string!

