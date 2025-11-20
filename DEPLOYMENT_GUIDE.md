# Deployment Guide: Deploy to Production

This guide covers deploying your application online to various hosting platforms.

## Quick Start Options (Easiest)

### Option 1: Railway (Recommended - Easiest)

**Best for:** Quick deployment with built-in PostgreSQL

#### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your repository

3. **Add PostgreSQL Database**
   - In Railway dashboard, click "+ New"
   - Select "PostgreSQL"
   - Railway auto-creates `DATABASE_URL` environment variable

4. **Configure Environment Variables**
   - Go to your service → Variables tab
   - Add these required variables:
   ```
   PORT=3000
   LOG_LEVEL=info
   ENCRYPTION_KEY=your-32-byte-encryption-key-here
   
   SHOPIFY_API_KEY=your-shopify-api-key
   SHOPIFY_API_SECRET=your-shopify-api-secret
   SHOPIFY_SCOPES=read_products,read_inventory,read_locations
   SHOPIFY_API_VERSION=2024-10
   SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
   SHOPIFY_WEBHOOK_BASE_URL=https://your-app-name.up.railway.app
   
   APP_URL=https://your-app-name.up.railway.app
   NEXT_PUBLIC_SHOPIFY_API_KEY=your-shopify-api-key
   NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
   
   ADMIN_TOKEN=your-secure-admin-token
   ```

5. **Update Shopify App Settings**
   - Go to your Shopify Partners dashboard
   - Update "App URL" to: `https://your-app-name.up.railway.app`
   - Update "Allowed redirection URL(s)" to: `https://your-app-name.up.railway.app/api/auth/callback`
   - Update "Webhook URL" to: `https://your-app-name.up.railway.app/api/webhooks/shopify`

6. **Deploy**
   - Railway auto-deploys on push to main branch
   - Check logs for deployment status
   - Run migration: `railway run npm run migrate:postgres` (or add to startup)

7. **Custom Domain (Optional)**
   - Go to Settings → Networking
   - Add your custom domain
   - Update Shopify app URLs with custom domain

**Cost:** ~$5/month for starter plan

---

### Option 2: Render

**Best for:** Free tier available, easy PostgreSQL setup

#### Steps:

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Choose name, region, plan
   - Note the "Internal Database URL" and "External Database URL"

3. **Create Web Service (Backend)**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - **Name:** `inventory-sync-api`
     - **Environment:** Node
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `npm start`
     - **Port:** 3000

4. **Create Web Service (Frontend)**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - **Name:** `inventory-sync-app`
     - **Environment:** Node
     - **Build Command:** `npm install && npm run build:next`
     - **Start Command:** `npm run start:next`
     - **Port:** 3001

5. **Configure Environment Variables**
   - For both services, go to Environment tab
   - Add all required variables (same as Railway above)
   - Use "Internal Database URL" for `DATABASE_URL`

6. **Update Shopify App Settings**
   - Use your Render URLs (format: `https://inventory-sync-app.onrender.com`)

7. **Run Migration**
   - Go to Backend service → Shell
   - Run: `npm run migrate:postgres`

**Cost:** Free tier available, paid plans start at $7/month

---

### Option 3: Heroku

**Best for:** Industry standard, robust platform

#### Steps:

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

4. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   # DATABASE_URL is automatically set
   ```

5. **Set Environment Variables**
   ```bash
   heroku config:set PORT=3000
   heroku config:set LOG_LEVEL=info
   heroku config:set ENCRYPTION_KEY=your-encryption-key
   heroku config:set SHOPIFY_API_KEY=your-api-key
   heroku config:set SHOPIFY_API_SECRET=your-api-secret
   heroku config:set SHOPIFY_SCOPES=read_products,read_inventory,read_locations
   heroku config:set SHOPIFY_API_VERSION=2024-10
   heroku config:set SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
   heroku config:set SHOPIFY_WEBHOOK_BASE_URL=https://your-app-name.herokuapp.com
   heroku config:set APP_URL=https://your-app-name.herokuapp.com
   heroku config:set NEXT_PUBLIC_SHOPIFY_API_KEY=your-api-key
   heroku config:set NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
   heroku config:set ADMIN_TOKEN=your-admin-token
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

