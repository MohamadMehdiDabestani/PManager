# CMMS Agent Brief — Factory Preventive Maintenance (PM) System

You are a senior full-stack engineer building a **CMMS** (Computerized Maintenance Management System) for a **factory**. Primary UI language is **Persian (fa-IR, RTL, Jalali calendar)**. The system may run on a **factory intranet with limited or no internet**.

## Mission
Schedule preventive maintenance, auto-generate work orders, remind and escalate reliably, let technicians work fast on mobile (even offline), and give managers trustworthy KPIs (PM compliance, MTBF, MTTR, downtime).

## Stack (do not swap without asking)
- Monorepo: pnpm + Turborepo, TypeScript strict everywhere
- `apps/web`: Next.js (App Router) + Tailwind + shadcn/ui + TanStack Table + Recharts + React Hook Form + Zod
- `apps/worker`: Node.js + **BullMQ + Redis** (separate process; handles ALL scheduled/background work)
- `packages/db`: PostgreSQL + **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`, shared schema)
- `packages/core`: business logic (services, domain rules, Zod schemas). Used by BOTH web and worker
- `packages/queue`: queue names, job payload types, connection factory, producers
- PWA: Serwist + IndexedDB (Dexie). Auth: Auth.js. **Authorization: CASL** (`@casl/ability`, `@casl/react` + Drizzle `accessibleWhere` helper). Deploy: Docker on factory server

## Repo layout
```
apps/web/        UI + route handlers (thin)
apps/worker/     BullMQ workers, schedulers, Bull Board
packages/core/   services/, domain/, validators/, auth/
packages/db/     src/schema/, drizzle/ (migrations), src/client.ts
packages/queue/  queues.ts, payloads.ts, connection.ts, producers.ts
```

## Non-negotiable principles
1. **Business logic lives in `packages/core`**, never inside React components, route handlers, or job processors. Those only call services.
2. **Every background job is idempotent.** Running it twice must not duplicate work orders, notifications, or stock deductions.
3. **Jobs carry IDs, not data.** Load fresh state from the DB inside the processor.
4. **Store time in UTC**, display in Asia/Tehran + Jalali. Cron schedulers use `tz: 'Asia/Tehran'`.
5. **Safety first**: AI suggestions never auto-execute; LOTO/permit steps cannot be skipped by code paths.
6. **Audit everything** that changes state (who, when, before/after).
7. **Mobile-first for technician screens**: big buttons, minimal typing, works offline.
8. **No external CDN/fonts at runtime** (intranet). Self-host fonts and assets.
9. Validate all input with Zod at the boundary. **Authorize with CASL abilities in the service layer** (`assertCan`, `accessibleWhere` for Drizzle queries). Never check `user.role` directly; never rely on UI-only gating.

## How to work
- **Check `ROADMAP.md` first** at the start of every session to see completed phases and the current active phase, and update `ROADMAP.md` as milestones are completed.
- For any non-trivial task: write a short plan (artifact) → implement in small steps → run typecheck, lint, tests → summarize.
- Pick the matching skill in `.agent/skills/` before coding. Use workflows in `.agent/workflows/` (`/new-feature`, `/add-pm-job`, `/add-migration`, `/release-checklist`).
- Ask before: changing the DB schema destructively, adding a dependency, or changing queue/job names already in production.

## Skill index
| Skill | Use when |
|---|---|
| `bullmq-worker` | any queue, scheduler, worker, reminder, escalation, Redis work (MOST IMPORTANT) |
| `pm-scheduling-engine` | next-due calculation, work-order generation, meter-based PM |
| `pwa-offline` | manifest, service worker, offline sync, QR scan, push |
| `ui-ux-industrial` | any screen, component, dashboard, Persian/RTL |
| `notifications-iran` | SMS, Telegram/Bale/Eitaa, email, in-app, push channels |
| `ai-features` | RAG assistant, checklist generation, voice, PdM, classification |
| `rbac-audit-safety` | CASL abilities, plant scoping, field-level rules, audit log, LOTO, security |
| `testing-quality` | tests, CI, definition of done |

## Definition of done
Typecheck + lint + tests pass; migrations included; permissions checked; audit entries written; Persian strings in i18n files; mobile and RTL verified; job idempotency tested; docs updated.
