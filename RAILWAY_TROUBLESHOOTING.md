# Railway Deployment Troubleshooting

## Issue: Service Unavailable / Health Check Failures

If you're seeing "service unavailable" errors in Railway, here are the most common causes and solutions:

### Problem 1: Build Running During Start

**Symptom:** Health checks fail because the server takes too long to start.

**Solution:** The `railway.json` has been updated to:
- Build during the build phase: `npm ci && npm run build`
- Start the pre-built app: `node dist/index.js`
- Increased healthcheck timeout to 300 seconds

### Problem 2: Database Connection Issues

**Symptom:** Server crashes on startup due to database connection errors.

**Check:**
1. Verify `DATABASE_URL` is set in Railway environment variables
2. Ensure PostgreSQL service is running
3. Check that the database URL format is correct: `postgresql://user:password@host:port/database`

**Solution:**
```bash
# Check Railway logs
railway logs

# Verify DATABASE_URL is set
railway variables
```

### Problem 3: Missing Environment Variables

**Symptom:** Server fails to start or crashes immediately.

**Required Variables:**
- `PORT` (usually auto-set by Railway)
- `DATABASE_URL` (auto-set if using Railway PostgreSQL)
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `ENCRYPTION_KEY`
- `ADMIN_TOKEN`
- `APP_URL` (your Railway app URL)

**Solution:**
1. Go to Railway → Your Service → Variables
2. Add all required environment variables
3. Redeploy

### Problem 4: Port Configuration

**Symptom:** Server starts but health checks fail.

**Check:**
- Railway automatically sets `PORT` environment variable
- Server should listen on `0.0.0.0` (already configured)
- Default port is 3000 if `PORT` is not set

**Solution:**
The server is already configured to use `process.env.PORT || 3000`, which should work with Railway.

### Problem 5: Health Endpoint Not Accessible

**Symptom:** Health checks fail even though server appears to be running.

**Check:**
- Health endpoint is at `/health` (configured in `railway.json`)
- Should return: `{"ok":true}`
- Endpoint is registered in `src/routes/feed.ts`

**Test locally:**
```bash
# After starting server
curl http://localhost:3000/health
# Should return: {"ok":true}
```

### Problem 6: Build Failures

**Symptom:** Deployment fails during build phase.

**Check Railway build logs for:**
- TypeScript compilation errors
- Missing dependencies
- Node.js version mismatch (requires >=20.10.0)

**Solution:**
1. Check build logs in Railway dashboard
2. Test build locally: `npm run build`
3. Ensure all dependencies are in `package.json`

### Problem 7: Database Migration Not Run

**Symptom:** Server starts but database operations fail.

**Solution:**
Run migration after deployment:
```bash
railway run npm run migrate:postgres
```

Or add it to the build command (but this might slow down deployments).

### Quick Fixes

1. **Increase Health Check Timeout:**
   - Already set to 300 seconds in `railway.json`
   - If still failing, check if server is actually starting

2. **Check Logs:**
   ```bash
   railway logs
   ```
   Look for:
   - Database connection errors
   - Missing environment variables
   - Port binding errors
   - Startup errors

3. **Verify Build:**
   - Check that `dist/index.js` exists after build
   - Verify TypeScript compilation succeeded

4. **Test Locally:**
   ```bash
   npm run build
   node dist/index.js
   curl http://localhost:3000/health
   ```

### Updated Railway Configuration

The `railway.json` has been updated with:
- Build command: `npm ci && npm run build`
- Start command: `node dist/index.js` (no build during start)
- Health check timeout: 300 seconds

This should resolve the "service unavailable" errors.

### Next Steps

1. **Commit and push the updated `railway.json`:**
   ```bash
   git add railway.json
   git commit -m "Fix Railway deployment: separate build and start phases"
   git push
   ```

2. **Monitor the deployment:**
   - Watch Railway logs during deployment
   - Check if build completes successfully
   - Verify server starts and health check passes

3. **If still failing:**
   - Check Railway logs for specific error messages
   - Verify all environment variables are set
   - Ensure PostgreSQL service is running
   - Test the health endpoint manually after deployment

