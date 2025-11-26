# Email Template: Short Version - Store Connection Request

**Subject:** Quick Setup: Connect Your Store for Product Sync

---

Hi [Client Name],

To set up automated product synchronization, we need some connection details from your store. Please provide the following based on your platform:

## Shopify Stores

**Required Information:**
1. **Shop Domain:** `your-store.myshopify.com` (from Shopify Admin URL)
2. **Access Token:** 
   - Go to Settings → Apps and sales channels → Develop apps → Create app
   - Configure Admin API scopes: `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`
   - Install app and copy the Admin API access token (starts with `shpat_`)
3. **Location ID:** 
   - Go to Settings → Locations → Click your location
   - The number at the end of the URL is your Location ID

## WooCommerce Stores

**Required Information:**
1. **Base URL:** `https://your-store.com` (your website URL)
2. **Consumer Key & Secret:**
   - Go to WooCommerce → Settings → Advanced → REST API
   - Add new key with Read/Write permissions
   - Copy both Consumer Key (`ck_...`) and Consumer Secret (`cs_...`) immediately

**Important:** Copy API credentials immediately - you won't be able to see them again!

Please send the information in this format:

**Shopify:**
- Shop Domain: [your-store.myshopify.com]
- Access Token: [shpat_...]
- Location ID: [123456789]

**WooCommerce:**
- Base URL: [https://your-store.com]
- Consumer Key: [ck_...]
- Consumer Secret: [cs_...]

Questions? Just reply to this email.

Thanks!
[Your Name]

