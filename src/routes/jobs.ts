import { FastifyInstance } from 'fastify';
import { JobRepo } from '../db';
import { requireAdmin } from '../middleware/adminAuth';

export default async function jobsRoutes(app: FastifyInstance) {
  app.get('/admin/jobs', { preHandler: requireAdmin }, async (req, reply) => {
    const limit = Number((req.query as any)?.limit ?? 100);
    const jobs = await JobRepo.list(Math.min(Math.max(limit, 1), 500));
    reply.send({ jobs });
  });
}

