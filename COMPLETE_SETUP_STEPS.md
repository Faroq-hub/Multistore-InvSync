# Complete PostgreSQL Setup Steps

## Current Status
- ✅ Deployment: Successful
- ✅ Server: Running and healthy  
- ❌ Database: Using SQLite (needs PostgreSQL)
- ⚠️  function-bun service created (can be deleted later)

## Step-by-Step Instructions

### Step 1: Delete the function-bun Service (Optional)

1. Go to: https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c
2. Click on the **"function-bun"** service
3. Go to **Settings** tab
4. Scroll down and click **"Delete Service"**
5. Confirm deletion

### Step 2: Create PostgreSQL Service

**Option A: Using Railway Dashboard (Recommended)**

1. Go to your Railway project: https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c
2. Click the **"Create"** button (top right of canvas)
3. In the search box, type: **"postgresql"**
4. Select **"PostgreSQL"** from the dropdown
5. Railway will automatically:
   - Create the PostgreSQL service
   - Generate connection credentials
   - Create `DATABASE_URL` variable
   - Share it with your web service

**Option B: Using Railway CLI**

If you have Railway CLI installed and logged in:

```bash
cd /Users/FarooqK/reseller-feed-middleware
railway link  # Select your project
railway add postgresql
```

### Step 3: Verify DATABASE_URL is Set

1. Go to your **web service** → **Variables** tab:
   https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables

2. Look for **`DATABASE_URL`** in the list
3. It should show a value like: `postgresql://postgres:password@hostname:5432/railway`

**If DATABASE_URL is NOT there:**

1. Go to your **PostgreSQL service** → **Variables** tab
2. Find `DATABASE_URL` or `POSTGRES_URL`
3. Copy the value
4. Go back to **web service** → **Variables** → **"New Variable"**
5. Name: `DATABASE_URL`
6. Value: (paste the connection string)
7. Click **"Add"**

### Step 4: Wait for Redeployment

After setting `DATABASE_URL`:
1. Railway will automatically redeploy (you'll see a new deployment starting)
2. Wait 2-3 minutes for it to complete
3. Go to **Deployments** tab to monitor progress

### Step 5: Verify PostgreSQL is Being Used

1. Go to **Deployments** → Click on latest deployment → **Deploy Log**
2. Look for these log messages:
   ```
   [DB] Using PostgreSQL database: postgresql://...
   [DB] Migration completed
   ```
3. You should **NOT** see:
   ```
   [DB] Using SQLite database: /app/data/app.db
   ```

### Step 6: Test the Application

```bash
curl https://web-production-33f26.up.railway.app/health
```

Should return: `{"ok":true,"timestamp":"..."}`

---

## Quick Links

- **Project Dashboard:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c
- **Web Service Variables:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables
- **App URL:** https://web-production-33f26.up.railway.app

---

## Troubleshooting

### Problem: Can't find PostgreSQL option

**Solution:** 
- Try typing "postgres" or "database" in the search box
- Or use Railway CLI: `railway add postgresql`

### Problem: DATABASE_URL not showing in web service

**Solution:**
1. Go to PostgreSQL service → Variables
2. Copy `DATABASE_URL` value
3. Manually add it to web service → Variables → New Variable

### Problem: Still using SQLite after setup

**Solution:**
1. Verify variable name is exactly `DATABASE_URL` (case-sensitive)
2. Check the value is a valid PostgreSQL connection string
3. Restart the service: Settings → Restart

---

## Summary

**What we're doing:**
1. Creating PostgreSQL database service
2. Setting `DATABASE_URL` environment variable
3. Verifying app uses PostgreSQL instead of SQLite

**Why this matters:**
- SQLite is not suitable for production
- PostgreSQL handles multiple users, transactions, and concurrent writes
- Your app already supports PostgreSQL - just needs the connection!

**Time needed:** 5-10 minutes

---

## After Setup

Once PostgreSQL is working:
1. ✅ Your app will use PostgreSQL for all data
2. ✅ Data will persist across deployments
3. ✅ Multiple users can use the app simultaneously
4. ✅ Production-ready database setup

