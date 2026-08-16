import { Elysia } from 'elysia';
import { z } from 'zod';
import { Matchmaker, MATCH_CHANNEL } from '../../../match/matchmaker';
import { AuthHelper } from '../../../auth/auth';
import { usersCollection } from '../../../db/mongoCollections';
import { createLogger } from '../../../logging';
import redis from '../../../db/redis';
import {
  activeQueuedPlayers,
  matchesProposed,
  matchesCompleted,
  matchesTimedOut,
  matchesRejected,
} from '../../../db/telemetry';

interface UserContext {
  id: string;
  elo: number;
  joinedAt: number;
}

interface MatchmakingWSData {
  id?: string;
  elo?: number;
  joinedAt?: number;
  currentMatchId?: string;
  store: {
    userContext?: UserContext;
  };
}

const logger = createLogger('MatchmakingService');
const matchmaker = new Matchmaker();

let tickMatchesProposed = 0;
let tickMatchesCompleted = 0;
let tickMatchesTimedOut = 0;
let tickMatchesRejected = 0;

const activeConnections = new Map<string, any>();

const IncomingMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CANCEL'),
  }),
  z.object({
    type: z.literal('ACCEPT_MATCH'),
    matchId: z.string(),
  }),
]);

const OutgoingMessageSchema = z.object({
  type: z.enum([
    'QUEUED',
    'CANCELLED',
    'MATCH_PROPOSED',
    'MATCH_ACCEPTED',
    'MATCH_SUCCESS',
    'MATCH_FAILED',
  ]),
  message: z.string().optional(),
  opponent: z.string().optional(),
  room: z.string().optional(),
  matchId: z.string().optional(),
});

type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;

const PubSubMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MATCH_PROPOSED'),
    match: z.object({
      playerA: z.string(),
      playerB: z.string(),
      room: z.string(),
    }),
  }),
  z.object({
    type: z.literal('MATCH_READY'),
    playerA: z.string(),
    playerB: z.string(),
    room: z.string(),
  }),
  z.object({
    type: z.literal('MATCH_ABORTED'),
    playerA: z.string(),
    playerB: z.string(),
    acceptA: z.boolean(),
    acceptB: z.boolean(),
    rejectedBy: z.string().optional(),
  }),
]);

function stringifyMessage(message: OutgoingMessage): string {
  const result = OutgoingMessageSchema.safeParse(message);
  if (!result.success) {
    logger.error(`Failed to validate outgoing message: ${result.error.message}`);
    throw new Error('Outbound message validation failed');
  }
  return JSON.stringify(result.data);
}

export async function setupRedisPubSubSubscriber() {
  const subRedis = redis.duplicate();
  await subRedis.connect();
  await subRedis.subscribe(MATCH_CHANNEL);

  subRedis.on('message', async (_, message) => {
    try {
      const rawPayload = JSON.parse(message);
      const result = PubSubMessageSchema.safeParse(rawPayload);

      if (!result.success) {
        logger.warn(`Invalid Pub/Sub message schema: ${result.error.message}`);
        return;
      }

      const payload = result.data;

      if (payload.type === 'MATCH_PROPOSED') {
        const match = payload.match;
        const matchId = `match:${match.playerA}:${match.playerB}`;

        const hasPlayerA = activeConnections.has(match.playerA);
        const hasPlayerB = activeConnections.has(match.playerB);

        if (hasPlayerA) {
          const wsA = activeConnections.get(match.playerA);
          if (wsA) wsA.data.currentMatchId = matchId;

          await redis.hset(matchId, {
            playerA: match.playerA,
            playerB: match.playerB,
            room: match.room,
            acceptA: 'false',
            acceptB: 'false',
          });
          await redis.expire(matchId, 15);

          setTimeout(() => handleMatchTimeout(matchId), 10000);
        }

        if (hasPlayerB) {
          const wsB = activeConnections.get(match.playerB);
          if (wsB) wsB.data.currentMatchId = matchId;
        }

        tickMatchesProposed++;

        handleMatchProposal(match.playerA, match.playerB, matchId);
        handleMatchProposal(match.playerB, match.playerA, matchId);
      } else if (payload.type === 'MATCH_READY') {
        const { playerA, playerB, room } = payload;

        const wsA = activeConnections.get(playerA);
        if (wsA) delete wsA.data.currentMatchId;

        const wsB = activeConnections.get(playerB);
        if (wsB) delete wsB.data.currentMatchId;

        tickMatchesCompleted++;

        finalizeMatch(playerA, playerB, room);
      } else if (payload.type === 'MATCH_ABORTED') {
        const { playerA, playerB, acceptA, acceptB, rejectedBy } = payload;

        if (!rejectedBy) {
          tickMatchesTimedOut++;
        }

        const wsA = activeConnections.get(playerA);
        if (wsA) delete wsA.data.currentMatchId;

        const wsB = activeConnections.get(playerB);
        if (wsB) delete wsB.data.currentMatchId;

        if (!acceptA && !acceptB) {
          handleMatchBothPlayersAborted(playerA, playerB);
        } else if (acceptA && !acceptB) {
          handleMatchOnePlayerAborted(playerB, playerA);
        } else if (!acceptA && acceptB) {
          handleMatchOnePlayerAborted(playerA, playerB);
        }
      }
    } catch (err: any) {
      logger.error(`Error processing Pub/Sub match event: ${err.message}`);
    }
  });
}

