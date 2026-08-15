import type { Elysia } from 'elysia';
import { z } from 'zod';
import { AuthHelper } from '../../../auth/auth';
import { usersCollection } from '../../../db/mongoCollections';

const login = (app: Elysia) =>
  app.post(
    '/',
    async ({ body, set }) => {
      try {
        const { token, uuid } = await AuthHelper.login(body.username, body.password);
        const userDoc = await usersCollection.findOne({ uuid });
        if (!userDoc) {
          set.status = 401;
          return { success: false, error: 'User not found' };
        }
        return {
          success: true,
          token,
          user: {
            uuid: userDoc.uuid,
            username: userDoc.username,
            role: userDoc.role,
            elo: userDoc.elo,
            eloDeviation: userDoc.eloDeviation,
            volatility: userDoc.volatility,
            wins: userDoc.wins,
            losses: userDoc.losses,
            draws: userDoc.draws,
          },
        };
      } catch (err: any) {
        set.status = 401;
        return {
          success: false,
          error: err.message || 'Invalid username or password',
        };
      }
    },
    {
      body: z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    }
  );

export default login;
