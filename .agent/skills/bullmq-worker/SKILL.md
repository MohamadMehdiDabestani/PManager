---
name: bullmq-worker
description: Use for ANY background work in the CMMS - BullMQ queues, workers, job schedulers (cron), delayed jobs, PM work-order generation, reminders, escalation, notification delivery, Redis config, Bull Board, retries, idempotency, graceful shutdown, and worker tests. Most critical skill in this project.
---

# BullMQ + Redis worker skill

The worker (`apps/worker`) is a **separate Node.js process** that owns everything time-based or slow: generating PM work orders, sending reminders, escalating overdue work, projecting meter-based due dates, stock alerts, reports, AI jobs. The web app only **enqueues**; it never runs scheduled logic.

Verify API details against the installed BullMQ version (`pnpm why bullmq`) and official docs. Job Schedulers (`upsertJobScheduler`) require BullMQ >= 5.16; they replace the deprecated "repeatable jobs" API.

Templates (copy and adapt) are in `./templates/`:
`connection.ts`, `queues.ts`, `payloads.ts`, `producers.ts`, `schedulers.ts`, `worker-bootstrap.ts`, `processors/generate-work-orders.ts`, `processors/send-notification.ts`, `processors/escalation.ts`, `bull-board.ts`, `docker-compose.yml`, `redis.conf`, `processor.test.ts`.

## 1. Queue catalog (one queue per failure/throughput profile)
| Queue | Purpose | Concurrency | Notes |
|---|---|---|---|
| `pm-scheduler` | Daily generation of PM work orders, overdue scan, meter projection | 1-2 | Heavy DB; keep low concurrency |
| `work-orders` | WO side effects (assign, status-change hooks, auto-close) | 5 | |
| `notifications` | Deliver SMS/Telegram/Bale/email/push/in-app | 10 | Rate limiter per provider |
| `escalation` | Delayed escalation levels for overdue/unacknowledged WOs | 5 | Delayed jobs with deterministic ids |
| `inventory` | Low-stock alerts, reservation expiry | 2 | |
| `reports` | PDF/Excel exports, scheduled digests | 2 | Long timeouts |
| `ai` | Embeddings, checklist generation, classification | 2 | External API, strict rate limit |
| `system-maintenance` | Cleanup, outbox sweeper, health pings | 1 | |

Separate queues so a stuck AI/SMS provider never blocks PM generation.

## 2. Golden rules
1. **Idempotent processors.** Enforce with DB unique constraints (e.g. `uniqueIndex` on `(pmScheduleId, dueAt)` on `work_orders`), `onConflictDoNothing()`/upsert, and status checks at the start ("already sent? return").
2. **Payload = IDs only** (+ small enums/numbers). Re-load entities inside the processor. Validate payload with Zod at the top.
3. **Deterministic `jobId`** for anything that must not duplicate or must be cancellable: `rem-<woId>-<offsetMin>`, `esc-<woId>-L<level>`, `gen-<yyyyMMdd>`. **Never use `:` in custom ids and never pure integers.**
4. **Outbox pattern** for "write DB + enqueue": insert `Notification` (status `PENDING`) in the same DB transaction, enqueue after commit. A `system-maintenance` sweeper re-enqueues `PENDING` rows older than 2 minutes. This survives Redis loss or crash between commit and enqueue.
5. **Schedulers are code, registered idempotently at worker boot** with `upsertJobScheduler(id, { pattern, tz: 'Asia/Tehran' }, { name, data, opts })`. Running boot twice must not create duplicates (same scheduler id = upsert).
6. **Time**: cron in `Asia/Tehran`; DB in UTC; compute "due" with injected `now`. Configurable working days (Friday weekend); skip/shift per plant calendar.
7. **Classify errors**: transient (network, 5xx, rate limit) -> throw (retry with backoff). Permanent (invalid phone, WO deleted, validation) -> `throw new UnrecoverableError(msg)`. Never retry what cannot succeed.
8. **Retries**: default `attempts: 5`, `backoff: { type: 'exponential', delay: 5000 }`. Notifications may use custom backoff and channel fallback instead of blind retry.
9. **Retention**: `removeOnComplete: { age: 7d, count: 5000 }`, `removeOnFail: { age: 30d }`. Failed jobs are evidence; do not drop them instantly.
10. **Dead-letter**: on final failure (`attemptsMade >= attempts`) in the `failed` event, write a `FailedJob`/alert record and notify admins; never fail silently.
11. **Graceful shutdown**: on SIGTERM/SIGINT call `worker.close()` for every worker (waits for active jobs), then close queues/schedulers, Drizzle pg pool (`pool.end()`), Redis. Container `stop_grace_period: 60s`+.
12. **One scheduler owner.** Every worker replica calls `upsertJobScheduler` safely (idempotent); BullMQ guarantees a scheduled job is produced once, and workers compete for it. Do NOT add node-cron or setInterval for business schedules.
13. **Don't block the event loop.** CPU-heavy work (PDF, Excel, ML) in `reports`/`ai` queues using sandboxed processors (`useWorkerThreads` or file-path processors) or a separate service.
14. **Rate limit external calls** with Worker `limiter: { max, duration }` per queue/provider.
15. **Stalled jobs**: keep `lockDuration` > longest sync segment; call `job.updateProgress()` / `await job.extendLock` in long loops; set `maxStalledCount: 1`.

