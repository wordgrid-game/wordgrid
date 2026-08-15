import type { Elysia } from 'elysia';
import { AuthHelper } from '../../../auth/auth';
import { usersCollection } from '../../../db/mongoCollections';

const me = (app: Elysia) =>
  app.get('/', async ({ headers, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      set.status = 401;
      return { success: false, error: 'No token provided' };
    }
    const token = authHeader.substring(7);
    try {
      const payload = AuthHelper.verifyToken(token);
      const userDoc = await usersCollection.findOne({ uuid: payload.uuid });
      if (!userDoc) {
        set.status = 404;
        return { success: false, error: 'User not found' };
      }
      return {
        success: true,
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
      return { success: false, error: 'Invalid or expired token' };
    }
  });

export default me;
