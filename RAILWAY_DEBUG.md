# Railway Deployment Debugging Guide

## Current Issue: Health Check Failing

The build succeeds, but health checks fail. This means the server is either:
1. Not starting at all
2. Crashing immediately on startup
3. Not listening on the correct port
4. Database connection issue blocking startup

## Added Debugging

I've added console.log statements that will appear in Railway logs:
- `[Startup] Initializing server...`
- `[Startup] PORT: [port]`
- `[Startup] NODE_ENV: [env]`
- `[Startup] DATABASE_URL: Set/Not set`
- `[Startup] Starting server on port [port]`
- `[Startup] Server listening on [port]`

## How to Debug

### 1. Check Railway Logs

Go to Railway → Your Service → Deployments → Latest → View Logs

Look for:
- `[Startup]` messages - shows where startup is failing
- `[DB]` messages - shows database connection status
- Error messages - will show what's crashing
- "Server listening" - confirms server started

### 2. Common Issues

**Issue: No startup logs at all**
- Server isn't starting
- Check if `node dist/index.js` is the correct command
- Verify `dist/index.js` exists after build

**Issue: "Failed to start server"**
- Port might be in use
- Check PORT environment variable
- Verify server is listening on `0.0.0.0` (already configured)

**Issue: Database connection errors**
- Check `DATABASE_URL` is set
- Verify PostgreSQL addon is running
- Check connection string format

**Issue: "Server listening" but health check fails**
- Health endpoint might not be registered
- Check if routes are registered before migrations
- Verify `/health` path matches Railway config

### 3. Manual Testing

After deployment, try accessing:
```
https://your-app.up.railway.app/health
```

Should return:
```json
{"ok":true,"timestamp":"2025-11-26T..."}
```

### 4. Verify Environment Variables

Required variables:
- `PORT` (auto-set by Railway)
- `DATABASE_URL` (auto-set if using Railway PostgreSQL)
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `ENCRYPTION_KEY`
- `ADMIN_TOKEN`
- `APP_URL`

### 5. Test Locally First

```bash
# Build
npm run build

# Set DATABASE_URL (or use SQLite)
export DATABASE_URL="postgresql://..."

# Start
node dist/index.js

# In another terminal
curl http://localhost:3000/health
# Should return: {"ok":true,"timestamp":"..."}
```

## Next Steps

1. **Check Railway logs** - Look for `[Startup]` messages
2. **Share the logs** - If you see errors, share them for debugging
3. **Verify environment variables** - Ensure all required vars are set
4. **Test health endpoint manually** - After deployment, try accessing it directly

## If Still Failing

The console.log statements will help identify where the startup is failing. Once you check Railway logs, we can see:
- If the server is starting
- Where it's failing
- What error is occurring

Share the Railway logs output and we can fix the specific issue.

