import { buildServer } from './server';
import { config } from './config';

async function main() {
  console.log('[Startup] Initializing server...');
  console.log('[Startup] PORT:', config.port);
  console.log('[Startup] NODE_ENV:', process.env.NODE_ENV);
  console.log('[Startup] DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  const app = buildServer();
  
  try {
    console.log('[Startup] Starting server on port', config.port);
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`[Startup] Server listening on ${config.port}`);
    app.log.info(`Server listening on ${config.port}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[Startup] Failed to start server:', errorMessage);
    console.error('[Startup] Error details:', err);
    app.log.error({ err }, 'Failed to start server: ' + errorMessage);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Startup] Unhandled error:', err);
  process.exit(1);
});