function handleMatchProposal(targetPlayerId: string, opponentId: string, matchId: string) {
  const ws = activeConnections.get(targetPlayerId);
  if (!ws) return;

  ws.send(
    stringifyMessage({
      type: 'MATCH_PROPOSED',
      opponent: opponentId,
      matchId,
    })
  );
}

async function processMatchAcceptance(playerId: string, matchId: string) {
  const matchData = await redis.hgetall(matchId);
  if (!matchData || Object.keys(matchData).length === 0) return;

  const isPlayerA = matchData.playerA === playerId;
  const isPlayerB = matchData.playerB === playerId;

  if (!isPlayerA && !isPlayerB) return;

  const fieldToSet = isPlayerA ? 'acceptA' : 'acceptB';
  await redis.hset(matchId, fieldToSet, 'true');

  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(stringifyMessage({ type: 'MATCH_ACCEPTED', message: 'Acceptance received.' }));
  }

  const updatedData = await redis.hgetall(matchId);
  if (updatedData.acceptA === 'true' && updatedData.acceptB === 'true') {
    const deleted = await redis.del(matchId);
    if (deleted === 0) return;

    await redis.publish(
      MATCH_CHANNEL,
      JSON.stringify({
        type: 'MATCH_READY',
        playerA: updatedData.playerA,
        playerB: updatedData.playerB,
        room: updatedData.room,
      })
    );
  }
}

async function handleMatchTimeout(matchId: string) {
  const matchData = await redis.hgetall(matchId);

  if (!matchData?.playerA || !matchData.playerB) return;

  const acceptA = matchData.acceptA === 'true';
  const acceptB = matchData.acceptB === 'true';

  if (acceptA && acceptB) return;

  const deleted = await redis.del(matchId);
  if (deleted === 0) return;

  await redis.publish(
    MATCH_CHANNEL,
    JSON.stringify({
      type: 'MATCH_ABORTED',
      playerA: matchData.playerA,
      playerB: matchData.playerB,
      acceptA,
      acceptB,
    })
  );
}

async function handleActiveMatchRejection(playerId: string, matchId: string) {
  const matchData = await redis.hgetall(matchId);
  if (!matchData || Object.keys(matchData).length === 0) return;

  const deleted = await redis.del(matchId);
  if (deleted === 0) return;

  const isPlayerA = matchData.playerA === playerId;

  tickMatchesRejected++;

  await redis.publish(
    MATCH_CHANNEL,
    JSON.stringify({
      type: 'MATCH_ABORTED',
      playerA: matchData.playerA,
      playerB: matchData.playerB,
      acceptA: isPlayerA ? false : matchData.acceptA === 'true',
      acceptB: !isPlayerA ? false : matchData.acceptB === 'true',
      rejectedBy: playerId,
    })
  );
}

async function abortPlayer(playerId: string) {
  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(stringifyMessage({ type: 'MATCH_FAILED', message: 'Match failed or timed out.' }));
    ws.close();
  } else {
    await matchmaker.leaveQueue(playerId);
  }
}

async function requeuePlayer(playerId: string) {
  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(
      stringifyMessage({
        type: 'QUEUED',
        message: 'Opponent failed to accept. Returning to queue.',
      })
    );
    await matchmaker.joinQueue(playerId, ws.data.elo);
  }
}

async function handleMatchBothPlayersAborted(playerA: string, playerB: string) {
  await abortPlayer(playerA);
  await abortPlayer(playerB);
}

async function handleMatchOnePlayerAborted(playerId: string, opponentId: string) {
  await abortPlayer(playerId);
  await requeuePlayer(opponentId);
}

function finalizeMatch(playerA: string, playerB: string, room: string) {
  const notify = (targetId: string, opponentId: string) => {
    const ws = activeConnections.get(targetId);
    if (!ws) return;

    ws.send(
      stringifyMessage({
        type: 'MATCH_SUCCESS',
        opponent: opponentId,
        room,
      })
    );

    setTimeout(() => {
      if (activeConnections.has(targetId)) {
        ws.close();
      }
    }, 5000);
  };

  notify(playerA, playerB);
  notify(playerB, playerA);
}

