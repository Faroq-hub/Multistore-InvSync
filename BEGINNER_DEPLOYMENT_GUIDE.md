# 🚀 Complete Beginner's Guide: Deploying to Production with PostgreSQL

This guide will walk you through deploying your app to production step-by-step, as if you've never done it before. We'll use **Railway** because it's the easiest platform and handles everything for you.

---

## 📋 What You'll Need Before Starting

1. **A GitHub account** (free) - [github.com](https://github.com)
2. **Your code pushed to GitHub** (if not already done)
3. **A Shopify Partner account** (free) - [partners.shopify.com](https://partners.shopify.com)
4. **About 30 minutes** of your time

---

## 🎯 What We're Going to Do (Overview)

1. **Deploy your app** to Railway (a hosting platform)
2. **Add a PostgreSQL database** (where your data will be stored)
3. **Configure environment variables** (secret keys and settings)
4. **Run database migrations** (set up the database tables)
5. **Test everything** to make sure it works

Think of it like moving into a new house:
- Railway = The house (where your app lives)
- PostgreSQL = The storage room (where your data lives)
- Environment variables = The keys and passwords
- Migrations = Setting up the furniture (database tables)

---

## Step 1: Push Your Code to GitHub (5 minutes)

**If your code is already on GitHub, skip to Step 2.**

### What is GitHub?
GitHub is like Google Drive for code. It stores your code online so Railway can access it.

### How to Push Your Code:

1. **Open Terminal** (Mac) or **Command Prompt** (Windows)

2. **Navigate to your project folder:**
   ```bash
   cd /Users/FarooqK/reseller-feed-middleware
   ```

3. **Check if you have a git repository:**
   ```bash
   git status
   ```
   - If it says "not a git repository", continue to step 4
   - If it shows files, skip to step 6

4. **Initialize git (if needed):**
   ```bash
   git init
   ```

5. **Create a `.gitignore` file** (if you don't have one):
   ```bash
   echo "node_modules/
   .env
   data/
   *.db
   dist/
   .next/" > .gitignore
   ```

6. **Add all files:**
   ```bash
   git add .
   ```

7. **Commit the files:**
   ```bash
   git commit -m "Initial commit"
   ```

8. **Create a new repository on GitHub:**
   - Go to [github.com/new](https://github.com/new)
   - Name it `reseller-feed-middleware` (or any name you like)
   - Click "Create repository"
   - **Don't** initialize with README (you already have code)

9. **Connect and push:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/reseller-feed-middleware.git
   git branch -M main
   git push -u origin main
   ```
   (Replace `YOUR_USERNAME` with your GitHub username)

**✅ Done!** Your code is now on GitHub.

---

## Step 2: Sign Up for Railway (2 minutes)

### What is Railway?
Railway is a hosting platform that runs your app on the internet. It's like renting a server, but much easier.

### How to Sign Up:

1. **Go to [railway.app](https://railway.app)**

2. **Click "Start a New Project"**

3. **Choose "Deploy from GitHub repo"**
   - This connects Railway to your GitHub account
   - You'll need to authorize Railway to access your repositories

4. **Select your repository:**
   - Find `reseller-feed-middleware` in the list
   - Click on it

5. **Railway will automatically:**
   - Detect it's a Node.js project
   - Start building your app
   - This might take a few minutes

**✅ Done!** Railway is now connected to your code.

---

## Step 3: Add PostgreSQL Database (2 minutes)

### What is PostgreSQL?
PostgreSQL is a database - think of it as a super-organized filing cabinet for your app's data (users, connections, jobs, etc.).

### How to Add It:

1. **In Railway dashboard**, you'll see your project

2. **Click the "+ New" button** (usually in the top right or bottom of the project)

3. **Select "Database" → "PostgreSQL"**

4. **Railway will automatically:**
   - Create a PostgreSQL database
   - Add a `DATABASE_URL` environment variable (you don't need to do anything!)
   - This is the connection string your app uses to talk to the database

**✅ Done!** Your database is ready. Railway automatically set up `DATABASE_URL` for you.

---

## Step 4: Generate Secret Keys (5 minutes)

### What are Secret Keys?
Secret keys are like passwords that your app uses to encrypt data and authenticate requests. They need to be random and secret.

### How to Generate Them:

1. **Open Terminal** (Mac) or **Command Prompt** (Windows)

2. **Generate ENCRYPTION_KEY:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   - Copy the output (it will be a long string of letters and numbers)
   - **Save it somewhere safe** - you'll need it in the next step
   - Example output: `a1b2c3d4e5f6...` (64 characters)

3. **Generate ADMIN_TOKEN:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   - Copy this output too
   - **Save it somewhere safe**
   - This is different from the first one!

**💡 Tip:** Keep these keys safe! You'll need them in the next step.

**✅ Done!** You have your secret keys.

---

## Step 5: Set Up Environment Variables (10 minutes)

### What are Environment Variables?
Environment variables are settings that your app needs to run. Think of them as configuration options that change between development and production.

### How to Add Them in Railway:

1. **In Railway dashboard**, click on your **service** (the web service, not PostgreSQL)
   - It should be named something like "reseller-feed-middleware" or "web"

2. **Click the "Variables" tab** (at the top of the page)
   - You'll see a list of existing variables (like `DATABASE_URL` which Railway added automatically)

3. **Click "+ New Variable"** button

4. **Add each variable one by one:**

   **Server Settings:**
   ```
   PORT = 3000
   ```
   (Click "Add", then add the next one)

   ```
   LOG_LEVEL = info
   ```

   **Security Keys (use the ones you generated in Step 4):**
   ```
   ENCRYPTION_KEY = paste-your-encryption-key-here
   ```
   (Paste the ENCRYPTION_KEY you generated)

   ```
   ADMIN_TOKEN = paste-your-admin-token-here
   ```
   (Paste the ADMIN_TOKEN you generated)

   **Shopify Settings:**
   ```
   SHOPIFY_API_KEY = your-shopify-api-key
   ```
   (Get this from Shopify Partners Dashboard → Your App → App setup)

   ```
   SHOPIFY_API_SECRET = your-shopify-api-secret
   ```
   (Get this from Shopify Partners Dashboard → Your App → App setup)

   ```
   SHOPIFY_SCOPES = read_products,read_inventory,read_locations
   ```

   ```
   SHOPIFY_API_VERSION = 2024-10
   ```

   ```
   SHOPIFY_WEBHOOK_SECRET = your-webhook-secret
   ```
   (Get this from Shopify Partners Dashboard → Your App → App setup → Webhooks)

   **App URL (Important!):**
   First, find your Railway URL:
   - Go to your service → "Settings" tab
   - Look for "Domains" section
   - You'll see something like: `your-app-name.up.railway.app`
   - Copy this URL

   Then add:
   ```
   APP_URL = https://your-app-name.up.railway.app
   ```
   (Replace with your actual Railway URL)

   ```
   SHOPIFY_WEBHOOK_BASE_URL = https://your-app-name.up.railway.app
   ```
   (Same URL as above)

   **Next.js Public Variables:**
   ```
   NEXT_PUBLIC_SHOPIFY_API_KEY = your-shopify-api-key
   ```
   (Same as SHOPIFY_API_KEY above)

   ```
   NEXT_PUBLIC_SUPPORT_EMAIL = support@yourdomain.com
   ```
   (Your support email)

5. **After adding all variables:**
   - Railway will automatically redeploy your app
   - You'll see a new deployment starting
   - Wait for it to complete (check the "Deployments" tab)

**💡 Tip:** You can also use Railway's "Raw Editor" to paste all variables at once if you prefer.

**✅ Done!** Your environment variables are set up.

---

## Step 6: Update Shopify App Settings (5 minutes)

### Why Do This?
Shopify needs to know where your app is hosted so it can redirect users correctly.

### How to Update:

1. **Go to [partners.shopify.com](https://partners.shopify.com)**

2. **Log in** and go to your app

3. **Click "App setup"** in the left sidebar

4. **Update these URLs** (use your Railway URL from Step 5):

   **App URL:**
   ```
   https://your-app-name.up.railway.app
   ```

   **Allowed redirection URL(s):**
   ```
   https://your-app-name.up.railway.app/api/auth/callback
   ```

   **Webhook URL (if you have webhook settings):**
   ```
   https://your-app-name.up.railway.app/webhooks/shopify
   ```

5. **Click "Save"**

**✅ Done!** Shopify knows where your app is.

---

## Step 7: Run Database Migration (5 minutes)

### What is a Migration?
A migration sets up your database tables (like creating the structure of your filing cabinet). It creates tables for installations, connections, jobs, etc.

### ⚡ Good News: Migrations Run Automatically!

**Your app automatically runs migrations when it starts!** However, it's still good to run it manually once to verify everything works.

### How to Run It (Optional but Recommended):

**Option A: Using Railway CLI (Easiest - Recommended)**

1. **Install Railway CLI:**
   
   **On Mac:**
   ```bash
   brew install railway
   ```
   
   **On Windows/Linux:**
   - Download from: https://docs.railway.app/develop/cli
   - Or use: `npm i -g @railway/cli`

2. **Login to Railway:**
   ```bash
   railway login
   ```
   - This opens your browser to authenticate
   - Click "Authorize"

3. **Link to your project:**
   ```bash
   railway link
   ```
   - Select your project when prompted
   - Select your service (the web service, not PostgreSQL)

4. **Run the migration:**
   ```bash
   railway run npm run migrate:postgres
   ```
   - You'll see output like:
     ```
     Starting PostgreSQL migration...
     ✓ Connected to PostgreSQL
     [DB] PostgreSQL migration completed
     ```
   - If you see "already exists" messages, that's fine - it means tables were already created

**Option B: Using Railway Dashboard (If CLI doesn't work)**

1. **Go to your service** in Railway dashboard
2. **Click "Settings" tab**
3. **Look for "Run Command" or "One-off Command"**
4. **Enter:** `npm run migrate:postgres`
5. **Click "Run"**

**✅ Done!** Your database tables are created.

**💡 Note:** Even if you skip this step, migrations will run automatically when your app starts. Check the logs to see: `[DB] PostgreSQL migration completed`

---

## Step 8: Verify Everything Works (5 minutes)

### Test Your Deployment:

1. **Check if your app is live:**
   - Go to your Railway URL: `https://your-app-name.up.railway.app`
   - You should see your app loading (or a "Not Found" page is okay - that means the server is running)

2. **Check the logs:**
   - In Railway dashboard → Your Service → "Deployments" tab
   - Click on the latest deployment
   - Click "View Logs"
   - Look for:
     ```
     [DB] Using PostgreSQL database
     Server listening on 3000
     ```
   - If you see errors, check the troubleshooting section below

3. **Test OAuth (Install your app):**
   - Go to your Shopify store admin
   - Navigate to Apps → Find your app → Click "Install"
   - You should be redirected to Railway URL
   - OAuth should complete
   - App should load in Shopify Admin ✅

4. **Check database connection:**
   - In Railway logs, you should see: `[DB] Using PostgreSQL database`
   - If you see `[DB] Using SQLite database`, check that `DATABASE_URL` is set

**✅ Done!** Your app is deployed and working!

---

## 🎉 Congratulations!

Your app is now live in production with PostgreSQL! Here's what happens next:

- **Every time you push to GitHub** → Railway automatically redeploys ✅
- **Your database** → Automatically backed up by Railway
- **Your logs** → Available in Railway dashboard
- **Scaling** → Railway handles it automatically

---

## 🔧 Troubleshooting

### Problem: Build Fails

**Symptoms:** Deployment shows "Build Failed" in Railway

**Solutions:**
1. Check build logs in Railway → Deployments → Latest → View Logs
2. Make sure all dependencies are in `package.json`
3. Check for TypeScript errors: `npm run typecheck`

### Problem: Can't Connect to Database

**Symptoms:** Logs show "DATABASE_URL not set" or connection errors

**Solutions:**
1. Verify PostgreSQL service is running (green status in Railway)
2. Check that `DATABASE_URL` exists in Variables tab (Railway adds it automatically)
3. Make sure you're looking at the web service, not PostgreSQL service

### Problem: OAuth Not Working

**Symptoms:** Redirect errors or "Invalid shop domain"

**Solutions:**
1. Verify `APP_URL` matches your Railway URL exactly
2. Check Shopify app settings match Railway URL
3. Ensure URLs use `https://` (not `http://`)
4. Check `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are correct

### Problem: Migration Fails

**Symptoms:** `railway run npm run migrate:postgres` shows errors

**Solutions:**
1. Check that PostgreSQL service is running
2. Verify `DATABASE_URL` is set
3. Try running migration again (it's safe to run multiple times)
4. Check migration script exists: `ls scripts/migrate-postgres.js`

### Problem: App Shows Errors

**Symptoms:** App loads but shows error messages

**Solutions:**
1. Check Railway logs for specific error messages
2. Verify all environment variables are set correctly
3. Make sure database migration completed successfully
4. Check that Shopify app settings are correct

---

## 📚 Next Steps

### Custom Domain (Optional)

If you want to use your own domain (like `app.yourdomain.com`):

1. Go to Railway → Your Service → Settings → Domains
2. Click "Add Domain"
3. Add your domain
4. Configure DNS (Railway shows instructions)
5. Update `APP_URL` and Shopify settings with new domain

### Monitoring

- **Logs:** Railway dashboard → Your Service → Deployments → View Logs
- **Metrics:** Railway dashboard → Your Service → Metrics tab
- **Database:** Railway dashboard → PostgreSQL service → Metrics

### Updates

To update your app:
1. Make changes to your code
2. Push to GitHub: `git push`
3. Railway automatically deploys! ✅

---

## 💡 Key Concepts Explained

**Railway:** A platform that runs your app on the internet. Like renting a server, but easier.

**PostgreSQL:** A database that stores your app's data. Like a filing cabinet for your app.

**Environment Variables:** Settings your app needs to run. Like configuration options.

**Migration:** Setting up database tables. Like organizing your filing cabinet.

**Deployment:** Putting your app online. Like publishing a website.

---

## 🆘 Need Help?

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Check logs:** Railway dashboard → Your Service → Deployments → View Logs

---

**You did it! 🎉** Your app is now live in production with PostgreSQL support!

