import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// ============================================================================
// Enums
// ============================================================================

export const roleEnum = pgEnum('user_role', [
  'ADMIN',
  'PLANT_HEAD',
  'MAINTENANCE_MANAGER',
  'PLANNER',
  'SUPERVISOR',
  'TECHNICIAN',
  'OPERATOR',
  'AUDITOR',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'OPERATIONAL',
  'UNDER_MAINTENANCE',
  'DOWN',
  'DECOMMISSIONED',
]);

export const assetCriticalityEnum = pgEnum('asset_criticality', [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

export const scheduleTriggerTypeEnum = pgEnum('schedule_trigger_type', [
  'CALENDAR',
  'METER',
  'HYBRID',
]);

export const scheduleAnchorModeEnum = pgEnum('schedule_anchor_mode', [
  'FIXED',
  'FLOATING',
]);

export const workOrderTypeEnum = pgEnum('work_order_type', [
  'PM',
  'CM',
  'PDM',
]);

export const workOrderStatusEnum = pgEnum('work_order_status', [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'DONE',
  'CANCELLED',
  'OVERDUE',
]);

export const priorityEnum = pgEnum('work_order_priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'SMS',
  'EITAA',
  'EMAIL',
  'IN_APP',
  'WEB_PUSH',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'PENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
]);

export const actorTypeEnum = pgEnum('actor_type', ['USER', 'SYSTEM']);

// ============================================================================
// 1. Organization & Auth (Plants, Locations, Users)
// ============================================================================

export const plants = pgTable('plants', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Tehran'),
  /** Working days of week (0=Sun ... 6=Sat). Default in Iran: Sat(6) to Thu(4), Fri(5) weekend */
  workingDays: jsonb('working_days').$type<number[]>().notNull().default([6, 0, 1, 2, 3, 4]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    parentId: uuid('parent_id'),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('locations_plant_idx').on(t.plantId),
    uniqueIndex('locations_plant_code_uniq').on(t.plantId, t.code),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 64 }).notNull().unique(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    fullNameNormalized: varchar('full_name_normalized', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 20 }).unique(),
    email: varchar('email', { length: 255 }).unique(),
    eitaaChatId: varchar('eitaa_chat_id', { length: 64 }),
    passwordHash: text('password_hash').notNull(),
    pinHash: text('pin_hash'),
    role: roleEnum('role').notNull().default('TECHNICIAN'),
    active: boolean('active').notNull().default(true),
    rulesVersion: integer('rules_version').notNull().default(1),
    /** Default notification fallback priority: 1. SMS -> 2. Eitaa -> 3. Email */
    channelPreference: jsonb('channel_preference')
      .$type<Array<'SMS' | 'EITAA' | 'EMAIL' | 'IN_APP' | 'WEB_PUSH'>>()
      .notNull()
      .default(['SMS', 'EITAA', 'EMAIL']),
    quietHoursStart: varchar('quiet_hours_start', { length: 5 }).default('22:00'),
    quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).default('06:00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('users_role_idx').on(t.role)],
);

export const userPlants = pgTable(
  'user_plants',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.plantId] })],
);

// ============================================================================
// 2. Assets & Meters
// ============================================================================

export type LotoStepDefinition = {
  stepNumber: number;
  energySource: string;
  isolationPoint: string;
  verificationMethod: string;
};

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    parentAssetId: uuid('parent_asset_id'),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    nameNormalized: varchar('name_normalized', { length: 200 }).notNull(),
    serialNumber: varchar('serial_number', { length: 100 }),
    qrOpaqueToken: varchar('qr_opaque_token', { length: 64 }).notNull().unique(),
    status: assetStatusEnum('status').notNull().default('OPERATIONAL'),
    criticality: assetCriticalityEnum('criticality').notNull().default('MEDIUM'),
    requiresLoto: boolean('requires_loto').notNull().default(false),
    lotoProcedure: jsonb('loto_procedure').$type<LotoStepDefinition[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('assets_plant_status_idx').on(t.plantId, t.status),
    uniqueIndex('assets_plant_code_uniq').on(t.plantId, t.code),
  ],
);

