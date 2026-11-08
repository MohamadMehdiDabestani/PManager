---
description: Pre-release checks for CMMS (intranet Docker deployment)
---
1. pnpm typecheck && pnpm lint && pnpm test && pnpm build.
2. `pnpm --filter @cmms/db db:migrate` on a staging copy of production data; verify.
3. Redis: appendonly yes, maxmemory-policy noeviction, password set, persistent volume.
4. Worker: stop_grace_period >= 60s, health endpoint OK, schedulers registered once (check Bull Board).
5. PWA: HTTPS with trusted internal CA; Lighthouse PWA pass; service worker version bumped; offline smoke test.
6. Notifications: send a test via each configured channel; verify fallback chain.
7. Backup: Postgres dump + restore tested; Redis AOF volume backed up.
8. Permissions: run the CASL role x subject x action matrix tests; verify Technician cannot reach manager screens/APIs and plant A cannot read plant B data (in-memory and via `accessibleWhere` Drizzle queries).
9. Changelog + rollback plan written.
