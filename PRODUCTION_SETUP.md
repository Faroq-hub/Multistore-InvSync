# Production Setup Guide

Complete step-by-step guide to move your app to production.

## Step 1: Verify Environment Variables in Railway ✅

### Current Status
- ✅ `DATABASE_URL` - Automatically set by Railway (PostgreSQL)
- ✅ `PORT` - Automatically set by Railway (usually 8080)
- ✅ `NODE_ENV` - Automatically set to `production`

### Required Variables to Set

#### 1. Go to Railway Variables Tab
1. Navigate to: https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables
2. Click **"New Variable"** or **"Raw Editor"** (for bulk entry)

#### 2. Add These Variables

**Security Keys (Generate First):**
```bash
# Generate ENCRYPTION_KEY (32-byte hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN (32-byte hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Shopify Configuration:**
```env
SHOPIFY_API_KEY=your-api-key-from-shopify-partners
SHOPIFY_API_SECRET=your-api-secret-from-shopify-partners
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,write_products,write_inventory
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret-from-shopify-partners
SHOPIFY_WEBHOOK_BASE_URL=https://web-production-33f26.up.railway.app
```

**App URLs:**
```env
APP_URL=https://web-production-33f26.up.railway.app
NEXT_PUBLIC_SHOPIFY_API_KEY=your-api-key-from-shopify-partners
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
```

**Optional (for logging):**
```env
LOG_LEVEL=info
```

### Complete Variable List

Copy this entire list to Railway's Raw Editor:

```env
# Security (generate these - see commands above)
ENCRYPTION_KEY=your-generated-32-byte-hex-key
ADMIN_TOKEN=your-generated-32-byte-hex-token

# Shopify App Credentials (from Partners Dashboard)
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,write_products,write_inventory
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# App URLs (use your Railway URL)
APP_URL=https://web-production-33f26.up.railway.app
SHOPIFY_WEBHOOK_BASE_URL=https://web-production-33f26.up.railway.app
NEXT_PUBLIC_SHOPIFY_API_KEY=your-api-key
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com

# Logging
LOG_LEVEL=info
```

**Note:** `DATABASE_URL`, `PORT`, and `NODE_ENV` are automatically set by Railway - don't add them manually.

---

## Step 2: Update Shopify App URLs in Partners Dashboard ✅

### 1. Go to Shopify Partners Dashboard
- Visit: https://partners.shopify.com
- Login to your account
- Navigate to **Apps** → Select your app

### 2. Go to App Setup
1. Click on your app
2. Click **"App setup"** in the left sidebar
3. Scroll to **"App URLs"** section

### 3. Update These URLs

**App URL:**
```
https://web-production-33f26.up.railway.app
```

**Allowed redirection URL(s):**
```
https://web-production-33f26.up.railway.app/api/auth/callback
```

**Webhook URL (if separate field exists):**
```
https://web-production-33f26.up.railway.app/api/webhooks/shopify
```

### 4. Verify Scopes
Ensure these scopes are enabled:
- ✅ `read_products`
- ✅ `read_inventory`
- ✅ `read_locations`
- ✅ `write_products` (if you need to update products)
- ✅ `write_inventory` (if you need to update inventory)

### 5. Save Changes
Click **"Save"** at the bottom of the page.

---

## Step 3: Test Full Workflow ✅

### Test 1: Install App in Test Store

1. **Go to your test Shopify store admin**
   - Visit: `https://your-test-store.myshopify.com/admin`

2. **Navigate to Apps**
   - Go to **Settings** → **Apps and sales channels**
   - Or go to **Apps** → **Develop apps** (if testing with development app)

3. **Install Your App**
   - Find your app in the list
   - Click **"Install"** or **"Add app"**
   - Authorize the requested permissions

4. **Verify OAuth Flow**
   - Should redirect to: `https://web-production-33f26.up.railway.app`
   - Should complete without errors
   - Should show your app's main page

### Test 2: Verify App Loads

1. **Open the App**
   - After installation, the app should open automatically
   - Or navigate to: **Apps** → **Your App Name**

2. **Check for Errors**
   - Look for any error messages
   - Check browser console (F12) for JavaScript errors
   - Verify the UI loads correctly

