import { Redis } from 'ioredis';

export const QUEUE_PREFIX = process.env['QUEUE_PREFIX'] ?? 'cmms';

export function createRedis(opts?: { failFast?: boolean }): Redis {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379/0';
  return new Redis(url, {
    maxRetriesPerRequest: opts?.failFast ? 2 : null,
    enableReadyCheck: false,
  });
}
