import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { ResellerRepo } from '../db';
import { requireAdmin } from '../middleware/adminAuth';
import { generateApiKey, hashApiKey } from '../security/keys';

export default async function adminRoutes(app: FastifyInstance) {
  app.post('/admin/sync', { preHandler: requireAdmin }, async (_req, reply) => {
    reply.send({ ok: true, triggered: true });
  });

  app.get('/v1/feed/meta', async (_req, reply) => {
    reply.send({
      version: '1.0',
      last_generated_at: new Date().toISOString(),
      counts: { items: -1 }
    });
  });

  app.get('/admin/resellers', { preHandler: requireAdmin }, async (_req, reply) => {
    const list = ResellerRepo.list().map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      version: r.version,
      last4: r.last4,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    reply.send({ resellers: list });
  });

  app.post('/admin/resellers', { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as any;
    const name = (body?.name || '').trim();
    const version = (body?.version || 'v1').trim();
    if (!name) return reply.code(400).send({ code: 'bad_request', message: 'name required' });

    const apiKey = generateApiKey(40);
    const { salt, hash, last4 } = hashApiKey(apiKey);

    const id = ulid();
    ResellerRepo.insert({
      id,
      name,
      status: 'active',
      api_key_hash: hash,
      api_key_salt: salt,
      last4,
      version
    } as any);

    reply.send({ id, name, version, api_key: apiKey, last4 });
  });

  app.post('/admin/resellers/:id/rotate-key', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any;
    const apiKey = generateApiKey(40);
    const { salt, hash, last4 } = hashApiKey(apiKey);
    ResellerRepo.updateKey(id, salt, hash, last4);
    reply.send({ id, api_key: apiKey, last4 });
  });
}