export const assetMeters = pgTable(
  'asset_meters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    unit: varchar('unit', { length: 32 }).notNull(), // e.g., 'HOURS', 'CYCLES', 'KM'
    currentReading: doublePrecision('current_reading').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('asset_meters_asset_idx').on(t.assetId)],
);

export const assetMeterReadings = pgTable(
  'asset_meter_readings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    meterId: uuid('meter_id')
      .notNull()
      .references(() => assetMeters.id, { onDelete: 'cascade' }),
    reading: doublePrecision('reading').notNull(),
    recordedById: uuid('recorded_by_id').references(() => users.id, { onDelete: 'set null' }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    clientId: varchar('client_id', { length: 64 }).unique(),
  },
  (t) => [index('meter_readings_meter_recorded_idx').on(t.meterId, t.recordedAt)],
);

// ============================================================================
// 3. PM Templates & PM Schedules
// ============================================================================

export type ChecklistItemDefinition = {
  id: string;
  label: string;
  type: 'BOOLEAN' | 'NUMBER' | 'TEXT' | 'PHOTO';
  unit?: string;
  minValue?: number;
  maxValue?: number;
  required: boolean;
};

export const pmTemplates = pgTable(
  'pm_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    estimatedMinutes: integer('estimated_minutes').notNull().default(60),
    checklist: jsonb('checklist').$type<ChecklistItemDefinition[]>().notNull().default([]),
    requiredPpe: jsonb('required_ppe').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('pm_templates_plant_idx').on(t.plantId)],
);

export const pmSchedules = pgTable(
  'pm_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => pmTemplates.id, { onDelete: 'restrict' }),
    triggerType: scheduleTriggerTypeEnum('trigger_type').notNull().default('CALENDAR'),
    anchorMode: scheduleAnchorModeEnum('anchor_mode').notNull().default('FIXED'),
    intervalDays: integer('interval_days'),
    meterId: uuid('meter_id').references(() => assetMeters.id, { onDelete: 'set null' }),
    intervalMeter: doublePrecision('interval_meter'),
    lastDoneAt: timestamp('last_done_at', { withTimezone: true }),
    lastDoneMeter: doublePrecision('last_done_meter'),
    nextDueAt: timestamp('next_due_at', { withTimezone: true }),
    leadDays: integer('lead_days').notNull().default(3),
    priority: priorityEnum('priority').notNull().default('MEDIUM'),
    defaultAssigneeId: uuid('default_assignee_id').references(() => users.id, { onDelete: 'set null' }),
    reminderOffsetsMin: jsonb('reminder_offsets_min')
      .$type<number[]>()
      .notNull()
      .default([-1440, 0, 60]),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('pm_schedules_plant_active_due_idx').on(t.plantId, t.active, t.nextDueAt),
    index('pm_schedules_asset_idx').on(t.assetId),
  ],
);

// ============================================================================
// 4. Work Orders & Downtime
// ============================================================================

export type ChecklistResultEntry = {
  itemId: string;
  value: boolean | number | string | null;
  note?: string;
  photoUrl?: string;
  completedAt?: string;
};

