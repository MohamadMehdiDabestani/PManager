---
name: ai-features
description: Use when adding AI to the CMMS - RAG technician assistant over manuals and history, checklist generation from PDF manuals, Persian voice-to-work-order, failure text classification, PM interval optimization, anomaly detection/PdM, vision checks, with provider abstraction, human-in-the-loop and safety guardrails.
---

# AI features skill

Build in this order (value vs risk): 1 checklist generation -> 2 text classification & summaries -> 3 RAG assistant -> 4 voice -> 5 PM interval suggestions -> 6 vision -> 7 PdM on sensor data. Do not start PdM before >= 6 months of clean failure/downtime data.

## Architecture
- AI calls run in the **`ai` queue** (never inside web request handlers for slow tasks). Stream only for the interactive assistant.
- **Provider abstraction** (`packages/core/ai/provider.ts`): `chat()`, `embed()`, `transcribe()`; config selects hosted API or a self-hosted OpenAI-compatible endpoint (Ollama/vLLM) for factories with no internet or data-sovereignty needs. Never hardcode a vendor in feature code. Verify model names and SDK usage in current docs.
- Vector store: PostgreSQL + `pgvector`. Chunk manuals (~500-800 tokens, overlap 80), store `{assetModelId, source, page, chunk, embedding}`.
- Cost/safety: per-user and global rate limits, token budgets, request logging (inputs hashed or redacted), timeouts, retries via BullMQ, kill switch env flag.

## Features
1. **Checklist from manual**: upload PDF -> extract text -> LLM drafts PM tasks (task, frequency, tools, PPE, safety warnings, expected values/tolerances, source page) as strict JSON (Zod-validated; retry on invalid JSON) -> **engineer reviews/edits/approves** -> becomes `PmTemplate` draft. Always cite page numbers.
2. **Failure classification & summary**: classify free-text reports into failure mode/cause/component (controlled taxonomy), suggest root-cause 5-Why drafts, summarize asset history ("last 12 months: 3 bearing failures, avg MTTR 3.2h"). Show confidence; user can correct (feed corrections back as eval data).
3. **RAG assistant** ("چه کار کنم؟"): retrieve manual chunks + similar past WOs + parts in stock for that asset; answer in Persian with citations and a "not enough information" fallback. Include asset context automatically. Disclaimer: assistant suggests, technician decides; safety-critical steps always link to the official procedure.
4. **Voice**: record -> STT (Persian; evaluate accuracy on factory noise; keep audio) -> LLM extracts structured fields (asset, symptom, urgency, parts) -> prefilled form the user confirms. Never auto-submit.
5. **PM optimization**: statistics first (Weibull/failure interval analysis, PM-caused vs PM-prevented failures); LLM only to explain. Output = *suggestion* with evidence and expected impact; planner approves; log decision.
6. **Vision** (photo checks: leak/rust/wear): treat as triage hint with confidence, never a pass/fail; ask for human confirmation. OCR for nameplates -> prefill asset form.
7. **PdM**: separate Python service (FastAPI) fed by sensor data (vibration RMS/FFT features, temperature, motor current). Start with rule/threshold + anomaly detection (isolation forest, z-score on rolling baseline) on 5-10 critical assets; report precision/recall; alerts create *inspection* WOs, not repairs.

## Guardrails (mandatory)
- Human-in-the-loop for anything that changes schedules, templates, safety procedures, or stock.
- No AI output may disable or skip LOTO/permit steps.
- Show source citations and confidence; log prompt version, model, inputs/outputs reference, reviewer, decision (`AiSuggestion` table).
- PII minimization in prompts (no phone numbers, no personal data).
- Offline: assistant degrades gracefully ("available when connected"); cached FAQ per asset model optional.
- Evals: keep a small Persian golden set (questions, expected citations, checklist examples) and run on prompt/model changes.

## Prompts
Store versioned prompts in `packages/core/ai/prompts/*.md` with output JSON schemas. Persian domain glossary (نت، پمپ، گیربکس، بلبرینگ، روانکاری...) included as system context.
