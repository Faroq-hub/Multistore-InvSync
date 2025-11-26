# Railway Health Check Fix

## Issue: Health Check Failing After Successful Build

**Symptom:** Build completes successfully, but health checks fail with "service unavailable".

## Root Causes

1. **Database connection failures** - Server crashes if database is unreachable
2. **Migration blocking startup** - Migrations run before server is ready
3. **Missing error handling** - Unhandled errors crash the server
4. **Port configuration** - Server not listening on correct port

## Fixes Applied

### 1. Made Health Endpoint Available Immediately

The health endpoint (`/health`) is now registered before migrations run, so it's available as soon as the server starts listening.

### 2. Non-Blocking Migrations

Migrations now run in the `onReady` hook with error handling:
- If migration fails, server continues running (might already be migrated)
- Errors are logged but don't crash the server
- Health endpoint remains available

### 3. Improved Error Handling

- Added try-catch blocks around migrations and worker startup
- Server logs errors but continues running
- Better error messages for debugging

### 4. Verify Environment Variables

Ensure these are set in Railway:
- `DATABASE_URL` (auto-set by Railway if using PostgreSQL addon)
- `PORT` (auto-set by Railway)
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `ENCRYPTION_KEY`
- `ADMIN_TOKEN`
- `APP_URL` (your Railway app URL)

## Testing Locally

Test the server startup:
```bash
# Build
npm run build

# Start (should work even without DATABASE_URL for SQLite)
node dist/index.js

# In another terminal, test health endpoint
curl http://localhost:3000/health
# Should return: {"ok":true}
```

## Debugging Railway Deployment

1. **Check Railway Logs:**
   - Go to Railway → Your Service → Deployments → Latest → View Logs
   - Look for:
     - "Server listening on [port]"
     - Database connection errors
     - Migration errors
     - Any crash messages

2. **Verify Database Connection:**
   - Ensure PostgreSQL addon is running
   - Check `DATABASE_URL` is set correctly
   - Test connection manually if possible

3. **Check Port:**
   - Railway sets `PORT` automatically
   - Server listens on `0.0.0.0` (already configured)
   - Health check uses `/health` path (configured in railway.json)

4. **Manual Health Check:**
   - After deployment, try accessing: `https://your-app.up.railway.app/health`
   - Should return: `{"ok":true}`

## If Health Check Still Fails

1. **Check Railway logs** for specific error messages
2. **Verify DATABASE_URL** is set and PostgreSQL is running
3. **Test health endpoint manually** after deployment
4. **Check if server is actually starting** - look for "Server listening" in logs
5. **Verify all required environment variables** are set

## Next Steps

1. Commit and push the changes
2. Monitor Railway deployment logs
3. Check if server starts successfully
4. Verify health endpoint responds

