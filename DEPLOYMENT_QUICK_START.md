# Quick Deployment Guide (10 Minutes)

## Easiest Method: Railway

### Step 1: Setup Railway (2 minutes)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository

### Step 2: Add Database (1 minute)

1. In Railway dashboard, click "+ New"
2. Select "PostgreSQL"
3. Railway automatically creates `DATABASE_URL` ✅

### Step 3: Add Environment Variables (5 minutes)

**Where to add them in Railway:**

1. In Railway dashboard, click on your **service** (the web service you just created)
2. Click on the **"Variables"** tab (at the top of the service page)
3. Click **"+ New Variable"** button
4. Add each variable one by one, or use **"Raw Editor"** to paste multiple at once

**Steps:**
- Click your service name in Railway dashboard
- Click **"Variables"** tab (next to Settings, Metrics, etc.)
- Click **"+ New Variable"** for each variable
- Or click **"Raw Editor"** to paste all at once

Add these variables:

```env
# Server
PORT=3000
LOG_LEVEL=info

# Generate these keys (see below):
ENCRYPTION_KEY=your-generated-key-here
ADMIN_TOKEN=your-generated-token-here

# Shopify
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# App URL (replace with your Railway URL - find it in Settings → Domains)
APP_URL=https://your-app-name.up.railway.app
SHOPIFY_WEBHOOK_BASE_URL=https://your-app-name.up.railway.app

# Next.js (public variables)
NEXT_PUBLIC_SHOPIFY_API_KEY=your-shopify-api-key
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

**💡 Tip:** After adding PostgreSQL, Railway automatically adds `DATABASE_URL` - you don't need to add it manually!

**Generate Keys:**
```bash
# In terminal, run:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output for ENCRYPTION_KEY

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output for ADMIN_TOKEN
```

### Step 4: Update Shopify App Settings (2 minutes)

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Open your app
3. Go to "App setup"
4. Update these URLs (use your Railway URL):
   - **App URL:** `https://your-app-name.up.railway.app`
   - **Allowed redirection URL(s):** `https://your-app-name.up.railway.app/api/auth/callback`
   - **Webhook URL:** `https://your-app-name.up.railway.app/api/webhooks/shopify`
5. Save

### Step 5: Deploy & Migrate (1 minute)

**What happens after adding variables:**

1. **Railway auto-redeploys** - When you add/change variables, Railway automatically triggers a new deployment
2. **Wait for deployment** - Check the "Deployments" tab to see the build progress
3. **Run database migration** (after first successful deployment):
   
   **Option A: Using Railway CLI (Recommended)**
   
   First, install Railway CLI:
   ```bash
   # macOS
   brew install railway
   
   # Or download from: https://docs.railway.app/develop/cli
   ```
   
   Then login and run migration:
   ```bash
   # Login to Railway
   railway login
   
   # Link to your project (select your project when prompted)
   railway link
   
   # Run migration
   railway run npm run migrate:postgres
   ```
   
   **Option B: Using Railway Dashboard**
   
   If you can't find Shell button, try:
   1. Go to your service → Click "Settings" tab
   2. Scroll down to "Service Settings"
   3. Look for "Run Command" or "One-off Command" option
   4. Or go to your PostgreSQL service → Click "Connect" → Use the connection string
   
   **Option C: Manual SQL Execution**
   
   1. Go to your PostgreSQL service in Railway
   2. Click "Connect" or "Query" tab
   3. Copy the connection details
   4. Use a PostgreSQL client (like pgAdmin, DBeaver, or psql) to connect
   5. Run the migration SQL file manually

4. **Verify deployment** - Check logs to ensure app started successfully

### Step 6: Verify Everything Works (2 minutes)

**After deployment completes:**

1. **Check your app is live:**
   - Go to your Railway URL: `https://your-app-name.up.railway.app`
   - You should see your app loading! ✅
   - If you see an error, check the logs (Deployments → Latest → View Logs)

2. **Test health endpoint:**
   - Visit: `https://your-app-name.up.railway.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

3. **Test OAuth flow:**
   - Go to your Shopify store admin
   - Navigate to Apps → Find your app → Click "Install"
   - Should redirect to Railway URL and complete OAuth
   - App should load in Shopify Admin ✅

4. **Check logs for errors:**
   - Go to Railway → Your Service → Deployments → Latest → View Logs
   - Look for any error messages
   - Worker should be processing (if you have connections)

---

## That's It! 🎉

Your app is now live. Railway auto-deploys when you push to GitHub.

### Your App URL

Railway provides a URL like:
```
https://your-app-name.up.railway.app
```

### Custom Domain (Optional)

1. Go to project → Settings → Networking
2. Click "Add Domain"
3. Add your domain
4. Configure DNS (Railway shows instructions)

---

## Troubleshooting

**Build fails?**
- Check build logs in Railway
- Ensure `package.json` has all dependencies

**Can't connect to database?**
- Verify `DATABASE_URL` is set (auto-set by Railway)
- Check PostgreSQL addon is running

**OAuth not working?**
- Verify Shopify app URLs match Railway URL
- Check `APP_URL` environment variable
- Ensure HTTPS is enabled (Railway does this automatically)

**Worker not processing?**
- Check service logs
- Verify all environment variables are set

---

## What Happens Next?

- **Every GitHub push** → Auto-deploys ✅
- **Database** → Automatically backed up by Railway
- **Logs** → Available in Railway dashboard
- **Scaling** → Railway handles it automatically

---

## Need More Details?

See `DEPLOYMENT_GUIDE.md` for:
- Other platforms (Render, Heroku, etc.)
- Separate frontend/backend deployment
- Custom domain setup
- Security best practices
- Cost comparisons

