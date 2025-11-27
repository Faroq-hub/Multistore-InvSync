# ✅ Action Plan - Production Setup

## 🎯 Generated Security Keys

Your security keys have been generated and are ready to use:

- **ENCRYPTION_KEY:** `dfd44db01374d4f45c05c27b5b483300c70fc5fce58783479ce98c80b5fb5c23`
- **ADMIN_TOKEN:** `d0c7e77e47a3daad35741eed9ff23e49de3dca8c49ef24a0691065323f06167d`

These are already included in `RAILWAY_VARIABLES_READY.txt`

---

## 📋 Step-by-Step Actions

### ✅ Step 1: Get Shopify Credentials (2 minutes)

1. Go to: **https://partners.shopify.com**
2. Login → **Apps** → **Your App Name** → **App setup**
3. Copy these 3 values:
   - **API Key** (also called Client ID)
   - **API Secret** (also called Client Secret)  
   - **Webhook Secret** (if shown, or you can generate one)

### ✅ Step 2: Add Variables to Railway (3 minutes)

1. **Open Railway Variables:**
   https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables

2. **Click "Raw Editor" button** (top right of Variables tab)

3. **Open the file:** `RAILWAY_VARIABLES_READY.txt` in this folder

4. **Copy the entire contents** (the keys are already generated!)

5. **Replace these 3 placeholders:**
   - `REPLACE_WITH_YOUR_API_KEY_FROM_SHOPIFY_PARTNERS` → Your API Key
   - `REPLACE_WITH_YOUR_API_SECRET_FROM_SHOPIFY_PARTNERS` → Your API Secret
   - `REPLACE_WITH_YOUR_WEBHOOK_SECRET_FROM_SHOPIFY_PARTNERS` → Your Webhook Secret
   - `support@yourdomain.com` → Your actual support email

6. **Paste into Railway Raw Editor**

7. **Click "Save"**

8. **Wait 1-2 minutes** for Railway to redeploy

### ✅ Step 3: Update Shopify App URLs (2 minutes)

1. **Go to:** https://partners.shopify.com → Your App → **App setup**

2. **Update these 3 fields:**
   - **App URL:** 
     ```
     https://web-production-33f26.up.railway.app
     ```
   
   - **Allowed redirection URL(s):** 
     ```
     https://web-production-33f26.up.railway.app/api/auth/callback
     ```
   
   - **Webhook URL** (if there's a separate field):
     ```
     https://web-production-33f26.up.railway.app/api/webhooks/shopify
     ```

3. **Click "Save"** at the bottom

### ✅ Step 4: Verify Deployment (1 minute)

1. **Check Railway Logs:**
   - Go to Railway → Your Service → **Logs** tab
   - Look for: `[DB] Using PostgreSQL database`
   - Look for: `[Startup] ✓ Server listening on 8080`
   - Should see no errors

2. **Test Health Endpoint:**
   ```bash
   curl https://web-production-33f26.up.railway.app/health
   ```
   Should return: `{"ok":true,"timestamp":"..."}`

### ✅ Step 5: Test App Installation (5 minutes)

1. **Go to your test Shopify store admin**
   - Visit: `https://your-test-store.myshopify.com/admin`

2. **Navigate to Apps:**
   - Go to **Settings** → **Apps and sales channels**
   - Or **Apps** → **Develop apps** (for development apps)

3. **Install Your App:**
   - Find your app in the list
   - Click **"Install"** or **"Add app"**
   - Authorize the requested permissions

4. **Verify:**
   - ✅ OAuth completes successfully
   - ✅ App loads without errors
   - ✅ No error messages in browser console

---

## 🎉 You're Done!

Your app is now in production and ready to use!

---

## 📁 Files Created

- ✅ `RAILWAY_VARIABLES_READY.txt` - Ready-to-use variables (keys included!)
- ✅ `generate-keys.sh` - Script to regenerate keys if needed
- ✅ `QUICK_START_PRODUCTION.md` - Quick reference guide
- ✅ `PRODUCTION_SETUP.md` - Complete detailed guide
- ✅ `ENV_VARS_CHECKLIST.md` - Variables checklist
- ✅ `SHOPIFY_URLS_UPDATE.md` - Shopify URL update guide

---

## 🔍 Quick Verification Checklist

After completing all steps:

- [ ] All variables added to Railway
- [ ] Railway redeployed successfully
- [ ] Health endpoint returns 200 OK
- [ ] Shopify URLs updated in Partners Dashboard
- [ ] App installs successfully in test store
- [ ] App UI loads without errors
- [ ] No errors in Railway logs

---

## 🆘 Troubleshooting

### Variables Not Saving
- Make sure you're in the correct service (web service)
- Check you're using Raw Editor, not individual variable fields
- Ensure no syntax errors (no spaces around `=`)

### App Won't Install
- Verify Shopify URLs match exactly (no trailing slashes)
- Check `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are correct
- Verify `APP_URL` in Railway matches App URL in Partners Dashboard

### OAuth Fails
- Check callback URL is in allowed list
- Verify all URLs use `https://` (not `http://`)
- Check Railway logs for detailed error messages

---

**Ready to proceed?** Follow the steps above in order! 🚀

