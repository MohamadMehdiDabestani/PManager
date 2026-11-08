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
  SYSTEM_MAINTENANCE: 'system-maintenance',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  GENERATE_WORK_ORDERS: 'generate-work-orders',
  OVERDUE_SCAN: 'overdue-scan',
  PROJECT_METER_DUE: 'project-meter-due',
  SEND_NOTIFICATION: 'send-notification',
  ESCALATE: 'escalate',
  LOW_STOCK_ALERT: 'low-stock-alert',
  DAILY_DIGEST: 'daily-digest',
  OUTBOX_SWEEPER: 'outbox-sweeper',
} as const;

export const defaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 7 * 86_400, count: 5_000 },
  removeOnFail: { age: 30 * 86_400 },
};

const cache = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: createRedis({ failFast: true }),
      prefix: QUEUE_PREFIX,
      defaultJobOptions,
    });
    cache.set(name, q);
  }
  return q;
}
