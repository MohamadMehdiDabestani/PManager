# Architecture rules
- Dependency direction: apps/* -> packages/core -> packages/db. Never import apps/web code from the worker or vice versa.
- Route handlers and server actions: parse (Zod) -> authorize -> call a service -> return. No business logic.
- Services accept an explicit ctx ({ user, ability, db/tx, now, logger }) so they are testable and usable from the worker (system user).
- Anything that may be called externally (mobile, ERP, sensors) is a REST route handler under /api/v1, versioned, documented in docs/api.md.
- Inject time via ctx.now(); never call new Date() inside domain logic.
- DB access only through repositories/Drizzle ORM (`@cmms/db`) in packages/core; use transactions (`db.transaction`) for multi-row changes.
- Records exposed to offline clients: UUID id, createdAt, updatedAt, deletedAt (soft delete), clientId where client-created.
- Config via validated env (Zod). No process.env outside env.ts.
- Authorization: single `defineAbilityFor(user)` (CASL) in packages/core/auth. Services call `assertCan(ctx.ability, ...)`; list queries use `accessibleWhere(ctx.ability, 'read', table)`. Jobs use narrow `defineSystemAbility(purpose)`, never admin.
