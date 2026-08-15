import { Elysia } from 'elysia';
import { autoload } from 'elysia-autoload';
import { API_PORT } from '../env';
import { createLogger } from '../logging';

const logger = createLogger('APIService');

export async function startServer() {
  const app = new Elysia()
    .onRequest(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    })
    .options('*', ({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      return '';
    })
    .use(
      await autoload({
        dir: './api/routes',
      })
    )
    .listen(API_PORT);

  logger.info(`API service is running on port ${API_PORT}`);

  return app;
}
