# Fix: Invalid Shopify Access Token Error

## Problem

The sync is failing with this error:
```
❌ Shopify API error 401: {"errors":"[API] Invalid API key or access token (unrecognized login or wrong password)"}
```

This means the **destination Shopify store's access token** is invalid or expired.

## Solution

You need to get a new Admin API access token from your destination Shopify store and update it in the connection settings.

## How to Get a New Shopify Admin API Access Token

### Method 1: Using Shopify Admin (Recommended)

1. **Go to your destination Shopify store admin:**
   - Log in to: `https://YOUR-STORE.myshopify.com/admin`

2. **Navigate to Settings → Apps and sales channels:**
   - Click "Settings" in the bottom left
   - Click "Apps and sales channels"

3. **Create a Private App:**
   - Click "Develop apps" (or "Manage private apps" if you see it)
   - Click "Create an app"
   - Give it a name (e.g., "Reseller Feed Sync")
   - Click "Create app"

4. **Configure API Scopes:**
   - Click "Configure Admin API scopes"
   - Select these scopes (minimum required):
     - ✅ `read_products`
     - ✅ `write_products`
     - ✅ `read_inventory`
     - ✅ `write_inventory`
     - ✅ `read_locations` (if syncing inventory)
   - Click "Save"

5. **Install the App:**
   - Click "Install app"
   - Confirm installation

6. **Copy the Access Token:**
   - After installation, you'll see "Admin API access token"
   - Click "Reveal token once" or "Show token"
   - **Copy the token immediately** (it starts with `shpat_` and you may only see it once!)

### Method 2: Using Shopify CLI (For Developers)

If you have Shopify CLI installed:

```bash
shopify app generate token
```

## How to Update the Access Token in the App

1. **Open your app:**
   - Go to your app URL: `https://web-production-33f26.up.railway.app`
   - Navigate to the "Connections" page

2. **Edit the Connection:**
   - Find the connection that's failing (check the destination store domain)
   - Click the "Edit" button (pencil icon) next to the connection

3. **Update the Access Token:**
   - In the "Access Token" field, paste your new token
   - **Note:** The field will be empty for security - this is normal. Just paste your new token.
   - Leave it empty if you want to keep the current token (but in this case, you need to update it!)

4. **Save:**
   - Click "Update" to save the changes

5. **Test the Sync:**
   - Go back to the connections list
   - Click "Sync Now" on the connection
   - Check the logs to verify it's working

## Verify the Token Works

After updating, the sync should work. You should see in the logs:
- ✅ `Successfully created product ID X` instead of ❌ errors
- The sync summary showing products created

## Important Notes

- **Access tokens are sensitive:** Never share them publicly or commit them to version control
- **Token expiration:** Private app tokens don't expire, but they can be revoked if you delete the app
- **Permissions:** Make sure the token has all required scopes (see Method 1, step 4)
- **Multiple connections:** If you have multiple connections, update each one separately

## Troubleshooting

### Still getting 401 errors?

1. **Verify the token format:**
   - Should start with `shpat_`
   - Should be about 40-50 characters long

2. **Check the store domain:**
   - Make sure `dest_shop_domain` matches exactly (e.g., `store.myshopify.com`)
   - No `https://` prefix
   - No trailing slash

3. **Verify API scopes:**
   - The token must have `write_products` and `write_inventory` scopes
   - Re-create the private app if needed

4. **Check the connection:**
   - Make sure you're editing the correct connection
   - Verify the destination store domain matches

### Need to delete and recreate?

If updating doesn't work, you can:
1. Delete the connection
2. Create a new one with the correct access token

