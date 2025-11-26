# 🔧 PM2 Troubleshooting: Services Keep Crashing

## Problem

Your PM2 services are restarting repeatedly (showing 12-13 restarts, uptime 0). This means they're crashing immediately after starting.

---

## 🔍 Step 1: Check the Logs

**This is the most important step!** The logs will tell you exactly why it's crashing.

```bash
# View all logs
pm2 logs

# View only errors
pm2 logs --err

# View logs for specific service
pm2 logs reseller-backend --err
pm2 logs reseller-frontend --err

# View last 50 lines
pm2 logs --lines 50
```

**Look for error messages** - they'll tell you what's wrong!

---

## 🐛 Common Issues & Fixes

### Issue 1: Missing Environment Variables

**Symptoms:**
- Error about `DATABASE_URL` not set
- Error about `SHOPIFY_API_KEY` missing
- "Cannot find module" errors

**Fix:**
1. Make sure you have a `.env` file in your project root
2. Check that all required variables are set
3. PM2 should load `.env` automatically, but you can also set them in `ecosystem.config.js`

### Issue 2: Database Connection Failed

**Symptoms:**
- Error: "Cannot connect to database"
- Error: "DATABASE_URL not set"
- PostgreSQL connection errors

**Fix:**
1. Check if PostgreSQL is running:
   ```bash
   # If using Docker:
   docker ps
   
   # If using Homebrew:
   brew services list
   ```

2. Verify DATABASE_URL in `.env`:
   ```bash
   cat .env | grep DATABASE_URL
   ```

3. Test connection:
   ```bash
   # If using Docker:
   docker exec -it postgres-reseller psql -U postgres -d reseller_feed_middleware -c "SELECT 1;"
   ```

### Issue 3: Build Errors

**Symptoms:**
- TypeScript compilation errors
- "Cannot find module" errors
- Build script fails

**Fix:**
1. Build manually first:
   ```bash
   npm run build
   npm run build:next
   ```

2. Check for TypeScript errors:
   ```bash
   npm run typecheck
   ```

3. Make sure all dependencies are installed:
   ```bash
   npm install
   ```

### Issue 4: Port Already in Use

**Symptoms:**
- Error: "EADDRINUSE: address already in use :::3000"
- Error: "Port 3001 is already in use"

**Fix:**
1. Find what's using the port:
   ```bash
   lsof -i :3000
   lsof -i :3001
   ```

2. Kill the process:
   ```bash
   kill -9 <PID>
   ```

3. Or change ports in `.env`:
   ```env
   PORT=3002
   ```

### Issue 5: Missing Dependencies

**Symptoms:**
- "Cannot find module 'xxx'"
- Module not found errors

**Fix:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 🔧 Quick Diagnostic Commands

Run these to diagnose the issue:

```bash
# 1. Check if services are actually running
pm2 status

# 2. View error logs
pm2 logs --err --lines 100

# 3. Check if ports are available
lsof -i :3000
lsof -i :3001

# 4. Check if database is running
docker ps  # or: brew services list

# 5. Test database connection
psql $DATABASE_URL -c "SELECT 1;" 2>&1

# 6. Check if .env file exists and has variables
cat .env

# 7. Try running manually (to see errors)
npm start
npm run start:next
```

---

## ✅ Step-by-Step Fix Process

### 1. Stop PM2 Services

```bash
pm2 stop all
pm2 delete all
```

### 2. Check Logs First

```bash
# Check what errors occurred
pm2 logs --err --lines 50
```

### 3. Test Manually

**Test Backend:**
```bash
npm start
```

**Test Frontend (in another terminal):**
```bash
npm run start:next
```

**Look for error messages** - these will tell you what's wrong!

### 4. Fix the Issues

Based on the errors you see:
- Missing env vars → Add to `.env`
- Database error → Check PostgreSQL is running
- Build error → Run `npm run build` first
- Port conflict → Kill process or change port

### 5. Rebuild and Restart

```bash
# Build everything
npm run build
npm run build:next

# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs
```

---

## 📝 Updated ecosystem.config.js (With Environment Variables)

If PM2 isn't loading your `.env` file, you can set variables directly in the config:

```javascript
module.exports = {
  apps: [
    {
      name: 'reseller-backend',
      script: 'npm',
      args: 'start',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
        // Add other env vars here if needed
        // DATABASE_URL: 'postgresql://...',
        // SHOPIFY_API_KEY: '...',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    },
    {
      name: 'reseller-frontend',
      script: 'npm',
      args: 'run start:next',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
        // Add other env vars here if needed
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
```

**Note:** It's better to use a `.env` file, but this works if PM2 isn't loading it.

---

## 🎯 Most Likely Issues (Based on Your Setup)

Given that you just set up PostgreSQL, the most likely issues are:

### 1. DATABASE_URL Not Set

**Check:**
```bash
cat .env | grep DATABASE_URL
```

**Fix:** Add to `.env`:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/reseller_feed_middleware
```

### 2. PostgreSQL Not Running

**Check:**
```bash
docker ps
# or
brew services list
```

**Fix:** Start PostgreSQL:
```bash
# Docker:
docker start postgres-reseller

# Homebrew:
brew services start postgresql@15
```

### 3. App Not Built

**Fix:**
```bash
npm run build
npm run build:next
```

---

## 🚀 Quick Fix Checklist

Run these commands in order:

```bash
# 1. Stop PM2
pm2 stop all
pm2 delete all

# 2. Check logs (to see what failed)
pm2 logs --err --lines 50

# 3. Check .env exists
ls -la .env

# 4. Check database is running
docker ps  # or: brew services list

# 5. Build the app
npm run build
npm run build:next

# 6. Test manually first
npm start
# (In another terminal: npm run start:next)
# If these work, then PM2 should work too

# 7. Start with PM2
pm2 start ecosystem.config.js

# 8. Check status
pm2 status

# 9. View logs
pm2 logs
```

---

## 💡 Pro Tips

1. **Always check logs first** - `pm2 logs --err` will show you the exact error
2. **Test manually before PM2** - If `npm start` works, PM2 should work
3. **Build before starting** - Make sure code is compiled
4. **Check environment variables** - PM2 needs access to your `.env` file

---

**Run `pm2 logs --err` first to see what's actually failing!** 🔍

