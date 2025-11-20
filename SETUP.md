# Setup Guide

## Prerequisites

1. Node.js 18+ installed
2. Shopify Partner account
3. Shopify app created in Partner Dashboard
4. ngrok (for local development) or a public domain (for production)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit `.env` file with your credentials:

```env
# Shopify App Credentials (from Partner Dashboard)
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# App URL (use ngrok for local dev)
APP_URL=https://your-ngrok-url.ngrok.io
NEXT_PUBLIC_SHOPIFY_API_KEY=your-api-key
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com

# Admin Token (generate a random string)
ADMIN_TOKEN=your-admin-token

# Optional: Direct API access token
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxx
```

### 3. Set Up ngrok (Local Development)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start ngrok on port 3001 (Next.js app)
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update APP_URL in .env
APP_URL=https://abc123.ngrok.io
```

### 4. Configure Shopify App

1. Go to Shopify Partner Dashboard
2. Select your app
3. Go to "App setup"
4. Set **App URL** to your ngrok URL (or production URL)
5. Set **Allowed redirection URLs**:
   - `https://your-url.ngrok.io/api/auth/callback`
   - `https://your-url.ngrok.io/api/auth/callback?shop={shop}`
6. Set **Scopes**:
   - `read_products`
   - `read_inventory`
   - `read_locations`
7. Save changes

### 5. Run the Application

**Start both servers:**
```bash
npm run dev:all
```

**Or start separately:**
```bash
# Terminal 1: API Server (port 3000)
npm run dev

# Terminal 2: Next.js App (port 3001)
npm run dev:next
```

### 6. Install App on Shopify Store

1. Go to your Shopify store admin
2. Navigate to Apps → Develop apps
3. Find your app and click "Install"
4. Approve the installation
5. The app will open in Shopify Admin

### 7. Add Connections

1. In the app UI, click "Add Connection"
2. Choose connection type (Shopify or WooCommerce)
3. Fill in the connection details:
   - **Shopify**: Shop domain, Access token, Location ID
   - **WooCommerce**: Base URL, Consumer Key, Consumer Secret
4. Click "Create"
5. Connection will be created and ready to sync

### 8. Trigger Sync

1. In the connections list, click "Sync Now" for a connection
2. A full sync job will be queued
3. Check job status in the admin API or audit logs

## Testing

### Test API Server

```bash
# Health check
curl http://localhost:3000/health

# List connections
curl http://localhost:3000/admin/connections \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Test Next.js App

```bash
# Open in browser
open http://localhost:3001
```

### Test OAuth Flow

1. Visit: `https://your-ngrok-url.ngrok.io?shop=your-store.myshopify.com`
2. Shopify will redirect to OAuth flow
3. After approval, you'll be redirected back to the app

## Production Deployment

### 1. Update Environment Variables

Set all environment variables in your hosting platform:
- Vercel/Netlify: Environment variables in dashboard
- Docker: Use `.env` file or environment variables
- Kubernetes: Use ConfigMaps/Secrets

### 2. Update Shopify App Settings

1. Update **App URL** to your production URL
2. Update **Allowed redirection URLs** to production URLs
3. Update **Webhook URLs** to production URLs

### 3. Deploy

**Vercel (Next.js App):**
```bash
vercel deploy
```

**Docker:**
```bash
docker build -t multi-store-sync .
docker run -p 3000:3000 -p 3001:3001 multi-store-sync
```

## Troubleshooting

### OAuth Issues

- **Issue**: OAuth redirect fails
- **Solution**: Check `APP_URL` matches your public URL, verify redirect URLs in Shopify app settings

### Database Issues

- **Issue**: Database file not found
- **Solution**: Ensure `data/` directory exists and is writable

### Sync Issues

- **Issue**: Sync jobs not running
- **Solution**: Check connection status, verify destination store credentials, review audit logs

### Port Conflicts

- **Issue**: Port 3000 or 3001 already in use
- **Solution**: Change ports in `.env` and `package.json`

## Next Steps

1. Set up webhooks for automatic sync
2. Configure mapping rules for connections
3. Monitor sync jobs and audit logs
4. Scale to multiple destination stores

