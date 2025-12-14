# Multi-Store Inventory Sync

A Shopify embedded app that syncs inventory and products from your source Shopify store to multiple destination stores (Shopify and WooCommerce).

## Architecture

- **Backend API Server (Fastify)**: Runs on port 3000, handles webhooks, sync jobs, and admin APIs
- **Embedded App UI (Next.js)**: Runs on port 3001, provides Polaris UI for managing connections
- **Database (SQLite)**: Stores installations, connections, jobs, and audit logs

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Server
PORT=3000
LOG_LEVEL=info
ADMIN_TOKEN=your-admin-token
ENCRYPTION_KEY=base64-or-hex-32-byte-key

# Shopify Source Store
SHOPIFY_API_KEY=your-app-api-key
SHOPIFY_API_SECRET=your-app-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxx  # Optional: for direct API access
SHOPIFY_WEBHOOK_BASE_URL=https://your-public-api-host

# App URL (for OAuth redirects)
APP_URL=http://localhost:3001
NEXT_PUBLIC_SHOPIFY_API_KEY=your-app-api-key
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com

# WooCommerce (optional source)
WOO_BASE_URL=https://your-wordpress-site.com
WOO_CONSUMER_KEY=ck_xxx
WOO_CONSUMER_SECRET=cs_xxx

# Feed Settings
FEED_DEFAULT_CURRENCY=USD
FEED_REFRESH_MINUTES=120
```

### 3. Set Up Shopify App

1. Go to Shopify Partner Dashboard → Apps → Create app
2. Set App URL to: `https://your-domain.com` (or use ngrok for local dev)
3. Set Allowed redirection URLs:
   - `https://your-domain.com/api/auth/callback`
   - `https://your-domain.com/api/auth/callback?shop={shop}`
4. Copy API Key and API Secret to `.env`
5. Set scopes: `read_products`, `read_inventory`, `read_locations`

### 4. Run the Application

**Development (both servers):**
```bash
npm run dev:all
```

**Or run separately:**
```bash
# Terminal 1: API Server
npm run dev

# Terminal 2: Next.js App
npm run dev:next
```

**Production:**
```bash
# Build
npm run build
npm run build:next

# Start
npm start        # API server on port 3000
npm run start:next  # Next.js app on port 3001
```

### 5. Access the App

1. Install the app on your Shopify store
2. Access via: `https://your-store.myshopify.com/admin/apps/your-app`
3. The embedded UI will open in Shopify Admin

## Local Development with ngrok

For local OAuth, use ngrok:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start ngrok
ngrok http 3001

# Update APP_URL in .env with ngrok URL
APP_URL=https://your-ngrok-url.ngrok.io

# Update Shopify app settings with ngrok URL
```

## Features

### Connections Management

- **Add Shopify Connection**: Connect destination Shopify stores
- **Add WooCommerce Connection**: Connect WooCommerce stores
- **Pause/Resume**: Control sync per connection
- **Full Sync**: Trigger manual sync for a connection
- **Delta Sync**: Sync only changed SKUs (via webhooks)

### Sync Engine

- **SKU-based sync**: Updates products/variants by SKU
- **Price sync**: Syncs product prices
- **Inventory sync**: Updates stock levels
- **Retry logic**: Automatic retries with exponential backoff
- **Audit logs**: Track all sync operations

### Mapping Rules

- **Price multiplier**: Adjust prices per connection (e.g., +10%)
- **Category mapping**: Map categories between stores
- **Exclude products**: Exclude specific products or categories

## API Endpoints

### Admin API (API Server - Port 3000)

#### Connections

```bash
# List connections
curl http://localhost:3000/admin/connections \
  -H "X-Admin-Token: $ADMIN_TOKEN"

# Create Shopify connection
curl -X POST http://localhost:3000/admin/connections/shopify \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dest Shop A",
    "dest_shop_domain": "dest-store.myshopify.com",
    "access_token": "shpat_xxx",
    "dest_location_id": "123456789"
  }'

# Create WooCommerce connection
curl -X POST http://localhost:3000/admin/connections/woocommerce \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dest Woo A",
    "base_url": "https://dest-woo.example.com",
    "consumer_key": "ck_xxx",
    "consumer_secret": "cs_xxx"
  }'

# Trigger full sync
curl -X POST http://localhost:3000/admin/connections/CONN_ID/full-sync \
  -H "X-Admin-Token: $ADMIN_TOKEN"

# Pause connection
curl -X POST http://localhost:3000/admin/connections/CONN_ID/pause \
  -H "X-Admin-Token: $ADMIN_TOKEN"

# Resume connection
curl -X POST http://localhost:3000/admin/connections/CONN_ID/resume \
  -H "X-Admin-Token: $ADMIN_TOKEN"

