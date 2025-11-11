## Reseller Feed Middleware

Read-only middleware that exposes a consistent product/inventory feed from your Shopify store (and optional WooCommerce source) for resellers. Returns JSON and XML. Per-reseller API keys with rotation, webhooks, scheduled refresh.

### Quick start
1. Install deps and run dev:
```
npm install
npm run dev
```
2. Configure `.env`:
```
PORT=3000
LOG_LEVEL=info
DEFAULT_TEST_API_KEY=dev_test_key_please_rotate

SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2024-10
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxx

WOO_BASE_URL=https://your-wordpress-site.com
WOO_CONSUMER_KEY=ck_xxx
WOO_CONSUMER_SECRET=cs_xxx

ADMIN_TOKEN=your-admin-token
FEED_REFRESH_MINUTES=120
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
```

### Admin API
- Create reseller (returns `api_key`):
```
curl -X POST http://localhost:3000/admin/resellers \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Partner A","version":"v1"}'
```
- List resellers:
```
curl http://localhost:3000/admin/resellers -H "X-Admin-Token: $ADMIN_TOKEN"
```
- Rotate key:
```
curl -X POST http://localhost:3000/admin/resellers/RESELLER_ID/rotate-key \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Feed endpoints
- JSON feed with pagination/filters:
```
curl "http://localhost:3000/v1/feed.json?page=1&limit=200&in_stock=true&category=Apparel" \
  -H "X-API-Key: RESELLER_API_KEY"
```
- XML feed:
```
curl "http://localhost:3000/v1/feed.xml?limit=100" -H "X-API-Key: RESELLER_API_KEY"
```
- Delta since timestamp:
```
curl "http://localhost:3000/v1/feed/since/2025-01-01T00:00:00Z" -H "X-API-Key: RESELLER_API_KEY"
```
- Discontinued SKUs since last refresh:
```
curl "http://localhost:3000/v1/feed/discontinued.json" -H "X-API-Key: RESELLER_API_KEY"
```
- Force refresh now (optional):
```
curl "http://localhost:3000/v1/feed.json?refresh=true" -H "X-API-Key: RESELLER_API_KEY"
```

### Webhooks
- Shopify: point to `/webhooks/shopify` and set `SHOPIFY_WEBHOOK_SECRET`. Topics: `products/update`, `inventory_levels/update`.
- WooCommerce: point to `/webhooks/woocommerce`.

### Data shape
```
{
  "version": "1.0",
  "generated_at": "2025-11-11T10:00:00Z",
  "items": [
    {
      "title": "Acme Tee - Blue / M",
      "sku": "ACM-TEE-BLU-M",
      "price": "24.99",
      "currency": "USD",
      "stock": 38,
      "image_url": "https://...jpg",
      "category": "Apparel/T-Shirts",
      "product_handle": "acme-tee",
      "updated_at": "2025-11-10T18:20:00Z",
      "source": "shopify"
    }
  ]
}
```

### Notes
- SKU is the primary key. Ensure uniqueness across products/variants.
- Scheduler runs every `FEED_REFRESH_MINUTES` (default 120) with small jitter. Webhooks trigger additional refreshes.
- ETag/Last-Modified headers are enabled. Use If-None-Match/If-Modified-Since in clients.

