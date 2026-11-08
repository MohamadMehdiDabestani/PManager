import { Queue, type DefaultJobOptions } from 'bullmq';
import { createRedis, QUEUE_PREFIX } from './connection';

export const QUEUES = {
  PM_SCHEDULER: 'pm-scheduler',
  WORK_ORDERS: 'work-orders',
  NOTIFICATIONS: 'notifications',
  ESCALATION: 'escalation',
  INVENTORY: 'inventory',
  REPORTS: 'reports',
  AI: 'ai',
  SYSTEM: 'system-maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  GENERATE_WORK_ORDERS: 'generate-work-orders',
  OVERDUE_SCAN: 'overdue-scan',
  PROJECT_METER_DUE: 'project-meter-due',
  SEND_NOTIFICATION: 'send-notification',
  SCHEDULE_REMINDERS: 'schedule-reminders',
  ESCALATE: 'escalate',
  LOW_STOCK_ALERT: 'low-stock-alert',
  DAILY_DIGEST: 'daily-digest',
  OUTBOX_SWEEPER: 'outbox-sweeper',
  CLEANUP: 'cleanup',
} as const;

const DAY = 24 * 3600;

export const defaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 7 * DAY, count: 5_000 }, // seconds
  removeOnFail: { age: 30 * DAY },
};

const cache = new Map<QueueName, Queue>();
export function getQueue(name: QueueName): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, { connection: createRedis(), prefix: QUEUE_PREFIX, defaultJobOptions });
    cache.set(name, q);
  }
  return q;
}