export async function matchmakingTick() {
  activeQueuedPlayers.set(activeConnections.size);

  matchesProposed.set(tickMatchesProposed);
  matchesCompleted.set(tickMatchesCompleted);
  matchesTimedOut.set(tickMatchesTimedOut);
  matchesRejected.set(tickMatchesRejected);

  tickMatchesProposed = 0;
  tickMatchesCompleted = 0;
  tickMatchesTimedOut = 0;
  tickMatchesRejected = 0;

  if (activeConnections.size >= 2) {
    const BASE_TOLERANCE = 50;
    const MAX_TOLERANCE = 500;
    const TOLERANCE_GROWTH_PER_SECOND = 15;

    for (const [playerId, ws] of activeConnections.entries()) {
      if (!activeConnections.has(playerId)) continue;

      const { elo, joinedAt } = ws.data;
      const secondsWaiting = (Date.now() - joinedAt) / 1000;
      const dynamicTolerance = Math.min(
        BASE_TOLERANCE + secondsWaiting * TOLERANCE_GROWTH_PER_SECOND,
        MAX_TOLERANCE
      );

      try {
        const inQueue = await redis.zscore('matchmaking:queue', playerId);
        if (!inQueue) continue;

        const match = await matchmaker.findMatch(playerId, elo, dynamicTolerance);
        if (match) {
          logger.debug(`Proposed match: ${match.playerA} vs ${match.playerB}`);
          break;
        }
      } catch (err: any) {
        logger.error(`Error in match evaluation loop: ${err.message}`);
      }
    }
  }

  setTimeout(matchmakingTick, 1000);
}

export const matchmakingRoutes = new Elysia().ws('/', {
  idleTimeout: 10,

  async beforeHandle({ headers, query, set, store }) {
    const authHeader = headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (query.token as string);

    if (!token) {
      set.status = 401;
      return { success: false, error: 'No token provided' };
    }

    try {
      const payload = AuthHelper.verifyToken(token);
      const userDoc = await usersCollection.findOne({ uuid: payload.uuid });

      if (!userDoc) {
        set.status = 404;
        return { success: false, error: 'User not found' };
      }

      (store as Record<string, any>).userContext = {
        id: userDoc.uuid,
        elo: userDoc.elo,
        joinedAt: Date.now(),
      };
    } catch (err: any) {
      logger.warn(`Authentication failed: ${err.message}`);
      set.status = 401;
      return { success: false, error: 'Invalid or expired token' };
    }
  },

  async open(ws) {
    const wsData = ws.data as MatchmakingWSData;
    const userContext = wsData.store?.userContext;

    if (!userContext) {
      ws.close();
      return;
    }

    const { id, elo, joinedAt } = userContext;
    wsData.id = id;
    wsData.elo = elo;
    wsData.joinedAt = joinedAt;

    logger.debug(`Player [${id}] entered queue with Elo [${elo}].`);

    try {
      activeConnections.set(id, ws);

      const integerElo = Math.round(elo);
      await matchmaker.joinQueue(id, integerElo);

      activeQueuedPlayers.set(activeConnections.size);
      ws.send(stringifyMessage({ type: 'QUEUED', message: 'Successfully queued.' }));
    } catch (err: any) {
      logger.error(`Failed to add player [${id}] to Redis queue: ${err.message}`);
      ws.send(stringifyMessage({ type: 'MATCH_FAILED', message: 'Queue initialization failed.' }));
      ws.close();
    }
  },

  async message(ws, message) {
    const wsData = ws.data as MatchmakingWSData;
    try {
      const rawData = JSON.parse(String(message));
      const result = IncomingMessageSchema.safeParse(rawData);

      if (!result.success) {
        logger.warn(
          `Invalid WS payload received from player [${wsData.id}]: ${JSON.stringify(result.error.issues)}`
        );
        return;
      }

      const data = result.data;

      if (data.type === 'CANCEL') {
        const { id, currentMatchId } = wsData;
        logger.debug(`Player [${id}] cancelled matchmaking.`);

        if (id && currentMatchId) {
          await handleActiveMatchRejection(id, currentMatchId);
        }

        ws.send(stringifyMessage({ type: 'CANCELLED', message: 'Queue cancelled successfully.' }));
        ws.close();
      } else if (data.type === 'ACCEPT_MATCH') {
        if (wsData.id) {
          await processMatchAcceptance(wsData.id, data.matchId);
        }
      }
    } catch (err: any) {
      logger.error(`Failed to parse WebSocket frame from player [${wsData.id}]: ${err.message}`);
    }
  },

  async close(ws) {
    const wsData = ws.data as MatchmakingWSData;
    const { id, currentMatchId } = wsData;
    if (!id) return;

    logger.debug(`Player [${id}] left queue/disconnected.`);

    try {
      if (currentMatchId) {
        await handleActiveMatchRejection(id, currentMatchId);
      }

      activeConnections.delete(id);
      await matchmaker.leaveQueue(id);
      activeQueuedPlayers.set(activeConnections.size);
    } catch (err: any) {
      logger.error(`Error removing player [${id}] from queue on disconnect: ${err.message}`);
    }
  },
});

export async function cleanupMatchmaking() {
  logger.info('Cleaning up matchmaking queue...');
  const playerIds = Array.from(activeConnections.keys());

  if (playerIds.length > 0) {
    logger.info(`Removing ${playerIds.length} active players from Redis...`);
    const pipeline = redis.pipeline();
    for (const id of playerIds) {
      pipeline.zrem('matchmaking:queue', id);

      const ws = activeConnections.get(id);
      if (ws) {
        ws.send(JSON.stringify({ type: 'CANCELLED', message: 'Server restarting.' }));
        ws.close();
      }
    }
    await pipeline.exec();
  }
}
