import type { DbClient } from '@cmms/db';
import type { AppAbility, AuthUser } from './auth/ability.js';

export interface LoggerLike {
  info(obj: Record<string, unknown> | string, msg?: string): void;
  warn(obj: Record<string, unknown> | string, msg?: string): void;
  error(obj: Record<string, unknown> | string, msg?: string): void;
  child(bindings: Record<string, unknown>): LoggerLike;
}

export interface ServiceContext {
  user: AuthUser | { id: 'SYSTEM'; role: 'SYSTEM'; plantIds: string[] };
  ability: AppAbility;
  db: DbClient;
  now: () => Date;
  logger: LoggerLike;
  ip?: string;
  deviceId?: string;
}
