import { Elysia } from 'elysia';
import { autoload } from 'elysia-autoload';
import { API_PORT } from '../env';
import { createLogger } from '../logging';
import type { CertConfig } from '../cert/certManager';

const logger = createLogger('APIService');

export async function startServer(certConfig?: CertConfig | null) {
  const app = new Elysia()
    .onRequest(({ request, set }) => {
      const origin = request.headers.get('origin') || '*';

      set.headers['Access-Control-Allow-Origin'] = origin;
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      set.headers['Access-Control-Allow-Credentials'] = 'true';
      set.headers['Vary'] = 'Origin';
    })
    .options('*', ({ set }) => {
      set.status = 204;
      return new Response(null, { status: 204 });
    })
    .use(
      await autoload({
        dir: './api/routes',
      })
    )
    .listen({
      port: API_PORT,
      ...(certConfig
        ? {
            tls: {
              cert: Bun.file(certConfig.certPath),
              key: Bun.file(certConfig.keyPath),
            },
          }
        : {}),
    });

  logger.info(`API service is running on port ${API_PORT} (${certConfig ? 'HTTPS' : 'HTTP'}).`);

  return app;
}