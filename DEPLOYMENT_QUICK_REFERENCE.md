# 🚀 Quick Deployment Reference Card

## One-Page Cheat Sheet for Production Deployment

---

## ✅ Pre-Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Railway account created
- [ ] PostgreSQL database added in Railway
- [ ] All environment variables set
- [ ] Shopify app URLs updated
- [ ] Database migration run

---

## 🔑 Required Environment Variables

Copy-paste this list when setting up Railway:

```
PORT=3000
LOG_LEVEL=info
ENCRYPTION_KEY=<generate-with-node-command>
ADMIN_TOKEN=<generate-with-node-command>
SHOPIFY_API_KEY=<from-shopify-partners>
SHOPIFY_API_SECRET=<from-shopify-partners>
SHOPIFY_SCOPES=read_products,read_inventory,read_locations
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=<from-shopify-partners>
APP_URL=https://your-app.up.railway.app
SHOPIFY_WEBHOOK_BASE_URL=https://your-app.up.railway.app
NEXT_PUBLIC_SHOPIFY_API_KEY=<same-as-SHOPIFY_API_KEY>
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
```

**Note:** `DATABASE_URL` is automatically added by Railway when you add PostgreSQL.

---

## 🔐 Generate Secret Keys

Run these commands in terminal:

```bash
# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗄️ Run Database Migration

**Using Railway CLI (Recommended):**
```bash
railway login
railway link
railway run npm run migrate:postgres
```

**Or migrations run automatically** when the app starts (check logs to confirm).

---

## 🔗 Update Shopify App URLs

In Shopify Partners Dashboard → Your App → App setup:

- **App URL:** `https://your-app.up.railway.app`
- **Redirect URL:** `https://your-app.up.railway.app/api/auth/callback`
- **Webhook URL:** `https://your-app.up.railway.app/webhooks/shopify`

---

## 🧪 Quick Test

1. Visit: `https://your-app.up.railway.app`
2. Check logs: Railway → Service → Deployments → View Logs
3. Look for: `[DB] Using PostgreSQL database` ✅
4. Install app in Shopify store

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Build fails | Check build logs, verify dependencies |
| Database error | Verify PostgreSQL is running, check DATABASE_URL |
| OAuth fails | Check APP_URL matches Railway URL exactly |
| Migration fails | Run again, check PostgreSQL is running |

---

## 📞 Quick Links

- **Railway Dashboard:** https://railway.app
- **Shopify Partners:** https://partners.shopify.com
- **Railway CLI Docs:** https://docs.railway.app/develop/cli

---

## 💡 Pro Tips

1. **Migrations run automatically** - Check logs to confirm `[DB] PostgreSQL migration completed`
2. **Railway auto-deploys** - Every GitHub push triggers a new deployment
3. **Check logs first** - Most issues show up in Railway logs
4. **DATABASE_URL is automatic** - Railway adds it when you create PostgreSQL

---

**For detailed step-by-step instructions, see:** `BEGINNER_DEPLOYMENT_GUIDE.md`

