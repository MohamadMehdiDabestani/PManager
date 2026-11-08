---
description: Change the Drizzle ORM schema with a safe migration
---
1. Edit `packages/db/src/schema/*.ts`. Keep UUID ids, createdAt, updatedAt, deletedAt on offline-synced models.
2. Add indexes for every foreign key and every filter/sort used in lists and jobs (e.g. `[status, dueAt]`).
3. Add unique constraints that enforce idempotency (e.g. `uniqueIndex` on `[pmScheduleId, dueAt]`).
4. Run `pnpm --filter @cmms/db db:generate` to generate SQL migrations in `packages/db/drizzle/`, review the generated SQL, and apply with `pnpm --filter @cmms/db db:migrate`.
5. Destructive change (drop/rename/type change)? Stop and ask; use expand -> backfill -> contract steps.
6. Update seed data, Zod validators, services, and tests.
7. Note the migration in the PR summary.
