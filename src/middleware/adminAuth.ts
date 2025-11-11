import { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['x-admin-token'] as string | undefined;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return reply.code(401).send({ code: 'unauthorized', message: 'Invalid admin token' });
  }
}

