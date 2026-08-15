import type { Elysia } from 'elysia';
import { register } from '../../../db/telemetry';

const metrics = (app: Elysia) =>
  app.get('/', async ({ headers, set }) => {
    const metrics = await register.metrics();

    set.headers['Content-Type'] = register.contentType;
    return metrics;
  });

export default metrics;
