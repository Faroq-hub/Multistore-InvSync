# How to Check Sync Status

After pressing "Sync Now", here's how to verify what's happening:

## 1. Check Railway Logs (Most Important)

Go to Railway dashboard → Your service → **Logs** tab

Look for these messages:

### ✅ Success Indicators:
- `[Push Worker] Found job: <job-id>`
- `[Push Worker] Processing job <job-id>`
- `[shopify:connection-id] Sync options - Price: true/false, Create Products: true/false`
- `[shopify:connection-id] Found X source items, Y with stock > 0`
- `✅ Successfully created product ID <id> with X variant(s)`
- `[Push Worker] Job <job-id> completed successfully`

### ❌ Error Indicators:
- `❌ Error creating product: <error message>`
- `⚠️  WARNING: create_products is disabled`
- `⚠️  Note: Products with stock <= 0 are not synced`
- `[Push Worker] Job <job-id> failed: <error>`
- `Failed to create product: 401/403/422`

## 2. Check Connection Settings

In the UI, verify:
- **"Create Products"** is enabled (should be checked)
- Connection status is **"active"**
- Destination store domain is correct
- Location ID is set (for inventory sync)

## 3. Common Issues

### Issue: "create_products is disabled"
**Fix**: Edit the connection and enable "Create Products"

### Issue: "Products with stock <= 0 are not synced"
**Fix**: Ensure source products have stock > 0, or modify the code to sync out-of-stock products

### Issue: "Failed to create product: 401"
**Fix**: Check that `access_token` is valid and has `write_products` scope

### Issue: "Failed to create product: 422"
**Fix**: Check product data - might have invalid fields (price format, missing required fields, etc.)

## 4. Check Database (If you have access)

```sql
-- Check recent jobs
SELECT id, connection_id, job_type, state, last_error, created_at, updated_at 
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Check connection settings
SELECT id, name, create_products, sync_price, last_synced_at 
FROM connections 
WHERE status = 'active';

-- Check audit logs for errors
SELECT level, sku, message, ts 
FROM audit_logs 
WHERE level IN ('error', 'warn')
ORDER BY ts DESC 
LIMIT 20;
```

## 5. What Changed in the Fix

The latest fixes:
1. ✅ Updates `last_synced_at` after successful sync
2. ✅ Better error logging with clear indicators
3. ✅ Warnings if `create_products` is disabled
4. ✅ Warnings about stock filter
5. ✅ Validation of product creation response

## Next Steps

1. **Deploy the fixes** (if not already deployed):
   ```bash
   git add src/db.ts src/services/pushWorker.ts
   git commit -m "Fix: Add last_synced_at update and improve sync logging"
   git push
   ```

2. **Wait for Railway to redeploy** (2-3 minutes)

3. **Press "Sync Now" again**

4. **Check Railway logs** for the new detailed messages

5. **Verify products in destination store** - Check if they actually appear

