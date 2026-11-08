import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';

const { Pool } = pg;
export type DbPool = pg.Pool;
export type DbClient = NodePgDatabase<typeof schema>;

let globalPool: DbPool | undefined;
let globalDb: DbClient | undefined;

export function createDbConnection(connectionString?: string): { pool: DbPool; db: DbClient } {
  const url = connectionString ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  const pool = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30_000,
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

export function getDb(connectionString?: string): DbClient {
  if (!globalDb) {
    const conn = createDbConnection(connectionString);
    globalPool = conn.pool;
    globalDb = conn.db;
  }
  return globalDb;
}

export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export async function closeDb(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = undefined;
    globalDb = undefined;
  }
}
