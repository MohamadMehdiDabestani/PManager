---
name: pwa-offline
description: Use for PWA work - manifest, Serwist service worker, caching strategies, offline queue and sync with IndexedDB (Dexie), QR scanning, camera/voice capture, web push, install flow, HTTPS on intranet, and conflict resolution for technician work orders.
---

# PWA + offline skill (technician experience)

## Requirements
- **HTTPS is mandatory** for service workers, camera, and push (except `localhost`). On an intranet, issue certificates from an internal CA installed on devices (or use Caddy internal CA). Without this, offline and QR scanning will silently fail.
- Manifest: `lang: "fa"`, `dir: "rtl"`, `display: "standalone"`, `start_url: "/m"` (technician home), `theme_color`, maskable 192/512 icons, shortcuts (Scan QR, My Work Orders, New Request).
- Library: **Serwist** (`@serwist/next`) for precache and runtime caching. Version the SW; show an "update available - reload" toast; never force reload mid-form.

## What works offline (scope it)
| Feature | Offline? |
|---|---|
| View my assigned WOs, asset details, checklists, manuals (PDF cached on demand) | Yes (read cache) |
| Start/finish WO, tick checklist, add notes/photos/voice, record meter reading, add used parts | Yes (queued) |
| Create repair request (operator) | Yes (queued) |
| Dashboards, reports, planning, user admin | Online only |

## Caching strategies
- App shell + static assets: precache.
- `/api/v1/me/work-orders`, `/assets/:id`: StaleWhileRevalidate with expiration; also mirrored into IndexedDB (source for UI).
- Mutations: never cached by SW; go through the app-level outbox.
- Attachments: store blobs in IndexedDB, upload when online (resumable, chunked if > 5 MB). Compress photos client-side (max ~1600px, quality 0.7).

## Outbox / sync design
- Client generates `clientId` (UUID v4) + `clientCreatedAt` for each action; server uses `clientId` as **idempotency key** (unique index) so retries never duplicate.
- Dexie tables: `outbox` (id, type, payload, status, attempts, lastError), `workOrders`, `assets`, `checklists`, `meta` (lastSyncAt).
- Sync triggers: `online` event, app foreground, periodic (when open), manual button, Background Sync API where supported (not iOS - never rely on it).
- Pull sync: `GET /api/v1/sync?since=<cursor>` returns changed records (include `deletedAt` tombstones). Server-assigned cursor, not client clock.
- Order actions per entity (FIFO per WO). Backoff on failure; surface permanently failed items in a "Needs attention" list with retry/discard.
- Conflict policy: checklist/notes -> merge by item id, last-writer-wins per item; status -> state machine wins (reject illegal transitions and show a clear message); completed WO edited elsewhere -> keep server version, show diff to technician.
- Always show: online/offline pill, pending count, last sync time, per-WO "not yet synced" badge.

## QR scanning
- Prefer `BarcodeDetector` when available; fallback to `@yudiel/react-qr-scanner` or `zxing-wasm`. Torch toggle, large viewfinder, vibrate on success, manual code entry fallback.
- QR encodes `https://<host>/a/<opaque-token>`; resolving requires login; unknown token -> friendly message.
- Printable QR label generator (asset code, name, QR) - A6/label-printer CSS.

## Capture
- Photos: `<input type="file" accept="image/*" capture="environment">` as the most compatible path.
- Voice notes: MediaRecorder -> upload -> STT job (`ai` queue). Show waveform and hard stop at 2 min. Keep original audio.
- Signature (sign-off, permits): canvas signature saved as PNG + user + timestamp.

## Push
- Web Push with VAPID (`web-push` library, self-hosted). On Chrome it relies on browser vendor push services, which may be unreachable in restricted networks: **in-app notifications (SSE or polling) + SMS/messenger are the reliable path**; push is a bonus. iOS requires installed PWA (Home Screen).
- Persist `PushSubscription` per device; drop on 404/410.

## Performance
- Technician routes under `/m/*`: small JS budget (< 200KB gz initial), no heavy chart libs there. Lazy-load everything else. Test on a low-end Android (4x CPU throttle).

## Test checklist
Airplane mode: complete a WO with photo -> reconnect -> single WO completed, photo attached. Kill the tab mid-sync and reopen. Two devices complete the same WO. Clock skew on device. Storage quota exceeded (handle `QuotaExceededError`). SW update during offline use.

## Permissions offline (CASL)
Cache `packRules(ability.rules)` + `rulesVersion` in Dexie `meta`; build a `PureAbility` client-side for gating UI. Advisory only: the server re-checks queued actions on sync with current rules; forbidden ones go to "Needs attention" as "permission changed". Details in `rbac-audit-safety`.
