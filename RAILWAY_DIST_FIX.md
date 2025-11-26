# 🔧 Railway Fix: Missing dist/index.js

## Problem

Railway logs show:
```
Error: Cannot find module '/app/dist/index.js'
```

The build succeeds, but the `dist` directory is not available at runtime.

## Root Cause

Railway's Nixpacks builder runs the build command during the build phase, but the build output (`dist/`) might not be preserved in the final Docker image, or Railway might be using a different working directory.

## ✅ Solution

Changed `startCommand` in `railway.json` to build and run in one command:

```json
{
  "deploy": {
    "startCommand": "npm run build && node dist/index.js"
  }
}
```

This ensures:
1. The build runs **at startup** (not just during build phase)
2. The `dist` directory is created **right before** the server starts
3. The server starts with the freshly built code

## Why This Works

- Railway's build phase might not preserve the `dist` directory
- By building at startup, we ensure the build output exists when the server starts
- The build is fast (TypeScript compilation), so it won't significantly delay startup

## Trade-offs

- **Slight startup delay**: Build runs on every restart (~2-3 seconds)
- **More reliable**: Build output is guaranteed to exist
- **Simpler**: No need to debug why build output isn't preserved

## Alternative (If Startup Delay is an Issue)

If the startup delay becomes a problem, we can:
1. Use Railway's Dockerfile builder instead of Nixpacks
2. Create a custom Dockerfile that explicitly preserves `dist/`
3. Use Railway's build artifacts feature

For now, building at startup is the simplest and most reliable solution.

