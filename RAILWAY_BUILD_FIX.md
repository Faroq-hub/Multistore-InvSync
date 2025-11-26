# Railway Build Error Fix

## Error: EBUSY - Resource Busy or Locked

**Error Message:**
```
npm error EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'
```

## Cause

Railway/Nixpacks uses Docker build caches that can conflict with npm's cache cleanup. The cache directory is locked when npm tries to remove it.

## Solution

Updated `railway.json` to clean the cache directory before running `npm ci`:

```json
{
  "build": {
    "buildCommand": "rm -rf node_modules/.cache 2>/dev/null || true && npm ci && npm run build"
  }
}
```

This:
1. Removes the cache directory if it exists (ignores errors if it doesn't)
2. Runs `npm ci` to install dependencies
3. Runs `npm run build` to compile TypeScript

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

