import { buildServer } from './server';
import { config } from './config';

async function main() {
  try {
    console.log('[Startup] Initializing server...');
    console.log('[Startup] PORT:', config.port);
    console.log('[Startup] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Startup] DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    console.log('[Startup] Building server...');
    const app = buildServer();
    console.log('[Startup] Server built successfully');
    
    console.log('[Startup] Starting server on port', config.port);
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`[Startup] ✓ Server listening on ${config.port}`);
    app.log.info(`Server listening on ${config.port}`);
    
    // Log that health endpoint should be available
    console.log('[Startup] Health endpoint available at: /health');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error('[Startup] ✗ Failed to start server:', errorMessage);
    if (errorStack) {
      console.error('[Startup] Stack trace:', errorStack);
    }
    console.error('[Startup] Error object:', err);
    if (err && typeof err === 'object') {
      console.error('[Startup] Error keys:', Object.keys(err));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Startup] ✗ Unhandled error in main():', err);
  if (err instanceof Error) {
    console.error('[Startup] Error message:', err.message);
    console.error('[Startup] Error stack:', err.stack);
  }
  process.exit(1);
});