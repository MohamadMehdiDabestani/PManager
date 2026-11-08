import { AbilityBuilder, createMongoAbility, type MongoAbility, type ForcedSubject } from '@casl/ability';
import type {
  Asset,
  PmSchedule,
  PmTemplate,
  WorkOrder,
  Part,
  WorkOrderPartUsage,
  Notification,
  AuditLog,
  User,
  Role,
} from '@cmms/db';

export type Action =
  | 'manage'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'assign'
  | 'execute'
  | 'acknowledge'
  | 'approve'
  | 'reopen'
  | 'adjustStock'
  | 'export'
  | 'signoff'
  | 'flagUnsafe';

export type SubjectMap = {
  Asset: Asset;
  PmSchedule: PmSchedule;
  PmTemplate: PmTemplate;
  WorkOrder: WorkOrder;
  Part: Part;
  PartUsage: WorkOrderPartUsage;
  Notification: Notification;
  AuditLog: AuditLog;
  User: User;
  Report: Record<string, unknown>;
};

export type SubjectName = keyof SubjectMap;

export type AppSubjects =
  | 'all'
  | SubjectName
  | { [K in SubjectName]: ForcedSubject<K> & Partial<SubjectMap[K]> }[SubjectName];

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

export type AuthUser = {
  id: string;
  role: Role;
  plantIds: string[];
  rulesVersion: number;
};

type Builder = AbilityBuilder<AppAbility>;

const byRole: Record<Role, (u: AuthUser, b: Builder) => void> = {
  ADMIN: (_u, { can }) => {
    can('manage', 'all');
  },

  PLANT_HEAD: (u, { can }) => {
    const plantScope = { plantId: { $in: u.plantIds } };
    can('read', ['Asset', 'WorkOrder', 'PmSchedule', 'Part'], plantScope as never);
    can(['approve', 'export'], ['WorkOrder', 'Report'], plantScope as never);
  },

  MAINTENANCE_MANAGER: (u, { can }) => {
    const plantScope = { plantId: { $in: u.plantIds } };
    can('manage', ['Asset', 'PmSchedule', 'PmTemplate', 'Part', 'WorkOrder'], plantScope as never);
    can(['approve', 'adjustStock', 'export', 'reopen'], ['WorkOrder', 'Part', 'Report'], plantScope as never);
    can('read', 'User', plantScope as never);
  },

  PLANNER: (u, { can }) => {
    const plantScope = { plantId: { $in: u.plantIds } };
    can(['read', 'create', 'update'], ['PmSchedule', 'PmTemplate'], plantScope as never);
    can(['read', 'create', 'update', 'assign'], 'WorkOrder', plantScope as never);
    can('read', ['Asset', 'Part'], plantScope as never);
  },

  SUPERVISOR: (u, { can }) => {
    const plantScope = { plantId: { $in: u.plantIds } };
    can(['read', 'assign', 'acknowledge', 'approve'], 'WorkOrder', plantScope as never);
    can('read', ['Asset', 'Part', 'PmSchedule'], plantScope as never);
    can('export', 'Report', plantScope as never);
  },

  TECHNICIAN: (u, { can, cannot }) => {
    const plantScope = { plantId: { $in: u.plantIds } };
    can('read', 'Asset', plantScope as never);
    can('read', 'WorkOrder', { assigneeId: u.id, plantId: { $in: u.plantIds } } as never);
    can(['execute', 'acknowledge', 'signoff'], 'WorkOrder', { assigneeId: u.id, plantId: { $in: u.plantIds } } as never);
    can('update', 'WorkOrder', ['description', 'checklistResult', 'lotoVerified'], { assigneeId: u.id } as never);
    can('create', 'PartUsage');
    can('create', 'WorkOrder', plantScope as never);
    can('read', 'Part', plantScope as never);
    can('flagUnsafe', 'WorkOrder', plantScope as never);
    cannot('update', 'WorkOrder', ['priority', 'dueAt', 'assigneeId']);
  },

  OPERATOR: (u, { can }) => {
    const plantScope = { plantId: { $in: u.plantIds } };
    can('create', 'WorkOrder', plantScope as never);
    can('read', 'WorkOrder', { createdById: u.id, plantId: { $in: u.plantIds } } as never);
    can('read', 'Asset', plantScope as never);
    can('flagUnsafe', 'WorkOrder', plantScope as never);
  },

  AUDITOR: (_u, { can }) => {
    can(['read', 'export'], 'all');
  },
};

export function defineAbilityFor(user: AuthUser): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  byRole[user.role](user, builder);

  builder.cannot(['update', 'delete'], 'AuditLog');
  builder.cannot('update', 'WorkOrder', { status: 'DONE' } as never).because('Completed work orders are locked; use reopen');
  return builder.build();
}

export function defineSystemAbility(purpose: 'pm-generator' | 'notifier' | 'escalation'): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (purpose === 'pm-generator') {
    can('read', ['PmSchedule', 'Asset', 'PmTemplate']);
    can(['create', 'read'], 'WorkOrder');
  }
  if (purpose === 'notifier') {
    can(['read', 'update'], 'Notification');
    can('read', ['WorkOrder', 'User']);
  }
  if (purpose === 'escalation') {
    can('read', ['WorkOrder', 'Asset', 'User']);
    can('create', 'Notification');
  }
  return build();
}
