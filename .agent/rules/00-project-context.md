# Project context (always on)
- Domain: factory maintenance. Terms: Asset, PM Schedule, PM Template (checklist), Work Order (WO), PM/CM/PdM, MTBF, MTTR, OEE, LOTO, Downtime.
- Users: Admin, Maintenance Manager, Planner, Supervisor, Technician, Operator (request-only), Auditor (read-only).
- Technicians: gloves, noise, poor Wi-Fi, shared tablets. Managers: desktop dashboards.
- Weekend in Iran: Friday (Thursday often half-day). Work week is configurable per plant; never hardcode Mon-Fri.
- Read AGENTS.md and the relevant skill first.
- Permissions are CASL abilities built from role + plant scope; subjects are domain entity names matching Drizzle schema models.
