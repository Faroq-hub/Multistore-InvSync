# Deployment Guide

This guide walks through promoting the multi-store inventory sync app from local development to a production-ready environment. The recommended architecture deploys the Fastify API and job worker separately from the Next.js embedded UI so each surface can scale independently.

---

## 1. Requirements

### Services
- **API / Workers** – Node.js 18+, runs `npm run build && npm start` (Fastify + background workers)
- **Next.js Embedded UI** – Node.js 18+, runs `npm run build:next && npm run start:next`
- **Database** – SQLite for quick experiments, PostgreSQL recommended for production

### Secrets & Environment Variables

| Variable | Description | Applies To |
| --- | --- | --- |
| `PORT` | Listening port for API (default `3000`) | API |
| `LOG_LEVEL` | Pino log level (`info`, `debug`, etc.) | API |
| `ADMIN_TOKEN` | Shared secret for admin routes | API |
| `ENCRYPTION_KEY` | 32-byte AES key (base64 or hex) for token encryption | API |
| `SHOPIFY_API_KEY` | Public app API key | API + Next |
| `SHOPIFY_API_SECRET` | Public app secret | API |
| `SHOPIFY_SCOPES` | Comma-separated scopes (`read_products,...`) | API |
| `SHOPIFY_WEBHOOK_SECRET` | Value used to verify HMAC signatures | API |
| `SHOPIFY_WEBHOOK_BASE_URL` | Public HTTPS base pointing to Fastify server (no trailing slash) | API |
| `APP_URL` | Public HTTPS app URL (used during OAuth) | Next |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Mirrors `SHOPIFY_API_KEY` for the client bundle | Next |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | (Optional) Support email shown in the UI | Next |

> **Tip:** Keep environment values consistent across environments by using `.env.production` locally and syncing secrets via your hosting provider’s secret management.

---

## 2. Prepare the Database

SQLite is fine while validating functionality, but use PostgreSQL (or another managed SQL service) in production.

1. Provision a managed PostgreSQL instance.
2. Create a database and user with least-privilege access.
3. Update `src/db.ts` to use `pg` or a preferred client (consider [better-sqlite3-multiple-callbacks](https://github.com/WiseLibs/better-sqlite3) alternatives or a dedicated ORM such as Prisma/Drizzle for portability).
4. Run migrations (a simple SQL script mirroring the existing schema works as a first pass).

---

## 3. Deploy the Next.js Embedded App (Vercel Example)

1. **Create the project**
   ```bash
   vercel link  # if not already linked
   vercel env add NEXT_PUBLIC_SHOPIFY_API_KEY
   vercel env add NEXT_PUBLIC_SUPPORT_EMAIL
   vercel env add APP_URL
   ```
   Set `APP_URL` to the public Vercel URL (e.g. `https://your-app.vercel.app`).

2. **Build Command**
   - Build: `npm run build:next`
   - Start: `npm run start:next`
   - Output: `standalone` (Vercel handles automatically)

3. **Deploy**
   ```bash
   vercel deploy --prod
   ```

4. **Update Shopify Partner Dashboard**
   - **App URL**: `https://your-app.vercel.app`
   - **Allowed redirect URLs**:
     - `https://your-app.vercel.app/api/auth/callback`
     - `https://your-app.vercel.app/api/auth/callback?shop={shop}`

---

## 4. Deploy the API & Worker (Fly.io Example)

1. **Create Dockerfile (if not already present)**
   ```dockerfile
   FROM node:18-alpine AS deps
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production

   FROM node:18-alpine
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Initialize Fly.io app**
   ```bash
   flyctl launch --name multi-store-sync-api --no-deploy
   ```

3. **Configure Secrets**
   ```bash
  flyctl secrets set \
     PORT=3000 \
     LOG_LEVEL=info \
     ADMIN_TOKEN=... \
     ENCRYPTION_KEY=... \
     SHOPIFY_API_KEY=... \
     SHOPIFY_API_SECRET=... \
     SHOPIFY_SCOPES="read_products,read_inventory,read_locations" \
     SHOPIFY_WEBHOOK_SECRET=... \
     SHOPIFY_WEBHOOK_BASE_URL=https://api.your-domain.com \
     APP_URL=https://your-app.vercel.app
   ```

4. **Deploy**
   ```bash
   flyctl deploy
   ```

5. **Post-deploy checks**
   - `flyctl logs` to confirm startup.
   - `curl https://api.your-domain.com/health` should respond `{ "ok": true }`.

6. **Update Shopify Partner Dashboard**
   - Set webhook subscriptions (auto-registered during OAuth) to target `https://api.your-domain.com/webhooks/shopify`.

---

## 5. Job Worker Considerations

The Fastify server launches the feed scheduler and push worker on startup. Ensure at least one instance of the API service runs continuously. If you prefer to separate workers:

1. Create a dedicated entry point that only imports `startScheduler` and `startPushWorker`.
2. Run that process as a sidecar/deployment with the same environment variables and database access.

---

## 6. Cutover Checklist

- [ ] Environment variables set on both API and Next.js hosts
- [ ] Shopify Partner app updated with production URLs
- [ ] Webhook base URL publicly accessible (`https://api.your-domain.com`)
- [ ] Database migrated & seeded (if needed)
- [ ] `APP_URL` points to embedded UI (Vercel)
- [ ] `SHOPIFY_WEBHOOK_BASE_URL` points to Fastify API
- [ ] Support email (`NEXT_PUBLIC_SUPPORT_EMAIL`) configured
- [ ] Monitor logs for `app/uninstalled` and privacy webhooks handling

---

## 7. Observability & Maintenance

- **Logging**: Pino logs stream to stdout. Pipe to your provider’s log aggregation (Fly.io logs, Vercel function logs).
- **Metrics**: Wrap job enqueue/complete in a metrics library (e.g. Prometheus client) if needed.
- **Backups**: Schedule periodic database dumps; for SQLite, snapshot the file; for PostgreSQL use `pg_dump`.
- **Upgrades**: Rotate `ENCRYPTION_KEY` by re-encrypting stored tokens (write migration) and rotating secrets per environment.

---

## 8. Support & Incident Response

- Set `NEXT_PUBLIC_SUPPORT_EMAIL` with your support alias so merchants can reach out from the embedded UI.
- For critical incidents (e.g. feed sync failing), pause problematic connections and review `audit_logs` in the database.

This deployment plan gives you a repeatable pipeline for shipping the public Shopify app to production while keeping the API, UI, and background jobs maintainable. Update the documentation as you harden the infrastructure (CI/CD, database migrations, observability). 

