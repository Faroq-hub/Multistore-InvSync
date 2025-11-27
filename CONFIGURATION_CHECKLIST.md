# Configuration Verification Checklist

## ✅ Completed
- [x] PostgreSQL service created
- [x] Web service redeployed
- [x] Health endpoint working (HTTP 200)
- [x] Server running and responding

## ⏳ To Verify

### 1. Database Configuration

**Check Deployment Logs:**
1. Go to: https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d
2. Click on latest deployment → "Deploy Log" tab
3. Search for: `[DB] Using PostgreSQL`
4. ✅ Should see: `[DB] Using PostgreSQL database: postgresql://...`
5. ❌ Should NOT see: `[DB] Using SQLite database: /app/data/app.db`

**Check Variables:**
1. Go to Variables tab
2. Look for `DATABASE_URL`
3. ✅ Should exist and start with `postgresql://`

### 2. Environment Variables

**Required Variables:**
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `PORT` - Server port (usually auto-set)
- [ ] `NODE_ENV=production`

**Shopify Configuration:**
- [ ] `SHOPIFY_API_KEY` - From Shopify Partners Dashboard
- [ ] `SHOPIFY_API_SECRET` - From Shopify Partners Dashboard
- [ ] `SHOPIFY_SCOPES` - e.g., `read_products,read_inventory,read_locations`
- [ ] `SHOPIFY_API_VERSION` - e.g., `2024-10`
- [ ] `SHOPIFY_WEBHOOK_SECRET` - From Shopify Partners Dashboard
- [ ] `SHOPIFY_WEBHOOK_BASE_URL` - `https://web-production-33f26.up.railway.app`
- [ ] `APP_URL` - `https://web-production-33f26.up.railway.app`
- [ ] `NEXT_PUBLIC_SHOPIFY_API_KEY` - Same as `SHOPIFY_API_KEY`

**Security:**
- [ ] `ENCRYPTION_KEY` - 32-byte hex string (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] `ADMIN_TOKEN` - Secure token for admin API (generate similar to above)

### 3. Shopify App Configuration

**Update in Shopify Partners Dashboard:**
1. Go to: https://partners.shopify.com
2. Select your app
3. Go to "App setup"
4. Update these URLs:
   - **App URL:** `https://web-production-33f26.up.railway.app`
   - **Allowed redirection URL(s):** `https://web-production-33f26.up.railway.app/api/auth/callback`
   - **Webhook URL:** `https://web-production-33f26.up.railway.app/api/webhooks/shopify`

### 4. API Endpoint Testing

**Test Script:**
```bash
./test-endpoints.sh
```

**Manual Tests:**
```bash
# Health (no auth required)
curl https://web-production-33f26.up.railway.app/health

# Feed (requires API key)
curl -H "X-API-Key: YOUR_API_KEY" \
  https://web-production-33f26.up.railway.app/v1/feed.json?limit=1

# Admin (requires admin token)
curl -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  https://web-production-33f26.up.railway.app/admin/connections
```

### 5. Full Workflow Testing

**Test Shopify App:**
1. [ ] Install app in a test Shopify store
2. [ ] Complete OAuth flow
3. [ ] App loads in Shopify admin
4. [ ] Connections page displays
5. [ ] Can create Shopify destination connection
6. [ ] Can create WooCommerce destination connection
7. [ ] Can trigger full sync
8. [ ] Sync job processes successfully
9. [ ] Data syncs to destination store
10. [ ] Audit logs show sync operations

**Test Webhooks:**
1. [ ] Make change in source store
2. [ ] Webhook received (check logs)
3. [ ] Delta sync job created
4. [ ] Changes sync to destination

## 📊 Current Status

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Deployment | ✅ Working | None |
| Health Endpoint | ✅ Working | None |
| PostgreSQL Service | ✅ Created | Verify usage in logs |
| DATABASE_URL | ⏳ Unknown | Check Variables tab |
| Environment Variables | ⏳ Unknown | Verify all are set |
| Shopify Config | ⏳ Unknown | Update Partners Dashboard |
| API Endpoints | ⏳ Needs Testing | Test with auth tokens |
| Full Workflow | ⏳ Needs Testing | Test app installation |

## 🔗 Quick Links

- **Railway Project:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c
- **Web Service:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d
- **Variables:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d/variables
- **Deployments:** https://railway.com/project/bbb06b28-2c0e-4784-9c38-1a5060ea126c/service/b3d13674-dbdd-45e3-a605-6a78a94bf85d?environmentId=bff08052-0ff3-4842-8e58-80ff08c1ba2a
- **App URL:** https://web-production-33f26.up.railway.app
- **Health Check:** https://web-production-33f26.up.railway.app/health

## 📝 Next Actions

1. **Verify DATABASE_URL is set** - Check Variables tab
2. **Check deployment logs** - Confirm PostgreSQL is being used
3. **Verify all environment variables** - Ensure Shopify config is complete
4. **Update Shopify app URLs** - In Partners Dashboard
5. **Test API endpoints** - Use test script or manual curl commands
6. **Test full workflow** - Install app and create connections

