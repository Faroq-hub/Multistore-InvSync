# Railway Logs Checklist

## What to Check in Railway Logs

After deployment, go to **Railway → Your Service → Deployments → Latest → View Logs**

### 1. Look for Startup Messages

You should see these messages in order:
```
[Startup] Initializing server...
[Startup] PORT: [number]
[Startup] NODE_ENV: production
[Startup] DATABASE_URL: Set (or Not set)
[Startup] Building server...
[Startup] Server built successfully
[Startup] Starting server on port [number]
[Startup] ✓ Server listening on [number]
[Startup] Health endpoint available at: /health
```

**If you see all of these:** Server started successfully, but health check might be failing for another reason.

**If you DON'T see "Server listening":** Server is crashing before it can start.

### 2. Look for Database Messages

```
[DB] Using PostgreSQL database
[DB] Migration completed
```

**If you see database errors:** The database connection might be failing.

### 3. Look for Errors

Common error patterns:
- `Failed to start server:` - Server startup failed
- `Database connection error` - DATABASE_URL issue
- `Port already in use` - Port conflict
- `Cannot find module` - Missing dependency
- `ENOENT` - File not found
- `ECONNREFUSED` - Database connection refused

### 4. What to Share

If health check is still failing, share:
1. **All `[Startup]` messages** you see in the logs
2. **Any error messages** (especially ones with stack traces)
3. **The last few lines** of the logs before it stops
4. **Whether you see "Server listening"** message

This will help identify exactly where the startup is failing.

