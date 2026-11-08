---
name: testing-quality
description: Use when writing tests, setting up CI, and verifying definition of done - unit tests for domain, integration tests with real Postgres/Redis, BullMQ processor tests, API tests, E2E (Playwright) for RTL/mobile/offline, accessibility and performance checks.
---

# Testing & quality skill

## Pyramid
1. **Unit (Vitest)**: domain functions (`computeNextDue`, KPI math, permissions, Jalali conversions, digit normalization). Fast, no IO, fake clock.
2. **Integration**: services + Drizzle ORM against real PostgreSQL (testcontainers or CI service); BullMQ processors against real Redis. Don't mock the DB or the queue for idempotency tests.
3. **API**: route handlers with auth fixtures per role.
4. **E2E (Playwright)**: Persian RTL layout, mobile viewport (Pixel 5-like), offline mode via `context.setOffline(true)`, QR flow with fake camera/manual code, Jalali date picker.
5. **Non-functional**: Lighthouse (PWA, performance), axe accessibility, k6 smoke for list endpoints, worker soak test (10k reminders).

## Must-have test cases (CMMS-specific)
- Generator twice => one WO. Worker restart mid-run => no duplicates, no lost reminders.
- Outbox sweeper recovers rows when Redis was down during enqueue.
- Completed WO cancels pending reminder/escalation jobs; processors also self-check.
- Escalation chain L1 -> L2 -> L3 timing with fake timers; stops on acknowledge.
- Offline: complete WO + photo offline, sync once online, no duplicates; conflict cases.
- Permissions (CASL): role x subject x action matrix generated from data; field-level rules; `cannot` precedence; plant scoping both via `ability.can` and `accessibleWhere` Drizzle queries; system abilities are narrow.
- Time: schedules around Jalali month ends, Nowruz, Friday weekend shift, Asia/Tehran vs UTC.
- Digits/normalization: Persian digits in phone/search; Arabic ی/ک.

## CI pipeline
`install -> typecheck -> lint -> unit -> integration (services: postgres, redis) -> build -> e2e (smoke) -> audit`. Fail on lint warnings in changed files; coverage targets: domain >= 90%, services >= 75%.

## Local commands (document in README)
`pnpm dev` (web+worker), `pnpm test`, `pnpm test:int`, `pnpm e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm db:migrate`, `pnpm db:seed`.

## Seed data
Realistic Persian seed: plant, 3 lines, 30 assets with criticality, 60 schedules (calendar/meter/hybrid), 20 technicians, history of failures for KPI charts.

## Done means
See `AGENTS.md` Definition of done.
