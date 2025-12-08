# Diagnose Sync Issue

Please check the following and share the results:

## 1. Check the Latest Sync Logs

Look for these key messages in Railway logs:

### ✅ Good Signs:
- `Sync options - Create Products: true` (should be `true`, not `false`)
- `🔄 Creating new product with X variant(s)`
- `✅ Successfully created product ID X`
- `📊 Sync Summary` at the end

### ❌ Problem Signs:
- `⚠️  WARNING: create_products is disabled` → **Fix:** Enable "Create products" in connection settings
- `401 - Invalid API key or access token` → **Fix:** Update the access token (see FIX_ACCESS_TOKEN.md)
- `⚠️  Note: Products with stock <= 0 are not synced` → **Fix:** Products need stock > 0 to sync
- `⚠️  Skipping X product(s) - create_products is disabled` → **Fix:** Enable "Create products"

## 2. Check Connection Settings

In your app, go to Connections → Edit the connection:

1. **Is "Create products if not found" checked?**
   - If NO → Check it and save, then sync again

2. **What does the "Access Token" field show?**
   - If it's empty → That's normal (for security)
   - If you entered a new token → Make sure it's valid (starts with `shpat_`)

3. **What's the destination store domain?**
   - Should be: `your-store.myshopify.com` (no https://, no trailing slash)

## 3. Check Source Products

1. **Do your source products have stock > 0?**
   - Products with stock = 0 are automatically skipped
   - Check your source store inventory

2. **What SKUs are you trying to sync?**
   - Check the logs for: `SKUs to create: X, Y, Z`

## 4. Check the Sync Summary

At the end of the sync, you should see:
```
📊 Sync Summary for connection <id>:
  - Total source items considered: X
  - Items with stock > 0: Y
  - Skipped (out of stock): Z
  - Product groups processed: N
  - Existing variants found: A
  - Missing variants: B
  - Products created: C  ← This should be > 0
  - Errors encountered: D
```

**What to look for:**
- If `Products created: 0` but `Missing variants: > 0` → Products should have been created but weren't
- If `Errors encountered: > 0` → Check the error messages above

## 5. Common Issues and Fixes

### Issue: "create_products is disabled"
**Fix:** 
1. Edit connection
2. Check "Create products if not found"
3. Save
4. Sync again

### Issue: "401 - Invalid API key"
**Fix:**
1. Get new access token from destination store (see FIX_ACCESS_TOKEN.md)
2. Edit connection
3. Paste new token in "Access Token" field
4. Save
5. Sync again

### Issue: "Products with stock <= 0 are not synced"
**Fix:**
- This is by design - only products with stock > 0 are synced
- If you need to sync out-of-stock products, we need to modify the code

### Issue: "Products created: 0" but no errors
**Possible causes:**
1. All products already exist in destination (check `Existing variants found`)
2. All products have stock = 0 (check `Skipped (out of stock)`)
3. create_products is disabled (check sync options log)

## 6. Share This Information

Please share:
1. The **Sync Summary** from the latest sync
2. Any **error messages** (lines with ❌)
3. Any **warning messages** (lines with ⚠️)
4. Whether **"Create products" is enabled** in connection settings
5. Whether you **updated the access token** after the 401 errors

This will help identify the exact issue!

