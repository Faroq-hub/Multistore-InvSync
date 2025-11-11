import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import etag from '@fastify/etag';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import feedRoutes from './routes/feed';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhooks';
import connectionsRoutes from './routes/connections';
import jobsRoutes from './routes/jobs';
import auditRoutes from './routes/audit';
import { migrate } from './db';
import { startScheduler } from './services/feedCache';
import { startPushWorker } from './services/pushWorker';

export function buildServer() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined
    }
  });

  app.register(cors, { origin: true });
  app.register(sensible);
  app.register(etag);
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  // DB migrations
  migrate();

  app.register(feedRoutes);
  app.register(adminRoutes);
  app.register(webhookRoutes);
  app.register(connectionsRoutes);
  app.register(jobsRoutes);
  app.register(auditRoutes);

  app.addHook('onReady', async () => {
    startScheduler((msg) => app.log.info(msg));
    startPushWorker((msg) => app.log.info(msg));
  });

  return app;
}