# 🔧 Railway Build Fix Guide

## Problem

Railway build was failing with two issues:
1. **Node.js version too old** - Railway was using Node 18, but packages require Node 20+
2. **better-sqlite3 build failure** - Native module couldn't compile (but we use PostgreSQL in production anyway)

## ✅ Solutions Applied

### 1. Node.js Version Fix

**Added to `package.json`:**
```json
"engines": {
  "node": ">=20.10.0",
  "npm": ">=10.0.0"
}
```

**Created `nixpacks.toml`:**
- Forces Railway to use Node.js 20
- Includes Python and build tools needed for native modules

### 2. better-sqlite3 Made Optional

**Updated `package.json`:**
- Moved `better-sqlite3` to `optionalDependencies`
- If it fails to compile, npm will continue (won't fail the build)
- Since you're using PostgreSQL in production, SQLite isn't needed anyway

**Updated `src/db/adapter.ts`:**
- Changed to dynamic import of better-sqlite3
- Only loads SQLite when DATABASE_URL is not set
- In production with PostgreSQL, SQLite won't be needed

## 🚀 Next Steps

1. **Commit and push these changes:**
   ```bash
   git add .
   git commit -m "Fix Railway build: Node 20 and optional SQLite"
   git push
   ```

2. **Railway will automatically redeploy** with the new configuration

3. **Verify the build:**
   - Check Railway dashboard → Deployments
   - Should see Node 20 being used
   - Build should complete successfully

## 📝 What Changed

### Files Modified:
- ✅ `package.json` - Added engines field
- ✅ `nixpacks.toml` - New file to configure Railway build
- ✅ `src/db/adapter.ts` - Made SQLite optional
- ✅ `railway.json` - Fixed start command

### Why This Works:

1. **Node 20**: Railway will now use Node.js 20.10.0+ which satisfies all package requirements
2. **Optional SQLite**: Since you're using PostgreSQL (`DATABASE_URL` is set), SQLite won't be needed, so the build failure won't matter
3. **Build Tools**: Python and GCC are included for any native modules that do need to compile

## 🔍 Verification

After deployment, check logs for:
```
[DB] Using PostgreSQL database
```

This confirms PostgreSQL is being used (not SQLite).

## ⚠️ If Build Still Fails

If you still see errors:

1. **Check Node version in logs:**
   - Should show `node v20.x.x` or higher

2. **Check if DATABASE_URL is set:**
   - Railway → Your Service → Variables
   - Should see `DATABASE_URL` (auto-added when you created PostgreSQL)

3. **Try manual build command:**
   - Railway → Your Service → Settings
   - Override build command: `npm ci && npm run build && npm run build:next`

## 💡 Alternative: Make better-sqlite3 Optional Dependency

If you want to completely avoid SQLite in production, you can make it an optional dependency:

```json
"optionalDependencies": {
  "better-sqlite3": "^12.4.1"
}
```

But the current solution (dynamic import) is better because it still allows SQLite for local development.

---

**The build should now work! 🎉**

