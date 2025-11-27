# Update Shopify App URLs - Step by Step

## Step 1: Access Shopify Partners Dashboard

1. Go to: https://partners.shopify.com
2. Login with your Shopify Partners account
3. Navigate to **Apps** in the left sidebar
4. Click on your app name

## Step 2: Navigate to App Setup

1. In your app dashboard, click **"App setup"** in the left sidebar
2. Scroll down to the **"App URLs"** section

## Step 3: Update App URL

**Current field:** `App URL`

**Set to:**
```
https://web-production-33f26.up.railway.app
```

**How to update:**
1. Click in the `App URL` field
2. Replace the existing value with the Railway URL above
3. Click outside the field or press Enter to save

## Step 4: Update Allowed Redirection URLs

**Current field:** `Allowed redirection URL(s)`

**Add this URL:**
```
https://web-production-33f26.up.railway.app/api/auth/callback
```

**How to update:**
1. Click in the `Allowed redirection URL(s)` field
2. If there are existing URLs, add a new line
3. Paste the callback URL above
4. Click outside the field or press Enter to save

**Note:** You can add multiple URLs, one per line. Make sure the callback URL is included.

## Step 5: Update Webhook URL (If Applicable)

If your app setup has a separate webhook URL field:

**Set to:**
```
https://web-production-33f26.up.railway.app/api/webhooks/shopify
```

## Step 6: Verify Scopes

Ensure these scopes are enabled:
- ✅ `read_products`
- ✅ `read_inventory`
- ✅ `read_locations`
- ✅ `write_products` (if you need to update products)
- ✅ `write_inventory` (if you need to update inventory)

**How to check:**
1. Look for **"Scopes"** or **"API access scopes"** section
2. Ensure all required scopes are checked/enabled

## Step 7: Save Changes

1. Scroll to the bottom of the page
2. Click **"Save"** button
3. Wait for confirmation that changes are saved

## Step 8: Verify Changes

1. Refresh the page
2. Verify the URLs are updated correctly
3. Check that all URLs use `https://` (not `http://`)
4. Ensure no trailing slashes (`/`) at the end

## Visual Guide

```
Shopify Partners Dashboard
  └── Apps
      └── Your App Name
          └── App setup (click here)
              └── App URLs section
                  ├── App URL: https://web-production-33f26.up.railway.app
                  ├── Allowed redirection URL(s):
                  │   └── https://web-production-33f26.up.railway.app/api/auth/callback
                  └── Webhook URL (if exists):
                      └── https://web-production-33f26.up.railway.app/api/webhooks/shopify
```

## ⚠️ Important Notes

1. **Use HTTPS:** All URLs must start with `https://`
2. **No Trailing Slash:** Don't add `/` at the end of URLs
3. **Exact Match:** URLs must exactly match your Railway deployment URL
4. **Save Before Testing:** Always click "Save" before testing the app
5. **Wait for Propagation:** Changes may take a few minutes to propagate

## 🔍 Troubleshooting

### "Invalid redirect URL" Error
- ✅ Check the callback URL is exactly: `https://web-production-33f26.up.railway.app/api/auth/callback`
- ✅ Ensure it's added to "Allowed redirection URL(s)"
- ✅ Verify no typos in the URL

### App Won't Install
- ✅ Verify `APP_URL` in Railway matches the App URL in Partners Dashboard
- ✅ Check that callback URL is in the allowed list
- ✅ Ensure all URLs use `https://`

### OAuth Fails
- ✅ Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` in Railway match Partners Dashboard
- ✅ Check Railway logs for OAuth errors
- ✅ Verify callback URL is correct

## ✅ Verification Checklist

After updating URLs:
- [ ] App URL is set to Railway URL
- [ ] Callback URL is in allowed list
- [ ] All URLs use `https://`
- [ ] No trailing slashes
- [ ] Changes are saved
- [ ] Can install app in test store

## Quick Links

- **Shopify Partners Dashboard:** https://partners.shopify.com
- **Railway App URL:** https://web-production-33f26.up.railway.app
- **Health Check:** https://web-production-33f26.up.railway.app/health