export const workOrders = pgTable(
  'work_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    pmScheduleId: uuid('pm_schedule_id').references(() => pmSchedules.id, { onDelete: 'set null' }),
    type: workOrderTypeEnum('type').notNull().default('PM'),
    status: workOrderStatusEnum('status').notNull().default('OPEN'),
    priority: priorityEnum('priority').notNull().default('MEDIUM'),
    title: varchar('title', { length: 250 }).notNull(),
    description: text('description'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    lotoVerified: boolean('loto_verified').notNull().default(false),
    lotoLockId: varchar('loto_lock_id', { length: 64 }),
    lotoVerifiedById: uuid('loto_verified_by_id').references(() => users.id, { onDelete: 'set null' }),
    checklistSnapshot: jsonb('checklist_snapshot')
      .$type<ChecklistItemDefinition[]>()
      .notNull()
      .default([]),
    checklistResult: jsonb('checklist_result')
      .$type<ChecklistResultEntry[]>()
      .notNull()
      .default([]),
    clientId: varchar('client_id', { length: 64 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('work_orders_plant_status_due_idx').on(t.plantId, t.status, t.dueAt),
    index('work_orders_assignee_status_idx').on(t.assigneeId, t.status),
    // Enforces idempotent PM work order generation
    uniqueIndex('work_orders_pm_schedule_due_uniq').on(t.pmScheduleId, t.dueAt),
  ],
);

export const downtimeLogs = pgTable(
  'downtime_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    workOrderId: uuid('work_order_id').references(() => workOrders.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    reason: text('reason'),
    isPlanned: boolean('is_planned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('downtime_logs_asset_started_idx').on(t.assetId, t.startedAt)],
);

// ============================================================================
// 5. Simple Spare Parts & Part Usage
// ============================================================================

export const parts = pgTable(
  'parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    nameNormalized: varchar('name_normalized', { length: 200 }).notNull(),
    unit: varchar('unit', { length: 32 }).notNull().default('عدد'),
    quantityOnHand: doublePrecision('quantity_on_hand').notNull().default(0),
    minQuantity: doublePrecision('min_quantity').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('parts_plant_code_uniq').on(t.plantId, t.code)],
);

export const workOrderPartUsages = pgTable(
  'work_order_part_usages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    partId: uuid('part_id')
      .notNull()
      .references(() => parts.id, { onDelete: 'restrict' }),
    quantityUsed: doublePrecision('quantity_used').notNull(),
    recordedById: uuid('recorded_by_id').references(() => users.id, { onDelete: 'set null' }),
    clientId: varchar('client_id', { length: 64 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('wo_part_usages_wo_idx').on(t.workOrderId)],
);

// ============================================================================
// 6. Notifications (Outbox) & Audit Logs
// ============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workOrderId: uuid('work_order_id').references(() => workOrders.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 64 }).notNull(), // e.g., 'WO_REMINDER', 'WO_ESCALATION', 'WO_ASSIGNED'
    priority: priorityEnum('priority').notNull().default('MEDIUM'),
    channel: notificationChannelEnum('channel').notNull().default('SMS'),
    status: notificationStatusEnum('status').notNull().default('PENDING'),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    link: varchar('link', { length: 255 }),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('notifications_user_status_idx').on(t.userId, t.status),
    index('notifications_status_created_idx').on(t.status, t.createdAt),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantId: uuid('plant_id').references(() => plants.id, { onDelete: 'set null' }),
    actorType: actorTypeEnum('actor_type').notNull().default('USER'),
    actorId: uuid('actor_id'),
    action: varchar('action', { length: 100 }).notNull(),
    entity: varchar('entity', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    reason: text('reason'),
    ip: varchar('ip', { length: 64 }),
    deviceId: varchar('device_id', { length: 128 }),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_plant_at_idx').on(t.plantId, t.at),
  ],
);

// ============================================================================
// Exported Inferred Types
// ============================================================================

export type Role = (typeof roleEnum.enumValues)[number];
export type AssetStatus = (typeof assetStatusEnum.enumValues)[number];
export type WorkOrderStatus = (typeof workOrderStatusEnum.enumValues)[number];
export type WorkOrderType = (typeof workOrderTypeEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
export type NotificationChannel = (typeof notificationChannelEnum.enumValues)[number];

export type Plant = InferSelectModel<typeof plants>;
export type NewPlant = InferInsertModel<typeof plants>;

export type Location = InferSelectModel<typeof locations>;
export type User = InferSelectModel<typeof users>;
export type Asset = InferSelectModel<typeof assets>;
export type AssetMeter = InferSelectModel<typeof assetMeters>;
export type PmTemplate = InferSelectModel<typeof pmTemplates>;
export type PmSchedule = InferSelectModel<typeof pmSchedules>;
export type WorkOrder = InferSelectModel<typeof workOrders>;
export type Part = InferSelectModel<typeof parts>;
export type WorkOrderPartUsage = InferSelectModel<typeof workOrderPartUsages>;
export type Notification = InferSelectModel<typeof notifications>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
