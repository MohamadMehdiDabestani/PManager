import pino from 'pino';

export const logger = pino({
  name: 'cmms-worker',
  level: process.env['LOG_LEVEL'] ?? 'info',
});