### Test 3: Create a Shopify Connection

1. **Navigate to Connections Page**
   - Click on **"Connections"** in the app navigation
   - Or go to: `https://web-production-33f26.up.railway.app/connections`

2. **Add Shopify Connection**
   - Click **"Add Connection"** or **"New Connection"**
   - Select **"Shopify"** as connection type
   - Fill in the form:
     - **Name:** Test Destination Store
     - **Shop Domain:** `destination-store.myshopify.com`
     - **Admin API Access Token:** `shpat_xxx` (from destination store)
     - **Location ID:** Location ID from destination store
   - Click **"Save"** or **"Create"**

3. **Verify Connection Created**
   - Connection should appear in the list
   - Status should be **"Active"** or **"Connected"**

### Test 4: Create a WooCommerce Connection

1. **Add WooCommerce Connection**
   - Click **"Add Connection"** or **"New Connection"**
   - Select **"WooCommerce"** as connection type
   - Fill in the form:
     - **Name:** Test WooCommerce Store
     - **Base URL:** `https://your-woocommerce-site.com`
     - **Consumer Key:** `ck_xxx`
     - **Consumer Secret:** `cs_xxx`
   - Click **"Save"** or **"Create"**

2. **Verify Connection Created**
   - Connection should appear in the list
   - Status should be **"Active"** or **"Connected"**

### Test 5: Trigger Full Sync

1. **Select a Connection**
   - Click on a connection from the list

2. **Trigger Sync**
   - Click **"Sync Now"** or **"Full Sync"** button
   - Or use the sync action from the connection menu

3. **Monitor Sync Progress**
   - Check the **"Jobs"** or **"Activity"** section
   - Verify a sync job is created
   - Wait for job to complete (status: "Completed" or "Success")

4. **Verify Data Synced**
   - Check destination store for synced products
   - Verify inventory levels match
   - Check prices are synced correctly

### Test 6: Check Audit Logs

1. **View Audit Logs**
   - Navigate to **"Audit Logs"** or **"Activity"** section
   - Verify sync operations are logged
   - Check for any errors

2. **Verify Logs Show:**
   - ✅ Connection created
   - ✅ Sync job started
   - ✅ Products synced
   - ✅ Inventory updated
   - ✅ No errors

### Test 7: Test Webhooks (Optional)

1. **Make a Change in Source Store**
   - Update a product price
   - Change inventory level
   - Add a new product

2. **Verify Webhook Received**
   - Check Railway logs for webhook requests
   - Verify delta sync job is created
   - Check destination store for updates

---

## Troubleshooting

### App Won't Install
- ✅ Check Shopify app URLs are correct in Partners Dashboard
- ✅ Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are set correctly
- ✅ Check Railway logs for OAuth errors
- ✅ Ensure `APP_URL` matches the URL in Partners Dashboard

### Connections Won't Create
- ✅ Verify destination store credentials are correct
- ✅ Check Railway logs for API errors
- ✅ Verify database connection is working
- ✅ Check that `DATABASE_URL` is set correctly

### Sync Jobs Fail
- ✅ Check destination store API credentials
- ✅ Verify products exist in source store
- ✅ Check Railway logs for detailed error messages
- ✅ Verify webhook secret is correct

### App UI Won't Load
- ✅ Check browser console for errors
- ✅ Verify `NEXT_PUBLIC_SHOPIFY_API_KEY` is set
- ✅ Check Railway logs for Next.js errors
- ✅ Ensure `APP_URL` is correct

---

## Verification Checklist

Before going live, verify:

- [ ] All environment variables are set in Railway
- [ ] Shopify app URLs are updated in Partners Dashboard
- [ ] App installs successfully in test store
- [ ] App UI loads without errors
- [ ] Can create Shopify connection
- [ ] Can create WooCommerce connection
- [ ] Full sync completes successfully
- [ ] Data syncs correctly to destination stores
- [ ] Audit logs show sync operations
- [ ] No errors in Railway logs

---

## Quick Links

- **Railway Variables:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables
- **Shopify Partners:** https://partners.shopify.com
- **App URL:** https://web-production-33f26.up.railway.app
- **Health Check:** https://web-production-33f26.up.railway.app/health

---

**Ready for Production!** 🚀

