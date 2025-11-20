# How to Run Database Migration in Railway

## Problem: Can't Find "Shell" Button

Railway's interface may vary, or the Shell option might not be visible. Here are **all the ways** to run your database migration:

---

## Method 1: Railway CLI (Easiest & Recommended) ✅

### Step 1: Install Railway CLI

**macOS:**
```bash
brew install railway
```

**Windows/Linux:**
- Download from: https://docs.railway.app/develop/cli
- Or use npm: `npm i -g @railway/cli`

### Step 2: Login

```bash
railway login
```

This opens your browser to authenticate.

### Step 3: Link to Your Project

```bash
railway link
```

Select your project when prompted.

### Step 4: Run Migration

```bash
railway run npm run migrate:postgres
```

That's it! You'll see the migration output in your terminal.

---

## Method 2: Railway Dashboard - Service Settings

### Alternative Location for Shell/Commands:

1. **Go to your service** (the web service, not PostgreSQL)
2. **Click "Settings" tab**
3. **Scroll down** to find:
   - "Run Command" option
   - "One-off Command" option
   - Or "Execute Command" button

4. **Enter command:**
   ```
   npm run migrate:postgres
   ```

5. **Click "Run"**

---

## Method 3: Direct PostgreSQL Connection

### Connect to PostgreSQL and Run SQL Manually:

1. **Go to your PostgreSQL service** in Railway
2. **Click "Connect" or "Data" tab**
3. **Copy connection details:**
   - Host
   - Port
   - Database
   - User
   - Password

4. **Connect using a PostgreSQL client:**

   **Option A: Using psql (command line)**
   ```bash
   psql $DATABASE_URL -f src/db/postgres-migration.sql
   ```

   **Option B: Using pgAdmin or DBeaver**
   - Create new connection with Railway credentials
   - Open SQL editor
   - Copy contents of `src/db/postgres-migration.sql`
   - Paste and execute

   **Option C: Using Railway's Query Interface**
   - Some Railway plans have a built-in query interface
   - Look for "Query" or "SQL" tab in PostgreSQL service
   - Paste and run the migration SQL

---

## Method 4: Add Migration to Startup Script

### Automatically run migration on startup:

1. **Create/Update `scripts/start.sh`:**
   ```bash
   #!/bin/bash
   set -e
   
   # Run migration if using PostgreSQL
   if [ -n "$DATABASE_URL" ]; then
     echo "Running PostgreSQL migration..."
     npm run migrate:postgres || echo "Migration failed or already run"
   fi
   
   # Start the application
   exec npm start
   ```

2. **Update `package.json`:**
   ```json
   {
     "scripts": {
       "start": "bash scripts/start.sh"
     }
   }
   ```

3. **Deploy** - Migration runs automatically on startup

**Note:** This runs migration on every deploy. Add a check to only run if needed.

---

## Method 5: Railway API (Advanced)

If you have Railway API access:

```bash
# Get your project ID and service ID from Railway dashboard
# Then use Railway API to execute command

curl -X POST \
  https://api.railway.app/v1/services/{serviceId}/execute \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -d '{"command": "npm run migrate:postgres"}'
```

---

## Method 6: Using Docker/Container (If Applicable)

If Railway is using Docker:

1. **SSH into container** (if Railway provides SSH access)
2. **Run migration command directly**

---

## Which Method Should I Use?

### ✅ **Recommended: Method 1 (Railway CLI)**
- Easiest to use
- Works reliably
- Can see output in real-time
- Can run multiple times safely

### 🥈 **Alternative: Method 2 (Dashboard)**
- No CLI installation needed
- Uses Railway web interface
- May not be available on all plans

### 🥉 **Fallback: Method 3 (Direct SQL)**
- Always works
- More manual
- Good for troubleshooting

### ⚡ **Auto: Method 4 (Startup Script)**
- Runs automatically
- No manual steps
- May run unnecessarily

---

## Troubleshooting

### "Command not found" error

**Problem:** `npm` or `psql` not found

**Solution:**
- Ensure you're running in the correct service (web service, not PostgreSQL)
- Check Node.js is installed in the environment
- Try: `which npm` or `which psql`

### "DATABASE_URL not set" error

**Problem:** Environment variable missing

**Solution:**
- Verify PostgreSQL service is created
- Check `DATABASE_URL` is in Variables tab
- Railway auto-sets this when PostgreSQL is added

### "Migration already exists" errors

**Problem:** Migration already ran

**Solution:**
- This is OK! Tables already exist
- You can safely ignore "already exists" errors
- Migration is idempotent (safe to run multiple times)

### "Permission denied" error

**Problem:** Database user doesn't have permissions

**Solution:**
- Check PostgreSQL service settings
- Verify user has CREATE TABLE permissions
- Contact Railway support if needed

---

## Verify Migration Succeeded

After running migration, verify it worked:

### Using Railway CLI:
```bash
railway run psql $DATABASE_URL -c "\dt"
```

Should show all tables:
- `installations`
- `connections`
- `jobs`
- `job_items`
- `audit_logs`
- etc.

### Using Dashboard:
1. Go to PostgreSQL service
2. Click "Connect" or "Data"
3. Use query interface to run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`

---

## Quick Reference

**Fastest way (if CLI installed):**
```bash
railway run npm run migrate:postgres
```

**If CLI not installed:**
1. Install: `brew install railway` (macOS)
2. Login: `railway login`
3. Link: `railway link`
4. Run: `railway run npm run migrate:postgres`

**Alternative (manual SQL):**
1. Get connection string from PostgreSQL service
2. Connect with psql or GUI client
3. Run SQL from `src/db/postgres-migration.sql`

---

## Need More Help?

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Check logs** in Railway dashboard for specific errors

