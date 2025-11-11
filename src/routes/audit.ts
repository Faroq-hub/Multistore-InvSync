import { FastifyInstance } from 'fastify';
import { AuditRepo } from '../db';
import { requireAdmin } from '../middleware/adminAuth';

export default async function auditRoutes(app: FastifyInstance) {
  app.get('/admin/audit', { preHandler: requireAdmin }, async (req, reply) => {
    const limit = Math.min(Math.max(Number((req.query as any)?.limit ?? 200), 1), 1000);
    const logs = AuditRepo.recent(limit);
    reply.send({ logs });
  });
}

