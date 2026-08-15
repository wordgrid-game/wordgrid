import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { autoload } from 'elysia-autoload';
import { API_PORT } from '../env';
import { createLogger } from '../logging';
import type { CertConfig } from '../cert/certManager';

const logger = createLogger('APIService');

export async function startServer(certConfig?: CertConfig | null) {
  const app = new Elysia()
    .use(
      cors({
        origin: request => {
          const origin = request.headers.get('origin');
          return origin === 'https://wordgrid.proplayer919.dev';
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      })
    )
    .use(
      await autoload({
        dir: './api/routes',
      })
    )
    .listen({
      port: API_PORT,
      hostname: '0.0.0.0',
      ...(certConfig
        ? {
            tls: {
              cert: Bun.file(certConfig.certPath),
              key: Bun.file(certConfig.keyPath),
              ALPNProtocols: ['http/1.1'] as any,
            },
          }
        : {}),
    });

  logger.info(`API service is running on port ${API_PORT} (${certConfig ? 'HTTPS' : 'HTTP'}).`);

  return app;
}
