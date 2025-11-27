# Environment Variables Checklist

Quick reference for all required environment variables in Railway.

## ✅ Automatically Set by Railway (Don't Add These)

- `DATABASE_URL` - PostgreSQL connection string (auto-set)
- `PORT` - Server port (usually 8080, auto-set)
- `NODE_ENV` - Set to `production` (auto-set)

## ⚠️ Required Variables to Add

### Security Keys

Generate these first:
```bash
# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN  
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then add to Railway:
- [ ] `ENCRYPTION_KEY` = `[generated-32-byte-hex]`
- [ ] `ADMIN_TOKEN` = `[generated-32-byte-hex]`

### Shopify Configuration

Get these from Shopify Partners Dashboard → Your App → App setup:

- [ ] `SHOPIFY_API_KEY` = `[from-partners-dashboard]`
- [ ] `SHOPIFY_API_SECRET` = `[from-partners-dashboard]`
- [ ] `SHOPIFY_SCOPES` = `read_products,read_inventory,read_locations,write_products,write_inventory`
- [ ] `SHOPIFY_API_VERSION` = `2024-10`
- [ ] `SHOPIFY_WEBHOOK_SECRET` = `[from-partners-dashboard]`
- [ ] `SHOPIFY_WEBHOOK_BASE_URL` = `https://web-production-33f26.up.railway.app`

### App URLs

- [ ] `APP_URL` = `https://web-production-33f26.up.railway.app`
- [ ] `NEXT_PUBLIC_SHOPIFY_API_KEY` = `[same-as-SHOPIFY_API_KEY]`
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` = `support@yourdomain.com`

### Optional

- [ ] `LOG_LEVEL` = `info` (default: `info`)

## 📋 Quick Copy-Paste for Raw Editor

```env
ENCRYPTION_KEY=your-generated-32-byte-hex-key
ADMIN_TOKEN=your-generated-32-byte-hex-token
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,write_products,write_inventory
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_WEBHOOK_BASE_URL=https://web-production-33f26.up.railway.app
APP_URL=https://web-production-33f26.up.railway.app
NEXT_PUBLIC_SHOPIFY_API_KEY=your-api-key
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
LOG_LEVEL=info
```

## 🔍 How to Verify Variables Are Set

1. Go to Railway Variables tab
2. Check each variable is present
3. Verify values are correct (click "Show value" for each)
4. Ensure no typos in variable names

## ⚠️ Common Mistakes

- ❌ Adding `DATABASE_URL` manually (Railway sets it automatically)
- ❌ Using `localhost` URLs (must use Railway URL)
- ❌ Missing `NEXT_PUBLIC_` prefix for client-side variables
- ❌ Wrong `SHOPIFY_WEBHOOK_BASE_URL` (must match Railway URL)
- ❌ Using development API keys in production

## ✅ Verification

After adding all variables:
1. Redeploy the service (Railway will auto-redeploy)
2. Check deployment logs for any errors
3. Test health endpoint: `curl https://web-production-33f26.up.railway.app/health`
4. Try installing the app in a test store

