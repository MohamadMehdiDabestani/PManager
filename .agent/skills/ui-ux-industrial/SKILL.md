---
name: ui-ux-industrial
description: Use when designing or building any screen, component, dashboard, form, or design system for the CMMS - industrial UX for gloves/noise/sunlight, technician mobile flows, manager dashboards, Persian RTL typography, status colors, accessibility, empty/error/loading states.
---

# Industrial UI/UX skill

Two experiences, one design system:
1. **Technician (mobile/tablet, `/m/*`)**: fast, forgiving, minimal typing.
2. **Manager/Planner (desktop)**: dense, scannable, data-rich.

## Design tokens
- Font: Vazirmatn (self-hosted). Base 16px mobile / 14-15px desktop tables. Line-height 1.7 for Persian body text.
- Radius 12px cards, 10px controls. Spacing scale 4/8/12/16/24/32.
- Semantic status colors (always paired with icon + text, never color alone):
  - Overdue/critical: red. Due today/warning: amber. In progress: blue. Done: green. On hold/neutral: gray.
- Light theme default; high-contrast option and dark theme for control rooms. Contrast >= 4.5:1 (7:1 for key technician actions).

## Technician mobile rules
- Touch targets **>= 56px** (gloves), spacing >= 12px between targets; primary action is a full-width sticky bottom button.
- The core flow must take <= 4 taps: **Scan QR -> see asset + due tasks -> Start -> checklist -> Finish**.
- Checklist item = big row with 3 states: OK / Not OK / N/A. "Not OK" opens a mini-sheet: note, photo, voice, create CM request.
- Replace typing: pickers, steppers for meter values, quick-reply chips, voice notes, camera.
- Show safety first: LOTO/PPE card at the top of any hazardous WO; "I confirm" required before Start (cannot be bypassed).
- Persistent bar: online/offline, pending sync count. Never lose input: autosave drafts locally.
- Bottom tab bar (max 4): My Work, Scan, Requests, Profile. One-hand reachable. Avoid hover, long-press, and drag-only interactions.
- Sunlight/noise: strong contrast, haptic + visual feedback (no sound dependency).

## Manager desktop rules
- Home dashboard hierarchy (top to bottom):
  1. **Overdue PM** (red count + days late), **Due today/this week**, **Critical assets down**.
  2. KPI strip: PM compliance %, MTBF, MTTR, backlog, downtime hours (with trend vs previous period).
  3. Charts: Pareto of downtime by asset, PM vs CM ratio, compliance by line/team.
  4. Low-stock parts needed in next 14 days.
- Tables (TanStack): sticky header, column chooser, saved filters, bulk actions, keyboard navigation, CSV/Excel export, server-side pagination/sort for big lists.
- Planner: calendar (week/month) with drag to reschedule + kanban by status; show technician load and shutdown windows. Jalali calendar with Friday highlighted as weekend.
- Every KPI is clickable and drills to the filtered list that explains it.

## Forms
- React Hook Form + Zod; inline errors in Persian; validate on blur and submit. Preserve data on error.
- Jalali date picker; Persian/Arabic digit normalization; unit-aware numeric fields.
- Long forms: sections/steps with progress; autosave drafts.

## States & feedback
- Skeletons instead of spinners for lists; optimistic updates with rollback toast.
- Empty states explain the next action ("No PM due this week - create a schedule").
- Errors: say what happened + what to do; offline errors are not errors, they are "queued".
- Destructive actions: confirm with consequence text; prefer undo toast.

## Accessibility & i18n
- Semantic HTML, focus rings, ARIA labels in Persian, reduced-motion respected, screen-reader friendly tables.
- All strings in `messages/fa.json`; plural/number/date formatting via Intl with `fa-IR` (+ calendar `persian`).
- RTL rules in `.agent/rules/03-persian-rtl-jalali.md`.

## Deliverable checklist per screen
Mobile + desktop layouts, RTL verified, loading/empty/error/offline states, role-based visibility, keyboard and touch, Persian copy reviewed, screenshots in PR.
