import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { ConnectionRepo, InstallationRepo, JobRepo, JobItemRepo } from '../db';
import { requireAdmin } from '../middleware/adminAuth';

export default async function connectionsRoutes(app: FastifyInstance) {
  // Link or ensure an installation for the source store (for now, use SHOPIFY_SHOP_DOMAIN from env)
  app.post('/admin/installations/upsert', { preHandler: requireAdmin }, async (_req, reply) => {
    const domain = process.env.SHOPIFY_SHOP_DOMAIN;
    if (!domain) return reply.code(400).send({ code: 'bad_request', message: 'SHOPIFY_SHOP_DOMAIN not set' });
    const id = await InstallationRepo.upsert(domain, process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || null, null);
    reply.send({ id, shop_domain: domain });
  });

  app.get('/admin/connections', { preHandler: requireAdmin }, async (_req, reply) => {
    const domain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const ins = await InstallationRepo.getByDomain(domain);
    if (!ins) return reply.code(404).send({ code: 'not_found', message: 'Installation not found' });
    const list = await ConnectionRepo.list(ins.id);
    reply.send({ connections: list });
  });

  app.post('/admin/connections/shopify', { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as any;
    const name = (body?.name || '').trim();
    const dest_shop_domain = (body?.dest_shop_domain || '').trim();
    const access_token = (body?.access_token || '').trim(); // temporary manual token path
    const dest_location_id = (body?.dest_location_id || '').trim();
    if (!name || !dest_shop_domain || !access_token) {
      return reply.code(400).send({ code: 'bad_request', message: 'name, dest_shop_domain, access_token required' });
    }
    const domain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const ins = await InstallationRepo.getByDomain(domain);
    if (!ins) return reply.code(404).send({ code: 'not_found', message: 'Installation not found' });
    await ConnectionRepo.insert({
      id: ulid(),
      installation_id: ins.id,
      type: 'shopify',
      name,
      status: 'active',
      dest_shop_domain,
      dest_location_id: dest_location_id || null,
      base_url: null,
      consumer_key: null,
      consumer_secret: null,
      access_token,
      rules_json: null,
      sync_price: 0,
      sync_categories: 0,
      create_products: 1
    });
    reply.send({ ok: true });
  });

  app.post('/admin/connections/woocommerce', { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as any;
    const name = (body?.name || '').trim();
    const base_url = (body?.base_url || '').trim();
    const consumer_key = (body?.consumer_key || '').trim();
    const consumer_secret = (body?.consumer_secret || '').trim();
    if (!name || !base_url || !consumer_key || !consumer_secret) {
      return reply.code(400).send({ code: 'bad_request', message: 'name, base_url, consumer_key, consumer_secret required' });
    }
    const domain = process.env.SHOPIFY_SHOP_DOMAIN!;
    const ins = await InstallationRepo.getByDomain(domain);
    if (!ins) return reply.code(404).send({ code: 'not_found', message: 'Installation not found' });
    await ConnectionRepo.insert({
      id: ulid(),
      installation_id: ins.id,
      type: 'woocommerce',
      name,
      status: 'active',
      dest_shop_domain: null,
      dest_location_id: null,
      base_url,
      consumer_key,
      consumer_secret,
      access_token: null,
      rules_json: null,
      sync_price: 0,
      sync_categories: 0,
      create_products: 1
    });
    reply.send({ ok: true });
  });

  // Trigger full sync job for a connection
  app.post('/admin/connections/:id/full-sync', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const conn = await ConnectionRepo.get(id);
    if (!conn) return reply.code(404).send({ code: 'not_found', message: 'Connection not found' });
    await JobRepo.enqueue({ id: ulid(), connection_id: id, job_type: 'full_sync' });
    reply.send({ ok: true, enqueued: true });
  });

  // Update connection rules (e.g., price_multiplier)
  app.post('/admin/connections/:id/rules', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const conn = await ConnectionRepo.get(id);
    if (!conn) return reply.code(404).send({ code: 'not_found', message: 'Connection not found' });
    const rules = (req.body as any) ?? {};
    app.log.info({ id, rules }, 'Updating connection rules');
    await ConnectionRepo.updateRules(id, JSON.stringify(rules));
    reply.send({ ok: true });
  });

  // Pause a connection
  app.post('/admin/connections/:id/pause', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const conn = await ConnectionRepo.get(id);
    if (!conn) return reply.code(404).send({ code: 'not_found', message: 'Connection not found' });
    await ConnectionRepo.updateStatus(id, 'paused');
    reply.send({ ok: true, status: 'paused' });
  });

  // Resume a connection
  app.post('/admin/connections/:id/resume', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const conn = await ConnectionRepo.get(id);
    if (!conn) return reply.code(404).send({ code: 'not_found', message: 'Connection not found' });
    await ConnectionRepo.updateStatus(id, 'active');
    reply.send({ ok: true, status: 'active' });
  });

  // Enqueue delta job with provided SKUs
  app.post('/admin/connections/:id/delta', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const conn = await ConnectionRepo.get(id);
    if (!conn) return reply.code(404).send({ code: 'not_found', message: 'Connection not found' });
    const body = req.body as any;
    const skus: string[] = Array.isArray(body?.skus) ? body.skus.map((s: any) => String(s).trim()).filter(Boolean) : [];
    if (skus.length === 0) return reply.code(400).send({ code: 'bad_request', message: 'skus[] required' });
    const jobId = ulid();
    await JobRepo.enqueue({ id: jobId, connection_id: id, job_type: 'delta' });
    await JobItemRepo.addMany(jobId, skus, 'update');
    reply.send({ ok: true, enqueued: true, job_id: jobId, count: skus.length });
  });
}

