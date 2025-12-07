# Sync Debugging Guide

## Issue: Products Not Being Created Despite "Synced" Status

### Root Causes Found

1. **Stock Filter**: Products with `stock <= 0` are automatically filtered out (line 434 in `pushWorker.ts`)
   - **Solution**: Check if source products have stock > 0
   - **Workaround**: Remove or modify the stock filter if you need to sync out-of-stock products

2. **`create_products` Flag**: If this is disabled (0), products won't be created
   - **Check**: Look at connection settings in the UI
   - **Fix**: Enable "Create Products" option in connection settings

3. **SKU Count from Audit Logs**: The UI shows SKU count from audit logs, which may be written even if product creation fails
   - **Check**: Look at audit logs to see actual errors
   - **Location**: Check `/api/audit` endpoint or database `audit_logs` table

4. **Missing `last_synced_at` Update**: Previously, this wasn't updated after sync
   - **Fixed**: Now updates after successful sync

### How to Debug

1. **Check Connection Settings**:
   ```sql
   SELECT id, name, create_products, sync_price, sync_categories, last_synced_at 
   FROM connections 
   WHERE id = 'your-connection-id';
   ```

2. **Check Job Status**:
   ```sql
   SELECT id, job_type, state, last_error, created_at, updated_at 
   FROM jobs 
   WHERE connection_id = 'your-connection-id' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Check Audit Logs**:
   ```sql
   SELECT level, sku, message, ts 
   FROM audit_logs 
   WHERE connection_id = 'your-connection-id' 
   ORDER BY ts DESC 
   LIMIT 50;
   ```

4. **Check Server Logs**:
   - Look for `[Push Worker]` messages
   - Look for `[shopify:connection-id]` messages
   - Check for errors with `❌` or warnings with `⚠️`

### Common Issues

#### Issue: "create_products is disabled"
**Solution**: Enable "Create Products" in connection settings

#### Issue: "Products with stock <= 0 are not synced"
**Solution**: 
- Ensure source products have stock > 0, OR
- Modify the stock filter in `pushWorker.ts` line 434

#### Issue: "Failed to create product: 401/403"
**Solution**: 
- Check that `access_token` is valid
- Check that token has `write_products` scope

#### Issue: "Failed to create product: 422"
**Solution**: 
- Check product payload for invalid data
- Look at error response for specific field issues

### Testing

1. **Test with a single product**:
   - Create a test product in source store with stock > 0
   - Run sync
   - Check destination store

2. **Check logs**:
   - Look for `✅ Successfully created product ID` messages
   - Look for `❌` error messages

3. **Verify in destination**:
   - Check Shopify admin for the product
   - Verify SKU matches
   - Verify stock quantity

