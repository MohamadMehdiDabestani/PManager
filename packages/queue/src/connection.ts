import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Redis, type RedisOptions } from 'ioredis';

function ensureEnvLoaded(): void {
  if (process.env['REDIS_URL']) return;
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile(envPath);
        break;
      } catch {
        // ignore
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
}

ensureEnvLoaded();

export const QUEUE_PREFIX = process.env['QUEUE_PREFIX'] ?? 'cmms';

export function createRedis(opts?: { failFast?: boolean }): Redis {
  ensureEnvLoaded();
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379/0';

  const redisOpts: RedisOptions = {
    maxRetriesPerRequest: opts?.failFast ? 3 : null,
    enableReadyCheck: false,
    connectTimeout: 25_000,
    family: 4, // Force IPv4 for remote stability
    retryStrategy(times) {
      return Math.min(times * 500, 3000);
    },
  };

  // Enable TLS for cloud Redis / Upstash / rediss
  if (url.startsWith('rediss://') || url.includes('upstash.io')) {
    redisOpts.tls = {
      rejectUnauthorized: false,
    };
  }

  const client = new Redis(url, redisOpts);
  client.on('error', (err) => {
    // Suppress unhandled event crashes for transient reconnects
    if (process.env['NODE_ENV'] === 'development') {
      // transient connection error handled by retryStrategy
    }
  });

  return client;
}
