# How to Add Environment Variables in Railway

## Step-by-Step Visual Guide

### Method 1: Using the Variables Tab (Recommended)

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Login to your account

2. **Select Your Project**
   - Click on your project name

3. **Select Your Service**
   - Click on the web service (the one you created for your app)
   - It might be named something like "reseller-feed-middleware" or "web"

4. **Open Variables Tab**
   - At the top of the service page, you'll see tabs: **Settings**, **Variables**, **Metrics**, **Deployments**, etc.
   - Click on **"Variables"** tab

5. **Add Variables**
   
   **Option A: Add One by One**
   - Click the **"+ New Variable"** button
   - Enter the variable name (e.g., `PORT`)
   - Enter the value (e.g., `3000`)
   - Click **"Add"** or press Enter
   - Repeat for each variable

   **Option B: Use Raw Editor (Faster)**
   - Click **"Raw Editor"** button (top right of Variables tab)
   - Paste all variables in this format:
     ```
     PORT=3000
     LOG_LEVEL=info
     ENCRYPTION_KEY=your-key-here
     ```
   - Click **"Save"**

### Method 2: Using Railway CLI

If you have Railway CLI installed:

```bash
# Set a single variable
railway variables set PORT=3000

# Set multiple variables from a file
railway variables < .env.production
```

## Visual Guide

```
Railway Dashboard
  └── Your Project
      └── Your Service (click here)
          └── Variables Tab (click here) ← YOU ARE HERE
              └── + New Variable (click to add)
              └── Raw Editor (click to paste all at once)
```

## What Variables to Add

### Required Variables

```env
# Server Configuration
PORT=3000
LOG_LEVEL=info

# Security (generate these - see below)
ENCRYPTION_KEY=your-32-byte-hex-key
ADMIN_TOKEN=your-secure-token

# Shopify App Credentials
SHOPIFY_API_KEY=your-api-key-from-shopify
SHOPIFY_API_SECRET=your-api-secret-from-shopify
SHOPIFY_SCOPES=read_products,read_inventory,read_locations
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# App URLs (use your Railway URL - find in Settings → Domains)
APP_URL=https://your-app-name.up.railway.app
SHOPIFY_WEBHOOK_BASE_URL=https://your-app-name.up.railway.app

# Next.js Public Variables
NEXT_PUBLIC_SHOPIFY_API_KEY=your-api-key-from-shopify
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

### Auto-Added Variables

Railway automatically adds these (don't add manually):
- ✅ `DATABASE_URL` - Added when you create PostgreSQL database
- ✅ `RAILWAY_ENVIRONMENT` - Auto-set by Railway
- ✅ `PORT` - Can be auto-set, but you can override

## Finding Your Railway URL

1. Go to your service
2. Click **"Settings"** tab
3. Scroll to **"Domains"** section
4. You'll see your Railway URL like: `https://your-app-name.up.railway.app`
5. Use this URL for `APP_URL` and `SHOPIFY_WEBHOOK_BASE_URL`

## Generating Keys

**Generate ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate ADMIN_TOKEN:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste as the value in Railway.

## Tips

1. **Use Raw Editor** for adding many variables at once
2. **Don't add quotes** around values in Railway (it adds them automatically)
3. **Check for typos** - variable names are case-sensitive
4. **Save after adding** - changes are saved automatically
5. **Redeploy** - After adding variables, Railway may auto-redeploy, or you can trigger it manually

## Verifying Variables

After adding variables:

1. Go to **"Deployments"** tab
2. Check the latest deployment logs
3. You should see your app starting with the new variables
4. If you see errors about missing variables, double-check spelling

## Common Mistakes

❌ **Wrong:** Adding `DATABASE_URL` manually (Railway adds it automatically)
❌ **Wrong:** Using quotes: `PORT="3000"` (use: `PORT=3000`)
❌ **Wrong:** Adding spaces: `PORT = 3000` (use: `PORT=3000`)
❌ **Wrong:** Using localhost URLs (use your Railway URL)

✅ **Correct:** `PORT=3000`
✅ **Correct:** `APP_URL=https://your-app.up.railway.app`
✅ **Correct:** No quotes, no spaces around `=`

## Need Help?

- Railway Docs: https://docs.railway.app/develop/variables
- Railway Discord: https://discord.gg/railway
- Check deployment logs if variables aren't working