# Update connection rules
curl -X POST http://localhost:3000/admin/connections/CONN_ID/rules \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price_multiplier": 1.10}'
```

#### Jobs

```bash
# List jobs
curl "http://localhost:3000/admin/jobs?limit=50" \
  -H "X-Admin-Token: $ADMIN_TOKEN"

# Get job details
curl "http://localhost:3000/admin/jobs/JOB_ID" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

#### Audit Logs

```bash
# List audit logs
curl "http://localhost:3000/admin/audit?limit=200" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Webhooks

#### Shopify Webhooks
All required webhooks (`products/*`, `inventory_levels/update`, `app/uninstalled`, GDPR topics) are registered automatically during OAuth using `SHOPIFY_WEBHOOK_BASE_URL`. Make sure that value resolves publicly to the Fastify server (e.g., `https://your-ngrok-url.ngrok.io` or your production domain). The handler lives at `/webhooks/shopify` and requires the `SHOPIFY_WEBHOOK_SECRET` for HMAC validation.

#### WooCommerce Webhooks

Point to: `https://your-domain.com/webhooks/woocommerce`

#### GDPR & Privacy Requests
- `customers/data_request` and `customers/redact` events are logged to the audit table for manual processing or downstream handling.
- `shop/redact` is honoured automatically by disabling the installation, removing cached feed data, clearing stored Shopify webhooks, and pausing all connections.

Ensure your contact email and privacy policy in the Shopify Partner Dashboard reflect how merchants can request additional data handling.

## Next.js App API (Port 3001)

The Next.js app provides API routes that use the same database:

- `GET /api/connections` - List connections
- `POST /api/connections/shopify` - Create Shopify connection
- `POST /api/connections/woocommerce` - Create WooCommerce connection
- `POST /api/connections/[id]/full-sync` - Trigger full sync
- `POST /api/connections/[id]/pause` - Pause connection
- `POST /api/connections/[id]/resume` - Resume connection

## Database Schema

### Installations
Stores source Shopify store installation (where app is installed).

### Connections
Stores destination store connections (Shopify or WooCommerce).

### Jobs
Stores sync jobs (full_sync or delta).

### Job Items
Stores individual SKU sync operations per job.

### Audit Logs
Stores all sync operations for debugging and monitoring.

## Deployment

**For comprehensive deployment guides, see:**
- [`DEPLOYMENT.md`](DEPLOYMENT.md) - General deployment guide
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [`POSTGRES_DEPLOYMENT.md`](POSTGRES_DEPLOYMENT.md) - PostgreSQL-specific deployment

### Recommended Platforms

1. **Railway** (Easiest) - Built-in PostgreSQL, auto-deployment
2. **Render** - Free tier available, easy setup
3. **Heroku** - Industry standard, robust platform
4. **Vercel + Railway** - Optimal performance (frontend + backend separate)

### Environment Variables

Set all environment variables in your hosting platform:
- Railway/Render/Heroku: Environment variables in dashboard
- Docker: Use `.env` file or environment variables
- Kubernetes: Use ConfigMaps/Secrets

### Database

The application supports both SQLite (default) and PostgreSQL:

**SQLite (Development/Default):**
- No configuration needed
- Database file: `data/app.db`
- Suitable for low-concurrency scenarios
- Automatically initialized on first run

**PostgreSQL (Production):**
- Set `DATABASE_URL` environment variable
- Format: `postgresql://user:password@host:port/database`
- Run migration: `npm run migrate:postgres`
- See [`POSTGRES_DEPLOYMENT.md`](POSTGRES_DEPLOYMENT.md) for production deployment

**Migrating from SQLite to PostgreSQL:**
```bash
# Export data from SQLite and import to PostgreSQL
npm run migrate:sqlite-to-postgres
# Or use: ./scripts/migrate-sqlite-to-postgres.sh
```

**Backups:**
- Run `npm run backup` for automated backups
- Backups are stored in `./backups/` directory
- Automatic retention (30 days)
- See `scripts/restore-db.sh` for restore instructions

### Scaling

- **API Server**: Can scale horizontally (stateless)
- **Next.js App**: Can scale horizontally (stateless)
- **Database**: Use PostgreSQL with connection pooling
- **Job Queue**: Consider Redis + BullMQ for distributed job processing

## Troubleshooting

### OAuth Issues

- Ensure `APP_URL` matches your public URL
- Check Allowed redirection URLs in Shopify app settings
- Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are correct

### Sync Issues

- Check connection status in UI
- Review audit logs for errors
- Verify destination store credentials
- Check job status in admin API

### Database Issues

- Ensure `data/` directory is writable
- Check database file permissions
- Review database logs

## License

ISC
