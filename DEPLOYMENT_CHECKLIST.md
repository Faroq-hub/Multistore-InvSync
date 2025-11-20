# Deployment Checklist

Use this checklist before and after deploying your application.

## Pre-Deployment

### Environment Variables

- [ ] `PORT` = 3000 (or platform default)
- [ ] `LOG_LEVEL` = info
- [ ] `ENCRYPTION_KEY` = Generated 32-byte hex string
- [ ] `ADMIN_TOKEN` = Generated secure token
- [ ] `DATABASE_URL` = PostgreSQL connection string (auto-set on Railway/Render/Heroku)
- [ ] `SHOPIFY_API_KEY` = Your Shopify app API key
- [ ] `SHOPIFY_API_SECRET` = Your Shopify app secret
- [ ] `SHOPIFY_SCOPES` = read_products,read_inventory,read_locations
- [ ] `SHOPIFY_API_VERSION` = 2024-10
- [ ] `SHOPIFY_WEBHOOK_SECRET` = Your webhook secret
- [ ] `SHOPIFY_WEBHOOK_BASE_URL` = Your deployment URL
- [ ] `APP_URL` = Your deployment URL (https://...)
- [ ] `NEXT_PUBLIC_SHOPIFY_API_KEY` = Your Shopify app API key
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` = Your support email
- [ ] `NODE_ENV` = production (usually auto-set)

### Generate Keys

```bash
# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Shopify App Settings

- [ ] **App URL** updated to: `https://your-deployment-url.com`
- [ ] **Allowed redirection URLs** includes: `https://your-deployment-url.com/api/auth/callback`
- [ ] **Webhook URL** set to: `https://your-deployment-url.com/api/webhooks/shopify`
- [ ] **Scopes** include: `read_products`, `read_inventory`, `read_locations`

### Code

- [ ] All code committed to Git
- [ ] `.env` is in `.gitignore`
- [ ] `node_modules/` is in `.gitignore`
- [ ] No hardcoded secrets in code
- [ ] Build succeeds locally: `npm run build && npm run build:next`

## Deployment Steps

### Choose Platform

- [ ] Railway (Recommended - Easiest)
- [ ] Render (Free tier available)
- [ ] Heroku (Industry standard)
- [ ] DigitalOcean (Performance)

### Deploy

- [ ] Connect GitHub repository
- [ ] Add PostgreSQL database (or use provided)
- [ ] Set all environment variables
- [ ] Trigger deployment
- [ ] Wait for build to complete

### Post-Deployment

- [ ] **Run database migration:**
  ```bash
  # Railway
  railway run npm run migrate:postgres
  
  # Render (via shell)
  npm run migrate:postgres
  
  # Heroku
  heroku run npm run migrate:postgres
  ```

- [ ] **Verify deployment:**
  ```bash
  curl https://your-url.com/health
  ```
  Should return: `{"status":"ok","timestamp":"..."}`

- [ ] **Check logs for errors:**
  - Railway: `railway logs`
  - Render: Service → Logs
  - Heroku: `heroku logs --tail`

## Testing

### Basic Tests

- [ ] App URL loads without errors
- [ ] Health endpoint returns OK: `/health`
- [ ] Can access Next.js app (if separate service)

### Shopify Integration

- [ ] **OAuth Flow:**
  - [ ] Click "Install App" in Shopify Admin
  - [ ] Redirects to app successfully
  - [ ] OAuth callback completes
  - [ ] App loads in Shopify Admin

- [ ] **Webhooks:**
  - [ ] Test webhook delivery in Shopify dashboard
  - [ ] Check logs for webhook events
  - [ ] Verify webhooks are registered

- [ ] **App Features:**
  - [ ] Can create connections
  - [ ] Can trigger sync
  - [ ] Can view connections list
  - [ ] Worker processes jobs (check logs)

### Database

- [ ] Can connect to database
- [ ] Tables created (check via platform database UI)
- [ ] Can insert test data
- [ ] Migrations applied successfully

## Monitoring

- [ ] Set up log monitoring
- [ ] Set up error alerts (if available)
- [ ] Monitor database connections
- [ ] Check disk space usage
- [ ] Monitor API response times

## Security

- [ ] HTTPS enabled (automatic on most platforms)
- [ ] Environment variables not exposed in logs
- [ ] `.env` not committed to Git
- [ ] Database requires SSL (if possible)
- [ ] Admin endpoints protected with `ADMIN_TOKEN`

## Backup

- [ ] Automated backups enabled (Railway/Render/Heroku do this)
- [ ] Test restore procedure
- [ ] Document backup frequency

## Custom Domain (Optional)

- [ ] Domain added to platform
- [ ] DNS configured (CNAME/A records)
- [ ] SSL certificate generated (automatic)
- [ ] Shopify app URLs updated with custom domain
- [ ] Test OAuth with custom domain

## Scaling (Future)

- [ ] Monitor resource usage
- [ ] Set up auto-scaling (if needed)
- [ ] Consider read replicas for database
- [ ] Set up CDN for static assets (if needed)

## Troubleshooting

### Common Issues

- [ ] **Build fails:**
  - Check build logs
  - Verify Node.js version
  - Ensure all dependencies in `package.json`

- [ ] **OAuth not working:**
  - Verify `APP_URL` matches deployment URL
  - Check Shopify app settings
  - Ensure HTTPS is enabled

- [ ] **Database connection fails:**
  - Verify `DATABASE_URL` is set
  - Check database is running
  - Test connection from shell

- [ ] **Worker not processing:**
  - Check service logs
  - Verify environment variables
  - Ensure worker service is running

## Documentation

- [ ] Deployment URL documented
- [ ] Environment variables documented
- [ ] Access credentials saved securely
- [ ] Team members have access (if applicable)

## Success Criteria

- [ ] ✅ App is accessible at deployment URL
- [ ] ✅ OAuth flow works end-to-end
- [ ] ✅ Webhooks are registered and receiving events
- [ ] ✅ Database migrations applied
- [ ] ✅ Worker processes jobs successfully
- [ ] ✅ All critical features working
- [ ] ✅ Monitoring and alerts set up

---

**Deployment Date:** _______________
**Deployment URL:** _______________
**Platform:** _______________
**Deployed By:** _______________

