---
name: rbac-audit-safety
description: Use for authorization with CASL (abilities, roles, plant scoping, field-level rules, Drizzle SQL query filtering, React gating, offline rules), authentication, audit trail, LOTO and work permits, safety checklists, e-signatures, and ISO-audit-ready records.
---

# Authorization (CASL), audit, and safety skill

Templates in `./templates/`: `ability.ts` (definitions), `guard.ts` (service/route enforcement + Drizzle SQL `accessibleWhere`), `react.tsx` (UI gating + offline rules), `ability.test.ts`.
Packages: `@casl/ability`, `@casl/react`, `drizzle-orm`. Verify current API against the installed versions (`pnpm why @casl/ability`) and official docs before coding.

## Model
- **Subjects** = Domain entity names matching Drizzle models: `Asset`, `PmSchedule`, `PmTemplate`, `WorkOrder`, `Part`, `PartUsage`, `Notification`, `AuditLog`, `User`, `Report`, `all`.
- **Actions**: `manage` (any), `read`, `create`, `update`, `delete`, plus domain actions: `assign`, `execute` (start/complete), `approve`, `acknowledge`, `adjustStock`, `export`, `signoff`.
- **Roles** (`ADMIN`, `PLANT_HEAD`, `MAINTENANCE_MANAGER`, `PLANNER`, `SUPERVISOR`, `TECHNICIAN`, `OPERATOR`, `AUDITOR`) only decide *which rules get built*. Code checks **abilities, never roles** (`ability.can(...)`, never `user.role === ...`).
- **Conditions** use standard CASL/Mongo-style condition objects (`{ $in: user.plantIds }`) so the same rule works in memory and translates cleanly via `accessibleWhere` into Drizzle SQL (`inArray`, `eq`, `and`, `or`):
  `can('execute', 'WorkOrder', { assigneeId: user.id, plantId: { $in: user.plantIds } })`.
- **Inverted rules** (`cannot`) for hard limits: nobody edits a completed WO except with the `reopen` action; `AuditLog` is read-only for everyone (`cannot(['update','delete'], 'AuditLog')` after any `manage all`).
- **Field-level**: `can('update', 'WorkOrder', ['description','checklistResult'], {...})` so technicians cannot change `priority`, `dueAt`, or `assigneeId`.
- Rules are built per request from the authenticated user in ONE place: `defineAbilityFor(user)` in `packages/core/auth/ability.ts`. No ad-hoc permission logic elsewhere.

## Enforcement (three layers, all required)
1. **Service layer (authoritative)**: every service method receives `ctx.ability` and calls `ForbiddenError.from(ability).throwUnlessCan(action, subject('WorkOrder', wo))` (use `subject()` helper from `@casl/ability` to tag plain objects). Missing `ctx.ability` is a type error.
2. **Queries**: list/read queries in Drizzle are filtered with `accessibleWhere(ability, action, subjectName, table)` merged into `.where(and(accessibleWhere(...), ...))`. Never fetch-then-filter in memory for lists. Verify field-level and `cannot` rules still translate; if a rule can't be expressed as a query, deny the bulk endpoint and fetch one by one with checks.
3. **UI**: `@casl/react` (`createContextualCan` / `useAbility`) only to hide/disable controls. The UI is a convenience, never security. Server returns `403` with a stable code; map to a Persian message.

## Worker / system context
Background jobs run as `SYSTEM` with an explicit narrow ability (`defineSystemAbility(purpose)`), e.g. the PM generator can `create WorkOrder` and `read PmSchedule`, not `delete`. Never run jobs with an admin ability. When a job acts "on behalf of" a user (e.g. report export), load that user and use `defineAbilityFor(user)`.

## Offline / PWA
- Send **packed rules** (`packRules` from `@casl/ability/extra`) with the session; cache in IndexedDB so the offline UI can gate actions via `new PureAbility(unpackRules(rules))`.
- Offline permission is advisory: the server re-checks on sync with the user's *current* rules. If a queued action is now forbidden, mark it "rejected - permission changed" in the "Needs attention" list (do not silently drop).
- Refresh rules on login, on role/plant change (version stamp `rulesVersion`), and each sync.

## Permission matrix (default, tune per factory)
| Role | Scope | Highlights |
|---|---|---|
| ADMIN | all plants | manage all except AuditLog update/delete |
| PLANT_HEAD | own plants | read all, approve, export, receive L3 escalation |
| MAINTENANCE_MANAGER | own plants | manage Asset/PmSchedule/PmTemplate/WorkOrder/Part, approve, export |
| PLANNER | own plants | create/update schedules, assign WOs, read stock |
| SUPERVISOR | own plants/areas | assign, acknowledge, approve completion, read reports |
| TECHNICIAN | own plants; WOs assigned or unassigned in own area | read assets, execute assigned WOs, update checklistResult/notes, create PartUsage, create requests |
| OPERATOR | own area | create repair requests, read own requests, read asset basics |
| AUDITOR | all (read-only) | read all incl. AuditLog, export |
Encode the matrix as data (`permissionMatrix`) and generate tests from it.

## Authentication
Auth.js (or Keycloak/LDAP if the factory has AD). Short idle timeout + quick PIN re-login for shared tablets; QR badge login optional; lockout; optional TOTP for managers/admins. Put `userId`, `role`, `plantIds`, `rulesVersion` in the session; build the ability from fresh DB user data for sensitive operations.

## Audit trail
- `AuditLog`: `{ id, at, actorId|SYSTEM, action, entity, entityId, before, after, ip, deviceId, reason? }`. Append-only (DB role without UPDATE/DELETE on this table where possible).
- Written in the same transaction as the change. Also log **permission denials** for sensitive actions (`action: 'FORBIDDEN_ATTEMPT'`).
- Required for: WO status changes, schedule edits, checklist edits, stock adjustments, role/permission changes, deletions, completed-WO edits (reason mandatory), AI suggestion decisions.
- Viewer UI with filters + export (ISO 9001/55000/IATF audits).

## Safety (factory-critical)
- **LOTO**: asset-level procedure (energy sources, isolation points, lock IDs, verification). For assets with `requiresLoto`, `execute` on WO is allowed only when LOTO steps are checked + lock ID + verifier - enforced in the service **in addition to** CASL (`can('execute')` is necessary, not sufficient).
- **Permits** (hot work, confined space, work at height): `WorkPermit` with validity window, approver, checklist, auto-expiry; approver needs `approve` on `WorkPermit`.
- PPE list per task; hazard warnings before start.
- Stop-work: any authenticated user may flag unsafe condition -> WO `ON_HOLD` + notify supervisor (explicit `can('flagUnsafe','WorkOrder')` for all roles).
- Incident/near-miss logging linked to WO/asset.
- E-signature: user + timestamp + method (PIN optional) + content hash; completed records are locked (corrections are new records / `reopen` with reason).

## Data protection
Encrypt sensitive fields at rest if policy requires; encrypted backups; retention policy for photos/audio; export/delete per policy.

## Tests (generate from the matrix)
For every role x subject x action: expected allow/deny. Plant-scope leakage (user of plant A cannot read plant B WOs, in-memory AND via `accessibleWhere` Drizzle queries). Field-level: technician cannot update `priority`. `cannot` precedence. LOTO gate not bypassable via API. System ability can't delete. Offline: packed rules round-trip. Audit entry exists per mutation.

## Anti-patterns
`if (user.role === 'ADMIN')` scattered in code; permission checks only in UI; fetching all rows then filtering; one giant "admin" ability for jobs; defining rules in multiple files; forgetting `subject()` tagging for plain objects; trusting client-sent rules.
