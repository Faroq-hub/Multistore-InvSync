import { FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';
import { refreshFeedNow } from '../services/feedCache';
import { ConnectionRepo, InstallationRepo, JobRepo, JobItemRepo } from '../db';
import { ulid } from 'ulid';

function verifyShopifyHmac(secret: string, body: string, headerHmac: string | undefined): boolean {
  if (!secret || !headerHmac) return false;
  const digest = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  return digest === headerHmac;
}

export default async function webhookRoutes(app: FastifyInstance) {
  // Use a parser that keeps raw body string for HMAC verification
  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
      const bodyStr = typeof body === 'string' ? body : body.toString('utf8');
      (req as any)._rawBody = bodyStr;
      const json = bodyStr ? JSON.parse(bodyStr) : {};
      done(null, json);
    } catch (err) {
      done(err as Error, undefined as any);
    }
  });

  // Shopify webhook endpoint
  app.post('/webhooks/shopify', async (req, reply) => {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
    const headerHmac = req.headers['x-shopify-hmac-sha256'] as string | undefined;

    const bodyString = (req as any)._rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    if (secret && !verifyShopifyHmac(secret, bodyString, headerHmac)) {
      return reply.code(401).send({ ok: false });
    }

    // Extract SKUs from product payload if available
    let skus: string[] = [];
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (payload && payload.variants && Array.isArray(payload.variants)) {
        skus = payload.variants.map((v: any) => (v.sku || '').trim()).filter((s: string) => s);
      }
    } catch {}

    // Refresh cache in background to keep feed up to date
    refreshFeedNow().catch(err => app.log.error({ err }, 'Shopify webhook refresh failed'));

    // Enqueue delta jobs for all active connections (if SKUs present), else full sync
    try {
      const domain = process.env.SHOPIFY_SHOP_DOMAIN!;
      const ins = InstallationRepo.getByDomain(domain);
      if (ins) {
        const conns = ConnectionRepo.list(ins.id).filter(c => c.status === 'active');
        for (const c of conns) {
          const jobId = ulid();
          if (skus.length > 0) {
            JobRepo.enqueue({ id: jobId, connection_id: c.id, job_type: 'delta' });
            JobItemRepo.addMany(jobId, skus, 'update');
          } else {
            JobRepo.enqueue({ id: jobId, connection_id: c.id, job_type: 'full_sync' });
          }
        }
      }
    } catch (err) {
      app.log.error({ err }, 'Failed to enqueue push jobs from Shopify webhook');
    }

    reply.send({ ok: true });
  });

  // WooCommerce webhook endpoint
  app.post('/webhooks/woocommerce', async (_req, reply) => {
    // TODO: Add Woo signature verification with WOO_WEBHOOK_SECRET if needed
    refreshFeedNow().catch(err => app.log.error({ err }, 'Woo webhook refresh failed'));
    try {
      const domain = process.env.SHOPIFY_SHOP_DOMAIN!;
      const ins = InstallationRepo.getByDomain(domain);
      if (ins) {
        const conns = ConnectionRepo.list(ins.id).filter(c => c.status === 'active');
        for (const c of conns) {
          const jobId = ulid();
          JobRepo.enqueue({ id: jobId, connection_id: c.id, job_type: 'full_sync' });
        }
      }
    } catch (err) {
      app.log.error({ err }, 'Failed to enqueue push jobs from Woo webhook');
    }
    reply.send({ ok: true });
  });
}

