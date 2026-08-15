import { startServer } from './api/service';
import redis from './db/redis';
import { createLogger } from './logging';
import { startMatchmakingService } from './match/service';
import { ensureValidCertificate } from './cert/certManager';

const logger = createLogger('Server');

logger.info('Server is starting...');

if (redis.status === 'wait') {
  await redis.connect();
}

const certConfig = await ensureValidCertificate().catch((err) => {
  logger.error(`Certificate resolution error: ${err.message}`);
  return null;
});

await startServer(certConfig)
  .then(() => {
    logger.info('API service started successfully.');
  })
  .catch((error) => {
    logger.error(`Failed to start API: ${error.message}`);
    process.exit(1);
  });

await startMatchmakingService(certConfig)
  .then(() => {
    logger.info('Matchmaking service started successfully.');
  })
  .catch((error) => {
    logger.error(`Failed to start matchmaking service: ${error.message}`);
    process.exit(1);
  });
