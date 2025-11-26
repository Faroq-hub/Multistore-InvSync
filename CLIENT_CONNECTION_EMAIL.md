# Email Template: Request for Store Connection Setup

**Subject:** Action Required: Connect Your Store for Product Synchronization

---

Dear [Client Name],

We're excited to set up automated product synchronization between your store and our inventory system. This will ensure your products, inventory levels, and pricing stay up-to-date automatically.

## What You Need to Provide

The information required depends on your store platform. Please follow the instructions below based on your setup:

---

## For Shopify Stores

If your destination store is on Shopify, we need the following information:

### 1. **Shop Domain**
- **What it is:** Your Shopify store's domain
- **Format:** `your-store-name.myshopify.com`
- **How to find it:**
  - Log into your Shopify Admin
  - Look at the URL in your browser - it will show your shop domain
  - Or go to Settings → General → Store details

### 2. **Admin API Access Token**
- **What it is:** A secure token that allows our app to access your store's products and inventory
- **Format:** Starts with `shpat_` followed by a long string
- **How to get it:**
  1. Log into your Shopify Admin
  2. Go to **Settings** → **Apps and sales channels**
  3. Click **Develop apps** (at the bottom)
  4. Click **Create an app**
  5. Give it a name (e.g., "Product Sync") and click **Create app**
  6. Click **Configure Admin API scopes**
  7. Enable the following scopes:
     - `read_products`
     - `write_products`
     - `read_inventory`
     - `write_inventory`
     - `read_locations`
  8. Click **Save**
  9. Go to the **API credentials** tab
  10. Click **Install app**
  11. Click **Reveal token once** and copy the **Admin API access token** (starts with `shpat_`)
  12. **Important:** Copy this immediately - you won't be able to see it again!

### 3. **Location ID** (Required for inventory sync)
- **What it is:** The unique identifier for your inventory location
- **Format:** A number (e.g., `71365394530`)
- **How to find it:**
  - **Option 1 (Easiest):**
    1. Go to **Settings** → **Locations** in Shopify Admin
    2. Click on your main location
    3. Look at the URL - the number at the end is your Location ID
    4. Example: `https://admin.shopify.com/store/your-store/settings/locations/71365394530`
    5. The Location ID is `71365394530`
  
  - **Option 2 (Using API):**
    1. Use the Shopify API: `GET /admin/api/2024-10/locations.json`
    2. The Location ID will be in the response

---

## For WooCommerce Stores

If your destination store is on WooCommerce, we need the following information:

### 1. **Base URL**
- **What it is:** Your WooCommerce store's website URL
- **Format:** `https://your-store.com` (without `/wp-json` or trailing slashes)
- **Example:** `https://cheron-london.co.uk`
- **How to find it:** Simply your website's main URL

### 2. **Consumer Key**
- **What it is:** API key for accessing your WooCommerce store
- **Format:** Starts with `ck_` followed by a long string
- **How to get it:**
  1. Log into your WordPress Admin
  2. Go to **WooCommerce** → **Settings** → **Advanced** → **REST API**
  3. Click **Add key**
  4. Fill in the details:
     - **Description:** "Product Sync" (or any name you prefer)
     - **User:** Select an administrator account
     - **Permissions:** Select **Read/Write**
  5. Click **Generate API key**
  6. **Important:** Copy the **Consumer Key** immediately (starts with `ck_`) - you won't be able to see it again!

### 3. **Consumer Secret**
- **What it is:** Secret key paired with the Consumer Key
- **Format:** Starts with `cs_` followed by a long string
- **How to get it:**
  - Generated at the same time as the Consumer Key
  - **Important:** Copy the **Consumer Secret** immediately (starts with `cs_`) - you won't be able to see it again!
  - If you missed it, you'll need to create a new API key pair

---

## Security Notes

- **Keep these credentials secure** - treat them like passwords
- **Never share them publicly** or commit them to version control
- If you suspect a credential has been compromised, revoke it immediately and generate new ones
- For Shopify: You can revoke access by deleting the app in **Settings** → **Apps and sales channels** → **Develop apps**
- For WooCommerce: You can revoke access by deleting the API key in **WooCommerce** → **Settings** → **Advanced** → **REST API**

---

## What Happens Next

Once you provide this information, we will:
1. Set up the connection in our system
2. Test the connection to ensure everything works
3. Configure automatic synchronization
4. Notify you once the sync is active

## Questions or Need Help?

If you have any questions or need assistance gathering this information, please don't hesitate to reach out. We're here to help make this process as smooth as possible.

**Response Format:** Please provide the information in the following format:

**For Shopify:**
```
Store Name: [Your store name]
Shop Domain: [your-store.myshopify.com]
Access Token: [shpat_...]
Location ID: [123456789]
```

**For WooCommerce:**
```
Store Name: [Your store name]
Base URL: [https://your-store.com]
Consumer Key: [ck_...]
Consumer Secret: [cs_...]
```

Thank you for your cooperation. We look forward to getting your store connected!

Best regards,
[Your Name]
[Your Company]
[Contact Information]

---

**P.S.** If you're unsure which platform your store uses, please let us know and we can help identify it.

