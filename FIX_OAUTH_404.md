# Fix: OAuth 404 Error

## Problem
The `/api/auth/callback` route returns 404 because Railway is only running the Fastify backend, not the Next.js app.

## Solution
Updated Railway configuration to run both services:
- **Next.js** (frontend + OAuth) on Railway's main port (8080)
- **Fastify** (backend API) on internal port (3000)

## Changes Made

1. **Updated `railway.json`:**
   - Build command now builds both: `npm run build && npm run build:next`
   - Start command runs both services using `concurrently`

2. **Updated `package.json`:**
   - Added `start:production` script that runs both services

## Next Steps

1. **Commit and push the changes:**
   ```bash
   git add railway.json package.json
   git commit -m "Fix: Run both Next.js and Fastify in production"
   git push
   ```

2. **Railway will auto-deploy** - wait 2-3 minutes

3. **Verify deployment:**
   - Check Railway logs for both services starting
   - Test: `curl https://web-production-33f26.up.railway.app/health` (Fastify)
   - Test: Visit `https://web-production-33f26.up.railway.app` (Next.js)

4. **Test OAuth again:**
   - Try installing the app in Shopify
   - Should now work!

## How It Works

- **Next.js** runs on Railway's exposed port (PORT env var, usually 8080)
- **Fastify** runs on internal port 3000
- Both services share the same database (PostgreSQL)
- Next.js handles OAuth and frontend
- Fastify handles webhooks and admin APIs

## Troubleshooting

If you still see 404:
1. Check Railway logs - both services should be running
2. Verify Next.js build completed successfully
3. Check that `PORT` environment variable is set by Railway
4. Verify `/api/auth/callback` route exists in `app/api/auth/callback/route.ts`

