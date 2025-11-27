# Fix: Deployment Health Check Failure

## Problem
Deployment failed because:
1. Railway health check hits `/health` on port 8080 (Next.js)
2. `/health` endpoint was only on Fastify (port 3000)
3. Health check failed → deployment marked as failed

## Solution Applied

1. **Added `/health` endpoint to Next.js:**
   - Created `app/health/route.ts`
   - Returns `{ ok: true, timestamp: "...", service: "nextjs" }`
   - Now Railway's health check will pass

2. **Updated Railway configuration:**
   - Build command: `npm run build && npm run build:next`
   - Start command: Runs both services with `concurrently`
   - Health check: `/health` (now available on Next.js)

## Next Steps

1. **Commit and push:**
   ```bash
   git add app/health/route.ts railway.json package.json
   git commit -m "Fix: Add health endpoint to Next.js for Railway health checks"
   git push
   ```

2. **Railway will auto-deploy** - wait 2-3 minutes

3. **Verify:**
   - Check Railway logs - both services should start
   - Health check should pass
   - Test: `curl https://web-production-33f26.up.railway.app/health`
   - Test: `curl https://web-production-33f26.up.railway.app/api/auth/callback` (should not be 404)

## How It Works Now

- **Next.js** runs on Railway's exposed port (8080) - handles OAuth and frontend
- **Fastify** runs on internal port (3000) - handles webhooks and admin APIs
- **Health check** hits Next.js `/health` endpoint → passes ✅
- **OAuth** works via Next.js `/api/auth/callback` → works ✅

## Files Changed

- ✅ `app/health/route.ts` - New health endpoint for Next.js
- ✅ `railway.json` - Updated to build and run both services
- ✅ `package.json` - Added `start:production` script

