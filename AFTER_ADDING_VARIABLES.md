# What to Do After Adding Environment Variables

## Quick Checklist

After adding all environment variables in Railway, follow these steps:

## Step 1: Wait for Auto-Deployment ⏳

**What happens:**
- Railway automatically detects variable changes
- Triggers a new deployment automatically
- Builds your application with new variables

**What to do:**
1. Go to **"Deployments"** tab in your Railway service
2. Watch for a new deployment starting (you'll see "Building..." or "Deploying...")
3. Wait for it to complete (usually 2-5 minutes)

**How to check:**
- Green checkmark ✅ = Success
- Red X ❌ = Failed (check logs)

## Step 2: Check Deployment Logs 📋

**After deployment completes:**

1. Click on the latest deployment
2. Click **"View Logs"**
3. Look for:
   - ✅ `Server listening on 3000` = Backend started
   - ✅ `Ready on http://localhost:3001` = Frontend started
   - ❌ Any error messages = Something wrong

**Common issues:**
- Missing variables → Add them
- Build errors → Check build logs
- Port conflicts → Usually auto-handled

## Step 3: Run Database Migration 🗄️

**IMPORTANT:** Run this after first successful deployment!

**Method 1: Railway Shell (Easiest)**

1. Go to your service → **"Deployments"** tab
2. Click on the latest deployment
3. Click **"View Logs"**
4. Click **"Shell"** button (top right)
5. Run this command:
   ```bash
   npm run migrate:postgres
   ```
6. Wait for: `Migration completed` or similar success message

**Method 2: Railway CLI**

If you have Railway CLI installed:
```bash
railway run npm run migrate:postgres
```

**What this does:**
- Creates all database tables
- Sets up indexes
- Prepares database for your app

**Note:** You only need to run this once, or when schema changes.

## Step 4: Verify Your App is Live 🌐

**Test your deployment:**

1. **Get your Railway URL:**
   - Go to Settings → Domains
   - Copy your URL (e.g., `https://your-app.up.railway.app`)

2. **Test health endpoint:**
   - Visit: `https://your-app.up.railway.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`
   - ✅ If you see this, backend is working!

3. **Test main app:**
   - Visit: `https://your-app.up.railway.app`
   - Should see your app interface
   - ✅ If it loads, frontend is working!

## Step 5: Update Shopify App Settings 🔗

**Before testing OAuth, update Shopify:**

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Open your app
3. Go to **"App setup"**
4. Update these URLs (use your Railway URL):

   **App URL:**
   ```
   https://your-app-name.up.railway.app
   ```

   **Allowed redirection URL(s):**
   ```
   https://your-app-name.up.railway.app/api/auth/callback
   ```

   **Webhook URL:**
   ```
   https://your-app-name.up.railway.app/api/webhooks/shopify
   ```

5. **Save changes**

## Step 6: Test OAuth Flow 🔐

**Test the complete flow:**

1. Go to your Shopify store admin
2. Navigate to **Apps** → **Develop apps**
3. Find your app → Click **"Install"**
4. Should redirect to Railway URL
5. OAuth should complete
6. App should load in Shopify Admin ✅

**If OAuth fails:**
- Check `APP_URL` matches Railway URL exactly
- Verify Shopify app settings are saved
- Check Railway logs for OAuth errors

## Step 7: Test App Features 🧪

**Verify everything works:**

1. **Create a connection:**
   - Try adding a Shopify connection
   - Should save successfully

2. **Check worker:**
   - Go to Railway → Deployments → View Logs
   - Look for worker processing messages
   - Should see: `Processing job...` or similar

3. **Test sync:**
   - Trigger a full sync
   - Check logs for sync activity
   - Verify jobs are being processed

## Step 8: Monitor & Maintain 📊

**Ongoing tasks:**

1. **Check logs regularly:**
   - Railway → Deployments → View Logs
   - Look for errors or warnings

2. **Monitor database:**
   - Railway → PostgreSQL service → Metrics
   - Check connection count, storage usage

3. **Set up alerts (optional):**
   - Railway → Settings → Notifications
   - Get notified of deployment failures

## Troubleshooting

### Deployment Failed

**Check:**
- Build logs for errors
- All required variables are set
- No typos in variable names
- Database is running

**Fix:**
- Review error messages in logs
- Add missing variables
- Fix any build errors

### App Not Loading

**Check:**
- Health endpoint works: `/health`
- All environment variables are set
- Database migration ran successfully
- No errors in logs

**Fix:**
- Check logs for specific errors
- Verify `APP_URL` is correct
- Ensure database is accessible

### OAuth Not Working

**Check:**
- `APP_URL` matches Railway URL exactly
- Shopify app settings are updated
- Redirect URL is correct
- HTTPS is enabled (Railway does this automatically)

**Fix:**
- Update Shopify app URLs
- Verify `APP_URL` variable
- Check Railway logs for OAuth errors

### Database Errors

**Check:**
- Migration ran successfully
- `DATABASE_URL` is set (auto-set by Railway)
- Database service is running

**Fix:**
- Run migration again: `npm run migrate:postgres`
- Verify PostgreSQL service is active
- Check database connection in logs

## Success Indicators ✅

You're all set when:

- ✅ Deployment shows green checkmark
- ✅ Health endpoint returns OK
- ✅ App loads in browser
- ✅ OAuth flow completes
- ✅ Database migration succeeded
- ✅ No errors in logs
- ✅ Worker processing jobs

## Next Steps

Once everything is working:

1. **Set up custom domain** (optional)
   - Railway → Settings → Domains
   - Add your domain
   - Update Shopify app URLs

2. **Configure backups**
   - Railway handles PostgreSQL backups automatically
   - Check backup settings in PostgreSQL service

3. **Monitor performance**
   - Check metrics regularly
   - Set up alerts for issues

4. **Scale if needed**
   - Railway auto-scales, but you can adjust resources
   - Settings → Service → Resources

## Need Help?

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Check logs** for specific error messages
- **Review** `DEPLOYMENT_CHECKLIST.md` for complete checklist

