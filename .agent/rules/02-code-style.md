# Code style
- TypeScript strict, no any (use unknown + narrowing). No default exports except Next.js pages/layouts.
- Imports: never use `.js` extension in TypeScript relative imports (e.g. use `import { x } from './env'`, not `'./env.js'`). The monorepo uses `"moduleResolution": "Bundler"` which resolves extensionless imports to `.ts` directly.
- UI components: always use or extend **shadcn/ui** primitives from `@/components/ui/*`. Never create ad-hoc raw Tailwind button/card/dialog components when a shadcn component exists.
- Small pure functions for domain rules (e.g. computeNextDue). Side effects at the edges.
- Errors: typed AppError (code, httpStatus, message key). Never leak stack traces to clients.
- Logging: pino, structured, include requestId / jobId / workOrderId. Never log secrets or full phone numbers.
- Naming: files kebab-case, types PascalCase, queue/job names kebab-case constants from packages/queue.
- Conventional commits. One concern per PR.
- Comments explain why. Persian user-facing text only in messages/fa.json (and en.json), never inline.