7. **Run Migration**
   ```bash
   heroku run npm run migrate:postgres
   ```

8. **View Logs**
   ```bash
   heroku logs --tail
   ```

**Cost:** Free tier discontinued, starts at ~$7/month

---

### Option 4: DigitalOcean App Platform

**Best for:** Simple pricing, good performance

#### Steps:

1. **Create DigitalOcean Account**
   - Go to [digitalocean.com](https://www.digitalocean.com)
   - Sign up

2. **Create Managed PostgreSQL Database**
   - Go to Databases → Create Database
   - Choose PostgreSQL, plan, region
   - Note connection details

3. **Create App**
   - Go to App Platform → Create App
   - Connect GitHub repository

4. **Configure Services**
   - **Backend Service:**
     - Build Command: `npm install && npm run build`
     - Run Command: `npm start`
     - Port: 3000
   - **Frontend Service:**
     - Build Command: `npm install && npm run build:next`
     - Run Command: `npm run start:next`
     - Port: 3001

5. **Add Environment Variables**
   - Add all required variables
   - Use database connection string for `DATABASE_URL`

6. **Deploy**
   - DigitalOcean auto-deploys on push

**Cost:** Starts at ~$12/month (includes database)

---

## Architecture Options

### Option A: Single Service (Backend + Frontend Together)

**Recommended for:** Railway, Render, Heroku

Both services run together:
```bash
# In package.json, update start script:
"start": "concurrently \"npm run start:api\" \"npm run start:next\""
```

**Pros:**
- Simpler deployment
- Single URL
- Lower cost

**Cons:**
- Less flexible scaling
- Must handle both on same port (use reverse proxy)

### Option B: Separate Services (Backend + Frontend)

**Recommended for:** Render, DigitalOcean, AWS

Deploy backend and frontend separately:

1. **Backend Service:**
   - Port: 3000
   - Handles API, webhooks, workers

2. **Frontend Service:**
   - Port: 3001
   - Next.js app
   - Configured to call backend API

**Pros:**
- Independent scaling
- Better separation of concerns
- Can deploy separately

**Cons:**
- More complex setup
- Need to configure CORS
- Higher cost (2 services)

### Option C: Vercel (Frontend) + Railway (Backend)

**Best for:** Optimal performance and cost

1. **Deploy Backend to Railway** (see Option 1)
2. **Deploy Frontend to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import GitHub repository
   - Configure:
     - Framework: Next.js
     - Build Command: `npm run build:next`
     - Environment Variables: All `NEXT_PUBLIC_*` variables
   - Add `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`

**Pros:**
- Optimal Next.js performance on Vercel
- Global CDN for frontend
- Separate scaling

**Cons:**
- Two platforms to manage
- Need to configure CORS

---

## Important Configuration Steps

### 1. Update Shopify App Settings

After deployment, update in Shopify Partners Dashboard:

1. Go to your app settings
2. **App URL:** `https://your-domain.com`
3. **Allowed redirection URL(s):** `https://your-domain.com/api/auth/callback`
4. **Webhook URL:** `https://your-domain.com/api/webhooks/shopify`
5. Save changes

### 2. Generate Encryption Key

```bash
# Generate a secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use:
```bash
openssl rand -hex 32
```

Set this as `ENCRYPTION_KEY` in your hosting platform.

### 3. Generate Admin Token

```bash
# Generate secure admin token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set this as `ADMIN_TOKEN`.

### 4. Database Migration

After first deployment, run migration:

```bash
# Railway
railway run npm run migrate:postgres

# Render (via shell)
npm run migrate:postgres

# Heroku
heroku run npm run migrate:postgres
```

Or add to startup script (check platform-specific docs).

### 5. Run Initial Migration Automatically

Create a startup script:

**File: `scripts/start.sh`**
```bash
#!/bin/bash
# Run migration if using PostgreSQL
if [ -n "$DATABASE_URL" ]; then
  echo "Running PostgreSQL migration..."
  npm run migrate:postgres
fi

# Start the application
npm start
```

Then update `package.json`:
```json
{
  "scripts": {
    "start": "node scripts/start.sh"
  }
}
```

---

## Custom Domain Setup

### Railway

1. Go to project → Settings → Networking
2. Click "Add Domain"
3. Add your domain
4. Configure DNS:
   - Add CNAME record: `your-domain.com` → `your-app.up.railway.app`
5. Update Shopify app URLs with custom domain

### Render

1. Go to service → Settings → Custom Domains
2. Add your domain
3. Configure DNS as shown
4. Update Shopify app URLs

### Heroku

1. Go to app → Settings
2. Click "Add domain"
3. Add custom domain
4. Configure DNS:
   ```bash
   heroku domains:add your-domain.com
   ```
5. Add CNAME record in your DNS provider

---

## Monitoring & Logs

### View Logs

**Railway:**
```bash
railway logs
```

**Render:**
- Go to service → Logs tab

**Heroku:**
```bash
heroku logs --tail
```

### Health Check

Test your deployment:
```bash
curl https://your-domain.com/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

---

## Common Issues & Solutions

### Issue 1: DATABASE_URL not set

**Solution:**
- Verify PostgreSQL addon is created
- Check environment variables are set correctly
- Restart the service

### Issue 2: OAuth redirect errors

**Solution:**
- Verify `APP_URL` matches your deployed URL
- Check Shopify app settings have correct redirect URL
- Ensure HTTPS is enabled (required by Shopify)

### Issue 3: Worker not processing jobs

**Solution:**
- Check logs for errors
- Verify database connection
- Ensure environment variables are set

### Issue 4: Build failures

**Solution:**
- Check build logs
- Verify Node.js version matches (should be 18+)
- Ensure all dependencies are in `package.json`

---

## Security Checklist

- [ ] `ENCRYPTION_KEY` is set (32+ bytes)
- [ ] `ADMIN_TOKEN` is set (secure random)
- [ ] `SHOPIFY_API_SECRET` is set
- [ ] Database uses SSL connections
- [ ] HTTPS is enabled
- [ ] Environment variables are not exposed
- [ ] `.env` file is in `.gitignore`

---

## Cost Comparison

| Platform | Free Tier | Paid Start | PostgreSQL | Best For |
|----------|-----------|------------|------------|----------|
| Railway | ❌ | ~$5/mo | Included | Easiest |
| Render | ✅ | $7/mo | Add-on | Free tier |
| Heroku | ❌ | ~$7/mo | Add-on | Industry standard |
| DigitalOcean | ❌ | ~$12/mo | Included | Performance |
| Vercel + Railway | ✅ | ~$5/mo | Included | Optimal setup |

---

## Recommended Setup

**For Beginners:** Railway (Option 1)
- Easiest setup
- Built-in PostgreSQL
- Auto-deployment
- Good documentation

**For Best Performance:** Vercel (Frontend) + Railway (Backend)
- Optimal Next.js hosting
- Separate scaling
- Global CDN

**For Cost Optimization:** Render
- Free tier available
- Easy PostgreSQL setup
- Good for development/testing

---

## Next Steps After Deployment

1. ✅ Test OAuth flow
2. ✅ Test webhook delivery
3. ✅ Test sync jobs
4. ✅ Set up monitoring
5. ✅ Configure backups
6. ✅ Set up custom domain
7. ✅ Configure SSL (auto on most platforms)

---

## Need Help?

- Check platform-specific documentation
- Review error logs
- Test locally first
- Verify all environment variables are set
- Check Shopify app settings match deployment URL

