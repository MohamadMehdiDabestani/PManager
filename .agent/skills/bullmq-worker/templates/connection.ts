import IORedis, { type RedisOptions } from 'ioredis';
import { env } from './env';

export const QUEUE_PREFIX = `cmms-${env.NODE_ENV}`;

const base: RedisOptions = {
  maxRetriesPerRequest: null, // required for blocking connections (Worker, QueueEvents)
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 500, 5000),
};

/** New connection per Worker/QueueEvents (they use blocking commands). */
export const createRedis = () => new IORedis(env.REDIS_URL, base);

/** Producers inside the web app: fail fast instead of hanging requests. */
export const createProducerRedis = () =>
  new IORedis(env.REDIS_URL, { ...base, maxRetriesPerRequest: 3, enableOfflineQueue: false });
