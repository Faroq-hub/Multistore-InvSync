# How to Check Sync Logs in Railway

Since you pressed "Sync Now", here's how to check if it's working:

## Method 1: Railway Dashboard (Easiest)

1. Go to: https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d
2. Click on **"Observability"** or **"Log"** in the navigation
3. Look for recent log entries (should show real-time logs)

## Method 2: Railway CLI

If you have Railway CLI installed:

```bash
railway logs --service b3d13674-dbdd-45e3-a605-6a78a94bf85d
```

## What to Look For

### ✅ Success Indicators:

Look for these messages in the logs:

1. **Job Started:**
   ```
   [Push Worker] Found job: <job-id>
   [Push Worker] Processing job <job-id> (full_sync) for connection <connection-id>
   ```

2. **Sync Options:**
   ```
   [shopify:connection-id] Sync options - Price: true/false, Create Products: true, Categories: true/false
   ```

3. **Source Items Found:**
   ```
   [shopify:connection-id] Found X source items, Y with stock > 0 (skipped Z out-of-stock items)
   ```

4. **Product Creation:**
   ```
   [shopify:connection-id] 🔄 Creating new product with X variant(s): <product-title>
   [shopify:connection-id] ✅ Successfully created product ID <id> with X variant(s)
   ```

5. **Sync Summary:**
   ```
   [shopify:connection-id] 📊 Sync Summary for connection <id>:
      Total products processed: X
      Existing variants found: Y
      Missing variants: Z
      Products created: N
      Errors: 0
   ```

6. **Job Completed:**
   ```
   [Push Worker] Job <job-id> completed successfully
   ```

### ❌ Error Indicators:

Look for these warning/error messages:

1. **Create Products Disabled:**
   ```
   ⚠️  WARNING: create_products is disabled. Products will NOT be created
   ```

2. **Stock Filter:**
   ```
   ⚠️  Note: Products with stock <= 0 are not synced
   ```

3. **Product Creation Failed:**
   ```
   ❌ Error creating product: <error message>
   ❌ Failed to create product: 401/403/422 - <error details>
   ```

4. **No Products Created:**
   ```
   ⚠️  WARNING: X product(s) were missing but none were created!
   ```

## Quick Check Commands

If you have database access, you can also check:

```sql
-- Check recent jobs
SELECT id, connection_id, job_type, state, last_error, created_at 
FROM jobs 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if last_synced_at was updated
SELECT id, name, last_synced_at, create_products 
FROM connections 
WHERE status = 'active';

-- Check recent audit logs
SELECT level, sku, message, ts 
FROM audit_logs 
WHERE connection_id = '<your-connection-id>'
ORDER BY ts DESC 
LIMIT 20;
```

## Next Steps

1. **Check Railway logs** using one of the methods above
2. **Look for the summary message** - it will tell you exactly what happened
3. **Check the destination store** - verify if products were actually created
4. **Share the log output** - especially the summary and any error messages

The new logging should make it very clear what's happening during the sync!

