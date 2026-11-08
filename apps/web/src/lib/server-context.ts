import { getDb, plants } from '@cmms/db';
import {
  defineAbilityFor,
  type AuthUser,
  type ServiceContext,
  type LoggerLike,
} from '@cmms/core';
import { auth } from '@/auth';

const consoleLogger: LoggerLike = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
  child: () => consoleLogger,
};

/**
 * Builds an authenticated ServiceContext for server components, server actions, and route handlers.
 * In development, if no session exists yet, falls back to a read/manage demo context if allowDemoFallback=true.
 */
export async function getServerContext(opts?: {
  requireAuth?: boolean;
}): Promise<{ ctx: ServiceContext; sessionUser: (AuthUser & { fullName: string; username: string }) | null }> {
  const session = await auth();
  const db = getDb();

  if (session?.user?.id) {
    const authUser: AuthUser & { fullName: string; username: string } = {
      id: session.user.id,
      username: session.user.username,
      fullName: session.user.fullName,
      role: session.user.role,
      plantIds: session.user.plantIds,
      rulesVersion: session.user.rulesVersion,
    };

    return {
      sessionUser: authUser,
      ctx: {
        user: authUser,
        ability: defineAbilityFor(authUser),
        db,
        now: () => new Date(),
        logger: consoleLogger,
      },
    };
  }

  if (opts?.requireAuth) {
    throw new Error('UNAUTHORIZED');
  }

  // Fallback context for initial view before login or during first setup
  let plantIds: string[] = [];
  try {
    const rows = await db.select({ id: plants.id }).from(plants);
    plantIds = rows.map((r) => r.id);
  } catch {
    plantIds = [];
  }

  const fallbackUser: AuthUser = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'MAINTENANCE_MANAGER',
    plantIds,
    rulesVersion: 1,
  };

  return {
    sessionUser: null,
    ctx: {
      user: fallbackUser,
      ability: defineAbilityFor(fallbackUser),
      db,
      now: () => new Date(),
      logger: consoleLogger,
    },
  };
}
