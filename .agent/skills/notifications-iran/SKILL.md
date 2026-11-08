---
name: notifications-iran
description: Use when building notification delivery - channel adapters (SMS, Telegram, Bale, Eitaa, email SMTP, in-app/SSE, web push), user preferences and fallback chains, quiet hours, templates, deduplication, and resilience for restricted or intranet networks in Iran.
---

# Notifications skill

## Principles
- A notification is a **DB row first** (outbox) then a job (`bullmq-worker`). Delivery attempts update the row; the UI notification center reads the same table.
- **In-app is always on** and is the source of truth (SSE with polling fallback). Other channels are best-effort mirrors.
- Never depend on one external channel. Default chain priority: `IN_APP` (always on) + `SMS -> EITAA -> EMAIL`. Urgent (escalation level 3, safety) goes to SMS regardless of preference.
- Messaging platforms and push services may be blocked or slow: make every provider configurable (base URL, token, optional proxy), with timeouts (5-10s) and circuit-breaker style failure counters.

## Adapter interface
```ts
interface ChannelAdapter {
  name: Channel;
  canReach(user): boolean;                 // has verified phone/chat id/email?
  send(msg: { to: User; title: string; body: string; link?: string; idempotencyKey: string }): Promise<void>;
  isPermanent(err: unknown): boolean;      // invalid number, bot blocked -> don't retry same channel
}
```
Adapters to build: `SmsAdapter` (provider-pluggable: e.g. Kavenegar, Melipayamak, IPPanel - keep behind interface, API key in env), `TelegramAdapter` (Bot API), `BaleAdapter` (Bot API, Telegram-like), `EitaaAdapter` (Bot API), `EmailAdapter` (SMTP/nodemailer, internal mail server OK), `InAppAdapter` (DB + SSE), `WebPushAdapter` (VAPID).
Verify each provider's current API docs before implementing; do not guess endpoints.

## Linking users to channels
- Phone verification via OTP (SMS). Messenger linking via one-time deep-link code the user sends to the bot (`/start <code>`); store chat id. Allow unlink.
- Store consent and per-channel enable flags.

## Preferences & rules
- Per user: channels ordered, quiet hours (e.g. 22:00-06:00 Tehran), digest vs instant, per-event-type toggles. Urgent overrides quiet hours.
- Weekend/shift awareness: route to the on-duty person from the shift roster.
- Dedup: collapse repeats for the same `(userId, workOrderId, kind)` within a window; batch many due items into one digest message.

## Message design
- Short, Persian, actionable, with deep link (`/m/wo/<id>`): "PM تعویض فیلتر - دستگاه C-204 - موعد فردا ۰۸:۰۰".
- SMS length: Persian (Unicode) segments are ~70 chars; keep under 2 segments; no emojis in SMS.
- Templates in `messages/notifications.fa.json` with variables; numbers/dates formatted Jalali.
- Never include sensitive data (full names + phone) in SMS bodies beyond what's needed.

## Reliability
- Provider idempotency key where supported; otherwise rely on row status check.
- Rate limit per provider (worker `limiter`), budget guard for SMS cost (daily cap + alert).
- Track delivery status/callbacks if the provider supports them; store provider message id.
- Admin screen: channel health, failed deliveries, resend.

## Tests
Fallback order, permanent vs transient classification, quiet-hours delay, closed-WO cancellation, dedup, SMS length splitting.
