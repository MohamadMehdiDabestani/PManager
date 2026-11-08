import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { users, userPlants, plants, type DbClient } from '@cmms/db';
import { assertCan, type AuthUser } from '../auth/index';
import { hashSecret, verifySecret } from '../auth/password';
import { normalizeDigits, normalizePersianText } from '../i18n/persian';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';

export const LoginCredentialsSchema = z.object({
  username: z.string().min(2).max(64),
  secret: z.string().min(3).max(128),
  mode: z.enum(['PASSWORD', 'PIN']).default('PASSWORD'),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(64),
  fullName: z.string().min(2).max(150),
  phone: z.string().min(10).max(20).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(128),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
  role: z.enum([
    'ADMIN',
    'PLANT_HEAD',
    'MAINTENANCE_MANAGER',
    'PLANNER',
    'SUPERVISOR',
    'TECHNICIAN',
    'OPERATOR',
    'AUDITOR',
  ]),
  plantIds: z.array(z.string().uuid()).min(1),
});

export type AuthenticatedUserSession = AuthUser & {
  username: string;
  fullName: string;
};

/**
 * Verifies user credentials (password or shared-tablet PIN) and loads assigned plantIds.
 */
export async function authenticateUser(
  db: DbClient,
  rawInput: z.infer<typeof LoginCredentialsSchema>,
): Promise<AuthenticatedUserSession | null> {
  const input = LoginCredentialsSchema.parse({
    ...rawInput,
    username: normalizeDigits(rawInput.username.trim().toLowerCase()),
    secret: normalizeDigits(rawInput.secret.trim()),
  });

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (!user || !user.active) {
    return null;
  }

  const valid =
    input.mode === 'PIN'
      ? verifySecret(input.secret, user.pinHash)
      : verifySecret(input.secret, user.passwordHash);

  if (!valid) {
    return null;
  }

  let assignedPlantIds: string[] = [];
  if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
    const allPlants = await db.select({ id: plants.id }).from(plants);
    assignedPlantIds = allPlants.map((p) => p.id);
  } else {
    const rows = await db
      .select({ plantId: userPlants.plantId })
      .from(userPlants)
      .where(eq(userPlants.userId, user.id));
    assignedPlantIds = rows.map((r) => r.plantId);
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    plantIds: assignedPlantIds,
    rulesVersion: user.rulesVersion,
  };
}

export async function listUsers(ctx: ServiceContext) {
  assertCan(ctx.ability, 'read', 'User');
  const allUsers = await ctx.db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      role: users.role,
      active: users.active,
      channelPreference: users.channelPreference,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return allUsers;
}

export async function createUser(ctx: ServiceContext, rawInput: z.infer<typeof CreateUserSchema>) {
  assertCan(ctx.ability, 'create', 'User');
  const input = CreateUserSchema.parse(rawInput);
  const normalizedUsername = normalizeDigits(input.username.trim().toLowerCase());
  const normalizedFullName = normalizePersianText(input.fullName);
  const normalizedPhone = input.phone ? normalizeDigits(input.phone.trim()) : null;

  return ctx.db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        username: normalizedUsername,
        fullName: input.fullName.trim(),
        fullNameNormalized: normalizedFullName,
        phone: normalizedPhone,
        email: input.email ?? null,
        passwordHash: hashSecret(input.password),
        pinHash: input.pin ? hashSecret(normalizeDigits(input.pin)) : null,
        role: input.role,
        active: true,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create user');
    }

    if (input.plantIds.length > 0) {
      await tx.insert(userPlants).values(
        input.plantIds.map((plantId) => ({
          userId: created.id,
          plantId,
        })),
      );
    }

    await writeAuditLog(
      { ...ctx, db: tx as unknown as DbClient },
      {
        plantId: input.plantIds[0] ?? null,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: created.id,
        after: {
          username: created.username,
          role: created.role,
          plantIds: input.plantIds,
        },
      },
    );

    return created;
  });
}
