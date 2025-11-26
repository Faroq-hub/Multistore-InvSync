# Railway Build Error Fix

## Error: EBUSY - Resource Busy or Locked

**Error Message:**
```
npm error EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'
```

## Cause

Railway/Nixpacks uses Docker build caches that can conflict with npm's cache cleanup. The cache directory is locked when npm tries to remove it.

## Solution

Railway automatically runs `npm ci` during the build phase. The issue was that our `buildCommand` was trying to run `npm ci` again, causing a cache conflict.

**Updated `railway.json`:**
```json
{
  "build": {
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.js"
  }
}
```

This:
1. Railway automatically runs `npm ci` (handles dependency installation)
2. Our `buildCommand` only runs `npm run build` (compiles TypeScript)
3. `startCommand` runs the pre-built app (no build during start)

## Alternative Solutions

If the issue persists, try these alternatives:

### Option 1: Use npm install instead of npm ci
```json
"buildCommand": "npm install && npm run build"
```

### Option 2: Skip cache cleanup
```json
"buildCommand": "npm ci --prefer-offline --no-audit && npm run build"
```

### Option 3: Clear npm cache explicitly
```json
"buildCommand": "npm cache clean --force && npm ci && npm run build"
```

## Testing Locally

Test the build command locally:
```bash
rm -rf node_modules/.cache 2>/dev/null || true && npm ci && npm run build
```

## Next Steps

1. Commit and push the updated `railway.json`
2. Railway will automatically redeploy
3. Monitor the build logs to ensure it completes successfully

