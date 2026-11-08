---
description: Build a new CMMS feature end-to-end (plan, schema, service, API, UI, tests)
---
1. Read AGENTS.md and pick relevant skills from .agent/skills/.
2. Write a plan artifact: user story, roles affected, data changes, jobs needed, screens (mobile + desktop), offline impact, audit events, risks.
3. If DB changes: run /add-migration first.
4. Implement domain logic + Zod validators + service in packages/core with unit tests.
5. If background work, reminders, or scheduling is involved: run /add-pm-job.
6. Add/extend CASL rules in packages/core/auth/ability.ts (new actions/subjects/fields), update the permission matrix tests, then add route handler / server action (thin) that builds ctx.ability and calls the service.
7. Build UI following ui-ux-industrial (RTL, Persian strings in messages/fa.json, 48px+ targets on technician screens).
8. If used by technicians: define offline behavior per pwa-offline (queueable? conflict policy?).
9. Add audit log entries.
10. Run pnpm typecheck && pnpm lint && pnpm test. Fix failures.
11. Summarize changes, migrations, new env vars, and manual test steps.
