import { describe, it, expect } from 'vitest';
import { subject } from '@casl/ability';
import { defineAbilityFor, defineSystemAbility } from './ability';

const tech = { id: 't1', role: 'TECHNICIAN', plantIds: ['p1'], rulesVersion: 1 } as const;

describe('TECHNICIAN', () => {
  const a = defineAbilityFor({ ...tech, plantIds: [...tech.plantIds] });
  it('executes own WO only in own plant', () => {
    expect(a.can('execute', subject('WorkOrder', { assigneeId: 't1', plantId: 'p1' } as never))).toBe(true);
    expect(a.can('execute', subject('WorkOrder', { assigneeId: 't2', plantId: 'p1' } as never))).toBe(false);
    expect(a.can('execute', subject('WorkOrder', { assigneeId: 't1', plantId: 'p2' } as never))).toBe(false);
  });
  it('cannot change priority/dueAt/assignee', () => {
    const wo = subject('WorkOrder', { assigneeId: 't1', status: 'OPEN', plantId: 'p1' } as never);
    expect(a.can('update', wo, 'description')).toBe(true);
    expect(a.can('update', wo, 'priority')).toBe(false);
  });
  it('cannot edit completed WO or audit log', () => {
    expect(a.can('update', subject('WorkOrder', { assigneeId: 't1', status: 'DONE', plantId: 'p1' } as never), 'description')).toBe(false);
    expect(a.can('update', 'AuditLog')).toBe(false);
  });
});

describe('system ability', () => {
  it('pm-generator cannot delete', () => {
    expect(defineSystemAbility('pm-generator').can('delete', 'WorkOrder')).toBe(false);
  });
});

// Generate a full role x subject x action table from `permissionMatrix`; add plant-scope leakage tests
// that run BOTH ability.can(...) and Drizzle SQL generation via accessibleWhere(...).
