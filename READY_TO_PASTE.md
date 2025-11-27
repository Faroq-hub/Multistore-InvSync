# ✅ Ready to Paste - Railway Variables

## 🎯 All Values Ready!

I've extracted your Shopify credentials from `.env` and combined them with the generated security keys.

## 📋 Step 1: Copy to Railway (2 minutes)

1. **Open Railway Variables:**
   https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables

2. **Click "Raw Editor" button** (top right)

3. **Open the file:** `RAILWAY_VARIABLES_FINAL.txt` in this folder

4. **Copy ALL the contents** (starting from `ENCRYPTION_KEY=`)

5. **Paste into Railway Raw Editor**

6. **Click "Save"**

7. **Wait 1-2 minutes** for Railway to redeploy

## 📋 Step 2: Update Shopify URLs (2 minutes)

1. **Go to:** https://partners.shopify.com → Your App → **App setup**

2. **Update these fields:**
   - **App URL:** 
     ```
     https://web-production-33f26.up.railway.app
     ```
   
   - **Allowed redirection URL(s):** 
     ```
     https://web-production-33f26.up.railway.app/api/auth/callback
     ```
   
   - **Webhook URL** (if separate field):
     ```
     https://web-production-33f26.up.railway.app/api/webhooks/shopify
     ```

3. **Click "Save"**

## 📋 Step 3: Verify (1 minute)

1. **Check Railway Logs:**
   - Go to Railway → Your Service → **Logs**
   - Look for: `[DB] Using PostgreSQL database`
   - Look for: `[Startup] ✓ Server listening`

2. **Test Health:**
   ```bash
   curl https://web-production-33f26.up.railway.app/health
   ```
   Should return: `{"ok":true,"timestamp":"..."}`

## 📋 Step 4: Test Installation (5 minutes)

1. Go to your test Shopify store admin
2. Navigate to Apps → Develop apps
3. Find your app and click "Install"
4. Verify app loads successfully

## ✅ Done!

Your app is now in production!

---

## 📝 What's Included

✅ **Security Keys** (generated):
- ENCRYPTION_KEY
- ADMIN_TOKEN

✅ **Shopify Credentials** (from your .env):
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- SHOPIFY_WEBHOOK_SECRET
- SHOPIFY_SCOPES (enhanced with write permissions)
- SHOPIFY_API_VERSION

✅ **App URLs** (set to Railway):
- APP_URL
- SHOPIFY_WEBHOOK_BASE_URL
- NEXT_PUBLIC_SHOPIFY_API_KEY

✅ **Other Settings**:
- LOG_LEVEL
- NEXT_PUBLIC_SUPPORT_EMAIL (update to your email)

---

## ⚠️ Note

The `APP_URL` has been updated from your ngrok URL to the Railway production URL. Make sure to update the same in Shopify Partners Dashboard.

---

**File to use:** `RAILWAY_VARIABLES_FINAL.txt`

