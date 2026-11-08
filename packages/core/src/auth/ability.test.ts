import { describe, it, expect } from 'vitest';
import { subject } from '@casl/ability';
import { PgDialect } from 'drizzle-orm/pg-core';
import { workOrders } from '@cmms/db';
import { defineAbilityFor, defineSystemAbility } from './ability';
import { accessibleWhere, assertCan, AppForbidden } from './guard';

const tech = { id: 't1', role: 'TECHNICIAN' as const, plantIds: ['p1'], rulesVersion: 1 };

describe('CASL + Drizzle RBAC (TECHNICIAN & System)', () => {
  const a = defineAbilityFor(tech);

  it('executes own WO only inside own plant', () => {
    expect(a.can('execute', subject('WorkOrder', { assigneeId: 't1', plantId: 'p1' } as never))).toBe(true);
    expect(a.can('execute', subject('WorkOrder', { assigneeId: 't2', plantId: 'p1' } as never))).toBe(false);
    expect(a.can('execute', subject('WorkOrder', { assigneeId: 't1', plantId: 'p2' } as never))).toBe(false);
  });

  it('enforces field-level rules on WorkOrder', () => {
    const wo = subject('WorkOrder', { assigneeId: 't1', status: 'OPEN', plantId: 'p1' } as never);
    expect(a.can('update', wo, 'description')).toBe(true);
    expect(a.can('update', wo, 'checklistResult')).toBe(true);
    expect(a.can('update', wo, 'priority')).toBe(false);
    expect(a.can('update', wo, 'dueAt')).toBe(false);
  });

  it('prevents editing completed WO or AuditLog', () => {
    expect(a.can('update', subject('WorkOrder', { assigneeId: 't1', status: 'DONE', plantId: 'p1' } as never), 'description')).toBe(false);
    expect(a.can('update', 'AuditLog')).toBe(false);
  });

  it('translates CASL conditions to Drizzle SQL via accessibleWhere', () => {
    const sqlCond = accessibleWhere(a, 'read', 'WorkOrder', workOrders);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(sqlCond);
    expect(query.sql).toContain('"work_orders"."assignee_id"');
    expect(query.sql).toContain('"work_orders"."plant_id"');
    expect(query.params).toContain('t1');
    expect(query.params).toContain('p1');
  });

  it('throws AppForbidden when action is not permitted', () => {
    expect(() => assertCan(a, 'delete', 'WorkOrder')).toThrow(AppForbidden);
  });

  it('system ability for pm-generator is narrow and cannot delete', () => {
    const sys = defineSystemAbility('pm-generator');
    expect(sys.can('create', 'WorkOrder')).toBe(true);
    expect(sys.can('delete', 'WorkOrder')).toBe(false);
  });

  it('allows technician and operator to flag unsafe condition (stop-work authority)', () => {
    expect(a.can('flagUnsafe', subject('WorkOrder', { plantId: 'p1' } as never))).toBe(true);
    expect(a.can('create', 'PartUsage')).toBe(true);
  });
});
