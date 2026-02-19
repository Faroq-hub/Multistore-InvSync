# App Store Compliance Webhooks

Per [Shopify's privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance), apps distributed through the App Store must:

1. **Subscribe to mandatory compliance webhooks**: `customers/data_request`, `customers/redact`, `shop/redact`
2. **Verify webhooks with HMAC** – return `401` if the `X-Shopify-Hmac-Sha256` header is invalid
3. **Respond with 200** to confirm receipt

## Implementation

- **Endpoint**: `POST /api/webhooks/shopify` (Next.js API route)
- **HMAC**: Uses `SHOPIFY_API_SECRET` (client secret) with timing-safe comparison
- **Response**: Returns `200` for valid webhooks, `401` for invalid HMAC

## Configuration

### Option A: Shopify CLI (recommended)

1. Edit `shopify.app.toml`:
   - Replace `YOUR_CLIENT_ID` with your app's Client ID
   - Replace `YOUR_APP_URL` with your production URL (e.g. `https://your-app.up.railway.app`)

2. Deploy the config:
   ```bash
   shopify app deploy
   ```

### Option B: Partner Dashboard

1. Go to [Shopify Partners](https://partners.shopify.com) → Your app → **Configuration**
2. Open **Event subscriptions** (or **Webhooks**)
3. Add subscription for compliance topics:
   - **Endpoint URL**: `https://YOUR_APP_URL/api/webhooks/shopify`
   - **Topics**: `customers/data_request`, `customers/redact`, `shop/redact`

### Environment variables

Ensure these are set in production:

| Variable | Description |
|----------|-------------|
| `APP_URL` | Your app's public URL (e.g. `https://your-app.up.railway.app`) |
| `SHOPIFY_API_SECRET` | Your app's Client secret (used for HMAC verification) |

## Testing

Use Shopify CLI to trigger a test webhook:

```bash
shopify app webhook trigger --topic customers/redact
```

Or send a manual POST to your endpoint with a valid HMAC to verify the handler responds correctly.
