# 🚀 Quick Start - Production Setup

## Step 1: Generate Security Keys (30 seconds)

Run this command:
```bash
./generate-keys.sh
```

Copy the two generated keys - you'll need them for Railway.

## Step 2: Get Shopify Credentials (2 minutes)

1. Go to: https://partners.shopify.com
2. Login → Apps → Your App Name → App setup
3. Copy these values:
   - **API Key** (Client ID)
   - **API Secret** (Client Secret)
   - **Webhook Secret** (if shown, or generate one)

## Step 3: Add Variables to Railway (3 minutes)

1. **Open Railway Variables:**
   https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables

2. **Click "Raw Editor" button** (top right)

3. **Copy and paste this template**, replacing placeholders:

```env
ENCRYPTION_KEY=PASTE_GENERATED_KEY_HERE
ADMIN_TOKEN=PASTE_GENERATED_TOKEN_HERE
SHOPIFY_API_KEY=PASTE_FROM_SHOPIFY_PARTNERS
SHOPIFY_API_SECRET=PASTE_FROM_SHOPIFY_PARTNERS
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,write_products,write_inventory
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=PASTE_FROM_SHOPIFY_PARTNERS
SHOPIFY_WEBHOOK_BASE_URL=https://web-production-33f26.up.railway.app
APP_URL=https://web-production-33f26.up.railway.app
NEXT_PUBLIC_SHOPIFY_API_KEY=PASTE_FROM_SHOPIFY_PARTNERS
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
LOG_LEVEL=info
```

4. **Click "Save"**

5. **Railway will auto-redeploy** - wait 1-2 minutes

## Step 4: Update Shopify App URLs (2 minutes)

1. **Go to:** https://partners.shopify.com → Your App → App setup

2. **Update these fields:**
   - **App URL:** `https://web-production-33f26.up.railway.app`
   - **Allowed redirection URL(s):** `https://web-production-33f26.up.railway.app/api/auth/callback`
   - **Webhook URL** (if separate field): `https://web-production-33f26.up.railway.app/api/webhooks/shopify`

3. **Click "Save"**

## Step 5: Test Installation (5 minutes)

1. **Go to your test Shopify store admin**
2. **Navigate to:** Apps → Develop apps (or Settings → Apps)
3. **Find your app and click "Install"**
4. **Authorize permissions**
5. **Verify app loads successfully**

## ✅ Done!

Your app is now in production!

## 🔍 Verify Everything Works

1. **Health Check:**
   ```bash
   curl https://web-production-33f26.up.railway.app/health
   ```
   Should return: `{"ok":true,"timestamp":"..."}`

2. **Check Railway Logs:**
   - Go to Railway → Your Service → Logs
   - Look for: `[DB] Using PostgreSQL database`
   - Look for: `[Startup] ✓ Server listening`

3. **Test App Installation:**
   - Install in test store
   - Verify OAuth completes
   - Check app loads

## 🆘 Need Help?

- **Environment Variables:** See `ENV_VARS_CHECKLIST.md`
- **Shopify URLs:** See `SHOPIFY_URLS_UPDATE.md`
- **Full Guide:** See `PRODUCTION_SETUP.md`

