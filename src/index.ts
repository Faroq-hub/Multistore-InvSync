import { buildServer } from './server';
import { config } from './config';

async function main() {
  const app = buildServer();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server listening on ${config.port}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    app.log.error({ err }, 'Failed to start server: ' + errorMessage);
    process.exit(1);
  }
}

main();