---
description: Add a new BullMQ queue, job, scheduler, or processor safely
---
1. Open .agent/skills/bullmq-worker/SKILL.md and follow it exactly.
2. Define payload (IDs only) as Zod schema in packages/queue/payloads.ts; add job name constant to queues.ts.
3. Decide: one-off, delayed, or repeatable (job scheduler). Define deterministic jobId (no colon character).
4. Write processor as makeXProcessor(deps) in apps/worker/src/processors/, idempotent, with error classification (retry vs UnrecoverableError).
5. Choose concurrency, limiter, attempts, backoff, timeouts; register worker.
6. If repeatable: register in apps/worker/src/schedulers.ts using upsertJobScheduler with tz Asia/Tehran.
7. Add producer helper in packages/queue/producers.ts; if state is written to DB and a job enqueued, use the outbox pattern.
8. Write tests: run processor twice -> same result; failure path; retry classification.
9. Update docs/queues.md (queue, job, schedule, retry policy, owner).
10. Verify in Bull Board locally; check graceful shutdown.