## 3. Redis requirements
- `appendonly yes`, `appendfsync everysec` (persistence for queued reminders).
- `maxmemory-policy noeviction` (BullMQ requires it; eviction corrupts queues).
- Password (`requirepass`), bind to internal network, never public.
- Dedicated Redis DB/instance for queues (not shared with cache). Use `prefix: 'cmms'` (+ env suffix) on every Queue/Worker/QueueEvents.
- Connections: `maxRetriesPerRequest: null` for Workers/QueueEvents (blocking commands). Queues in web may use a separate connection with fail-fast behavior.
- Persistent volume; include in backup.
- Intranet-friendly: no cloud Redis dependency.

## 4. Core jobs to implement (in order)
1. `pm-scheduler / generate-work-orders` (nightly 02:00 Tehran, plus on-demand after schedule edit): create WOs for schedules whose `nextDueAt - leadDays <= now`. See `pm-scheduling-engine`.
2. `pm-scheduler / overdue-scan` (every 15 min): mark `OVERDUE`, enqueue escalation if not already.
3. `notifications / send-notification`: deliver one Notification row on one channel with fallback chain (`notifications-iran` skill).
4. Reminder fan-out: when a WO is created, enqueue delayed jobs for offsets (e.g. -7d, -1d, 0, +1h) with deterministic ids. When WO completes/cancels, `queue.remove(jobId)` for pending ones; processors ALSO re-check status (removal fails on active jobs).
5. `escalation / escalate`: levels L1 supervisor, L2 manager, L3 plant head; each level schedules the next as a delayed job; stops if WO status is done/cancelled/acknowledged.
6. `pm-scheduler / project-meter-due`: for meter-based PM, project next due from average daily usage; generate WO when threshold within lead window; also triggered when a `MeterReading` is saved.
7. `inventory / low-stock-alert` (daily 07:00): parts under minimum and needed by upcoming PMs (next 14 days).
8. `reports / daily-digest` (07:00 on working days): overdue, due today, critical assets down, low stock.
9. `system-maintenance / outbox-sweeper` (every minute) and `cleanup` (nightly).

## 5. Observability
- Log with `pino` child logger: `{ queue, jobId, jobName, attempt, woId }`.
- Expose `/healthz` (Redis ping + DB ping) and `/metrics` (JSON or Prometheus): counts from `queue.getJobCounts()`, oldest waiting age, failed in last hour.
- Bull Board on an internal port behind auth (template provided). Admin-only.
- Alert when: waiting age > 5 min on `notifications`, failed count spikes, a scheduler has not run within 2x its interval (write `lastRunAt` heartbeat to DB).

## 6. Adding a new job (checklist)
1. Payload Zod schema + job name constant in `packages/queue`.
2. Producer function (typed) in `packages/queue/producers.ts`.
3. Processor factory `makeXProcessor(deps)` (deps: db, logger, clock, services, notifier) - pure and testable.
4. Register in `worker-bootstrap.ts` with concurrency/limiter.
5. If recurring, add to `schedulers.ts`.
6. Tests: happy path, run twice (idempotent), transient error retries, permanent error is Unrecoverable.
7. Document in `docs/queues.md`.

## 7. Anti-patterns (reject in review)
- Business schedules with `setInterval`/`node-cron`; scheduling from the Next.js process.
- Large objects or PII in job data; relying on job data as source of truth.
- Auto-incrementing numeric jobIds; ids with `:`.
- Enqueue inside a DB transaction before commit.
- Processors that call `new Date()` directly, or swallow errors.
- One giant queue for everything; unlimited concurrency on external APIs.
- Using `removeOnFail: true` in production.
- Shared Redis with `allkeys-lru`.
