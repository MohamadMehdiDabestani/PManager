import { ForbiddenError, subject } from '@casl/ability';
import { and, eq, inArray, not, or, sql, type SQL, type AnyColumn } from 'drizzle-orm';
import type { AppAbility, Action, SubjectName } from './ability.js';

export class AppForbidden extends Error {
  readonly httpStatus = 403;
  readonly code = 'FORBIDDEN';
  constructor(public readonly messageKey = 'errors.forbidden') {
    super(messageKey);
  }
}

export function assertCan(
  ability: AppAbility,
  action: Action,
  type: SubjectName,
  obj?: Record<string, unknown>,
  field?: string,
) {
  try {
    ForbiddenError.from(ability).throwUnlessCan(
      action,
      obj ? subject(type, obj as never) : type,
      field,
    );
  } catch {
    throw new AppForbidden();
  }
}

export function accessibleWhere<TTable extends object>(
  ability: AppAbility,
  action: Action,
  subjectType: SubjectName,
  table: TTable,
): SQL {
  const rules = ability.rulesFor(action, subjectType);
  if (rules.length === 0) {
    throw new AppForbidden();
  }

  const positiveClauses: SQL[] = [];
  const negativeClauses: SQL[] = [];
  let hasUnconditionalAllow = false;

  for (const rule of rules) {
    if (!rule.conditions) {
      if (rule.inverted) {
        return sql`false`;
      }
      hasUnconditionalAllow = true;
      continue;
    }

    const condSql = conditionObjectToSql(rule.conditions as Record<string, unknown>, table);
    if (!condSql) continue;

    if (rule.inverted) {
      negativeClauses.push(not(condSql));
    } else {
      positiveClauses.push(condSql);
    }
  }

  if (!hasUnconditionalAllow && positiveClauses.length === 0) {
    throw new AppForbidden();
  }

  const allowExpr = hasUnconditionalAllow
    ? sql`true`
    : positiveClauses.length === 1
      ? positiveClauses[0]!
      : or(...positiveClauses)!;

  if (negativeClauses.length === 0) {
    return allowExpr;
  }
  return and(allowExpr, ...negativeClauses)!;
}

function conditionObjectToSql<TTable extends object>(
  conditions: Record<string, unknown>,
  table: TTable,
): SQL | undefined {
  const parts: SQL[] = [];
  const tableCols = table as Record<string, unknown>;
  for (const [key, rawVal] of Object.entries(conditions)) {
    const col = tableCols[key] as AnyColumn | undefined;
    if (!col) continue;

    if (rawVal !== null && typeof rawVal === 'object' && '$in' in (rawVal as Record<string, unknown>)) {
      const list = (rawVal as { $in: unknown[] }).$in;
      if (list.length === 0) {
        parts.push(sql`false`);
      } else {
        parts.push(inArray(col, list));
      }
    } else {
      parts.push(eq(col, rawVal));
    }
  }
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export function assertCanUpdateFields(
  ability: AppAbility,
  type: SubjectName,
  entity: Record<string, unknown>,
  fields: string[],
) {
  for (const f of fields) {
    assertCan(ability, 'update', type, entity, f);
  }
}
