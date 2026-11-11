import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { auditLogs, plants, users } from '@cmms/db';
import type { ServiceContext } from '../context';
import { assertCan } from '../auth/guard';

export interface WriteAuditInput {
  plantId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
}

export interface ListAuditLogsParams {
  plantId?: string;
  actorId?: string;
  entity?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogEntry {
  id: string;
  plantId: string | null;
  plantName: string | null;
  actorType: 'USER' | 'SYSTEM' | 'INTEGRATION';
  actorId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  action: string;
  actionLabelFa: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip: string | null;
  deviceId: string | null;
  at: Date;
}

export const ACTION_LABELS_FA: Record<string, string> = {
  'USER_CREATE': 'ایجاد کاربر',
  'USER_UPDATE': 'ویرایش کاربر',
  'USER_DELETE': 'حذف کاربر',
  'ASSET_CREATE': 'تعریف تجهیز صنعتی',
  'ASSET_UPDATE': 'ویرایش مشخصات تجهیز',
  'ASSET_DELETE': 'حذف تجهیز',
  'PM_TEMPLATE_CREATE': 'ایجاد قالب چک‌لیست نت',
  'PM_SCHEDULE_CREATE': 'ایجاد برنامه زمان‌بندی PM',
  'PM_SCHEDULE_UPDATE': 'ویرایش برنامه نت',
  'WO_CREATE': 'صدور دستورکار',
  'WO_START': 'شروع اجرای دستورکار',
  'WO_PROGRESS': 'ثبت پیشرفت چک‌لیست',
  'WO_LOTO_VERIFY': 'تایید ایمنی LOTO',
  'WO_PART_USAGE': 'ثبت مصرف قطعه یدکی',
  'WO_DOWNTIME': 'ثبت توقف خط تولید',
  'WO_COMPLETE': 'تکمیل و امضای دستورکار',
  'WO_STOP_UNSAFE': 'توقف اضطراری ناایمن (Stop-Work)',
  'PART_STOCK_ADJUST': 'اصلاح موجودی انبار قطعات',
  'NOTIFICATION_SEND': 'ارسال اعلان/پیامک/بله',
  'ESCALATION_TRIGGER': 'ارتقای هشدار سرپرستی (Escalation)',
};

export async function writeAuditLog(ctx: ServiceContext, input: WriteAuditInput): Promise<void> {
  const isSystem = !ctx.user || ctx.user.id === 'SYSTEM';
  await ctx.db.insert(auditLogs).values({
    plantId: input.plantId ?? null,
    actorType: isSystem ? 'SYSTEM' : 'USER',
    actorId: isSystem ? null : ctx.user.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason,
    ip: ctx.ip,
    deviceId: ctx.deviceId,
    at: ctx.now(),
  });
}

/**
 * Lists audit log entries for ISO compliance audit review.
 * Protected by CASL ability: requires can('read', 'AuditLog').
 */
export async function listAuditLogs(
  ctx: ServiceContext,
  params?: ListAuditLogsParams,
): Promise<{ logs: AuditLogEntry[]; totalCount: number }> {
  assertCan(ctx.ability, 'read', 'AuditLog');

  const conditions = [];

  const targetPlantId = params?.plantId ?? ctx.user.plantIds[0];
  if (targetPlantId) {
    conditions.push(eq(auditLogs.plantId, targetPlantId));
  }
  if (params?.actorId) {
    conditions.push(eq(auditLogs.actorId, params.actorId));
  }
  if (params?.entity) {
    conditions.push(eq(auditLogs.entity, params.entity));
  }
  if (params?.action) {
    conditions.push(eq(auditLogs.action, params.action));
  }
  if (params?.from) {
    conditions.push(gte(auditLogs.at, params.from));
  }
  if (params?.to) {
    conditions.push(lte(auditLogs.at, params.to));
  }

  const rows = await ctx.db
    .select({
      log: auditLogs,
      actorName: users.fullName,
      actorUsername: users.username,
      plantName: plants.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .leftJoin(plants, eq(auditLogs.plantId, plants.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.at))
    .limit(params?.limit ?? 50)
    .offset(params?.offset ?? 0);

  const logs: AuditLogEntry[] = rows.map((r) => ({
    id: r.log.id,
    plantId: r.log.plantId,
    plantName: r.plantName,
    actorType: r.log.actorType,
    actorId: r.log.actorId,
    actorName: r.actorName ?? (r.log.actorType === 'SYSTEM' ? 'سیستم خودکار BullMQ' : 'نامشخص'),
    actorUsername: r.actorUsername,
    action: r.log.action,
    actionLabelFa: ACTION_LABELS_FA[r.log.action] ?? r.log.action,
    entity: r.log.entity,
    entityId: r.log.entityId,
    before: r.log.before,
    after: r.log.after,
    reason: r.log.reason,
    ip: r.log.ip,
    deviceId: r.log.deviceId,
    at: r.log.at,
  }));

  return {
    logs,
    totalCount: logs.length, // For paginated display
  };
}

/**
 * Formats a list of AuditLogEntries into standard CSV format suitable for ISO audit export.
 */
export function formatAuditLogsCsv(logs: AuditLogEntry[]): string {
  const headers = [
    'شناسه لاگ',
    'زمان (UTC)',
    'کارخانه',
    'عامل تغییر',
    'شناسه کاربری',
    'عملیات',
    'موجودیت',
    'شناسه موجودیت',
    'توضیحات/علت',
    'IP',
  ];

  const escapeCsv = (str: string | null | undefined) => {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const lines = [headers.map(escapeCsv).join(',')];

  for (const log of logs) {
    lines.push(
      [
        escapeCsv(log.id),
        escapeCsv(log.at.toISOString()),
        escapeCsv(log.plantName ?? '-'),
        escapeCsv(log.actorName),
        escapeCsv(log.actorUsername ?? log.actorType),
        escapeCsv(log.actionLabelFa),
        escapeCsv(log.entity),
        escapeCsv(log.entityId),
        escapeCsv(log.reason ?? '-'),
        escapeCsv(log.ip ?? '-'),
      ].join(','),
    );
  }

  // UTF-8 BOM for Persian excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}
