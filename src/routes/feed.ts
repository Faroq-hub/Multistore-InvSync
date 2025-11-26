import { FastifyInstance } from 'fastify';
import { requireApiKey } from '../middleware/auth';
import { toXml } from '../services/feedBuilder';
import { getCurrentFeed, queryItems, refreshFeedNow, getDiscontinuedSkus } from '../services/feedCache';

export default async function feedRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    // Health check endpoint - must be available immediately
    // Don't check database here to ensure fast response
    return reply.send({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/v1/feed.json', { preHandler: requireApiKey }, async (req, reply) => {
    const q = req.query as any;
    if (q.refresh === 'true') {
      await refreshFeedNow();
    }
    const snapshot = getCurrentFeed() || (await refreshFeedNow());
    const { items, total, page, limit } = queryItems({
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      category: q.category,
      in_stock: q.in_stock === 'true',
      min_price: q.min_price ? Number(q.min_price) : undefined,
      max_price: q.max_price ? Number(q.max_price) : undefined,
      since: q.since
    });

    const body = {
      version: snapshot.feed.version,
      generated_at: snapshot.feed.generatedAt,
      page,
      limit,
      total,
      items
    };

    reply.header('Cache-Control', 'public, max-age=300');
    reply.header('Last-Modified', new Date(snapshot.feed.generatedAt).toUTCString());
    return body;
  });

  app.get('/v1/feed.xml', { preHandler: requireApiKey }, async (req, reply) => {
    const q = req.query as any;
    if (q.refresh === 'true') {
      await refreshFeedNow();
    }
    const snapshot = getCurrentFeed() || (await refreshFeedNow());
    const { items } = queryItems({
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      category: q.category,
      in_stock: q.in_stock === 'true',
      min_price: q.min_price ? Number(q.min_price) : undefined,
      max_price: q.max_price ? Number(q.max_price) : undefined,
      since: q.since
    });
    const xml = toXml({
      version: snapshot.feed.version,
      generatedAt: snapshot.feed.generatedAt,
      items
    });

    reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .header('Last-Modified', new Date(snapshot.feed.generatedAt).toUTCString())
      .send(xml);
  });

  // Delta feed since timestamp (ISO8601)
  app.get('/v1/feed/since/:timestamp', { preHandler: requireApiKey }, async (req, reply) => {
    const p = req.params as any;
    const q = req.query as any;
    const snapshot = getCurrentFeed() || (await refreshFeedNow());
    const { items, total, page, limit } = queryItems({
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      since: p.timestamp
    });
    reply.header('Cache-Control', 'public, max-age=120');
    reply.header('Last-Modified', new Date(snapshot.feed.generatedAt).toUTCString());
    return {
      version: snapshot.feed.version,
      generated_at: snapshot.feed.generatedAt,
      page,
      limit,
      total,
      items
    };
  });

  // Discontinued SKUs since last refresh
  app.get('/v1/feed/discontinued.json', { preHandler: requireApiKey }, async (_req, reply) => {
    const snapshot = getCurrentFeed() || (await refreshFeedNow());
    const skus = getDiscontinuedSkus();
    reply.header('Cache-Control', 'public, max-age=120');
    reply.header('Last-Modified', new Date(snapshot.feed.generatedAt).toUTCString());
    return { version: snapshot.feed.version, generated_at: snapshot.feed.generatedAt, skus };
  });
}