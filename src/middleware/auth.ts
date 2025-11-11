import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { ResellerRepo } from '../db';
import { verifyApiKey } from '../security/keys';

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const headerKey = request.headers['x-api-key'] as string | undefined;
  const queryKey = (request.query as any)?.key as string | undefined;
  const providedKey = headerKey || queryKey || config.defaultTestApiKey || '';

  if (!providedKey) {
    return reply.code(401).send({ code: 'missing_api_key', message: 'Provide X-API-Key header or ?key=' });
  }

  const last4 = providedKey.slice(-4);
  const candidates = ResellerRepo.findActiveByLast4(last4);

  // Allow default test key fallback if configured but not in DB
  if (!candidates.length && config.defaultTestApiKey && providedKey === config.defaultTestApiKey) {
    (request as any).reseller = { name: 'Test Reseller', version: 'v1' };
    return;
  }

  for (const r of candidates) {
    if (r.api_key_salt && r.api_key_hash && verifyApiKey(providedKey, r.api_key_salt, r.api_key_hash)) {
      (request as any).reseller = { name: r.name, version: r.version, id: r.id };
      return;
    }
  }

  return reply.code(403).send({ code: 'invalid_api_key', message: 'Invalid API key' });
}
