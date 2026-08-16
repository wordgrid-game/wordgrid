import type { Elysia } from 'elysia';
import { z } from 'zod';
import { AuthHelper } from '../../../auth/auth';

const register = (app: Elysia) =>
  app.post(
    '/',
    async ({ body, set }) => {
      try {
        const user = await AuthHelper.register(body.username, body.password);
        const token = AuthHelper.generateToken({
          uuid: user.uuid,
          username: user.username,
          role: user.role,
        });
        return {
          success: true,
          token,
          user,
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          error: err.message || 'Registration failed',
        };
      }
    },
    {
      body: z.object({
        username: z.string().min(3).max(20),
        password: z.string().min(6),
      }),
    }
  );

export default register;
