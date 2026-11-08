# Security
- Auth required on every route except login/health. Cookies: httpOnly, secure, sameSite=lax.
- Authorization via CASL abilities enforced in services (and Drizzle DB queries via `accessibleWhere`), not only UI. Deny by default. Check abilities, not roles. See skill rbac-audit-safety.
- Rate-limit login and public endpoints. CSRF protection for cookie-auth mutations.
- Secrets only via env/secret store. .env.example committed, .env never.
- Uploads: size/type limits, random filenames, stored outside web root.
- QR codes encode an opaque token (not DB id) and always require login to show data.
- Bull Board and Redis never public; Redis requires password and internal network only.
- Pin dependency versions; avoid releases younger than ~2 weeks; run pnpm audit in CI.
