import client from 'prom-client';
import { heapStats } from 'bun:jsc';
import mongoClient from './mongo';
import { usersCollection } from './mongoCollections';

export const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'server_',
});

export const activeQueuedPlayers = new client.Gauge({
  name: 'matchmaking_active_queued_players',
  help: 'Current number of players actively waiting in the queue',
  registers: [register],
});

export const matchesProposed = new client.Gauge({
  name: 'matchmaking_matches_proposed_total',
  help: 'Total matches proposed to players',
  registers: [register],
});

export const matchesCompleted = new client.Gauge({
  name: 'matchmaking_matches_completed_total',
  help: 'Total successfully accepted matches',
  registers: [register],
});

export const matchesTimedOut = new client.Gauge({
  name: 'matchmaking_matches_timed_out_total',
  help: 'Total matches aborted due to timeout',
  registers: [register],
});

export const matchesRejected = new client.Gauge({
  name: 'matchmaking_matches_rejected_total',
  help: 'Total matches rejected by players',
  registers: [register],
});

const bunJscHeapUsedBytes = new client.Gauge({
  name: 'bun_jsc_heap_size_used_bytes',
  help: 'Total memory used by JavaScriptCore heap objects in bytes.',
  registers: [register],
});

export const bunJscHeapTotalBytes = new client.Gauge({
  name: 'bun_jsc_heap_size_total_bytes',
  help: 'Total allocated heap capacity reserved by JavaScriptCore in bytes.',
  registers: [register],
});

export const dbDataSizeGauge = new client.Gauge({
  name: 'mongodb_db_data_size_bytes',
  help: 'Total size of uncompressed data in bytes',
  registers: [register],
  async collect() {
    try {
      const stats = await mongoClient.db().stats();
      this.set(stats.dataSize);
    } catch (err) {
      console.error('Failed to fetch MongoDB stats:', err);
    }
  },
});

export const totalUsers = new client.Gauge({
  name: 'users_total',
  help: 'Total number of users',
  registers: [register],
  async collect() {
    try {
      const count = await usersCollection.countDocuments();
      this.set(count);
    } catch (err) {
      console.error('Failed to fetch total users count:', err);
    }
  }
});

export const totalActiveUsers = new client.Gauge({
  name: 'users_active_total',
  help: 'Total number of active users (logged in within the last 7 days)',
  registers: [register],
  async collect() {
    try {
      const count = await usersCollection.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
      this.set(count);
    } catch (err) {
      console.error('Failed to fetch total active users count:', err);
    }
  }
});

export const totalAdminUsers = new client.Gauge({
  name: 'users_admin_total',
  help: 'Total number of admin users',
  registers: [register],
  async collect() {
    try {
      const count = await usersCollection.countDocuments({ role: 'admin' });
      this.set(count);
    } catch (err) {
      console.error('Failed to fetch total admin users count:', err);
    }
  }
});

export const totalOwnerUsers = new client.Gauge({
  name: 'users_owner_total',
  help: 'Total number of owner users',
  registers: [register],
  async collect() {
    try {
      const count = await usersCollection.countDocuments({ role: 'owner' });
      this.set(count);
    } catch (err) {
      console.error('Failed to fetch total owner users count:', err);
    }
  }
});

setInterval(() => {
  try {
    const stats = heapStats();
    bunJscHeapUsedBytes.set(stats.heapSize);
    bunJscHeapTotalBytes.set(stats.heapCapacity);
  } catch (err) {
    console.error('Failed to collect Bun JSC heap stats:', err);
  }
}, 5000).unref();
