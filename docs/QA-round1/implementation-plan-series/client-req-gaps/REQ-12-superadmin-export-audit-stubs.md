# REQ-12 — Superadmin "Export Data" / per-tenant "Audit Log" buttons are toast stubs ("Coming in Phase 5 / Coming soon")

**Severity:** P3 (promised-but-stubbed actions) · **Type:** client-req gap · **Depends on:** M08-03 (SUPER_ADMIN audit API), XC-01 (CSV writer via M35-01)

## Verified source state (2026-09-15)
- OBS-15: on the tenant detail page, the "Export Data" and "Audit Log" admin-action buttons fire toasts ('Coming in Phase 5' / 'Coming soon') — no data export or per-tenant audit view exists (Module 08 verified the rest of the page). QA found **no client-req checklist bullets** for superadmin features (coverage came from SRS/roadmap), so this is a product-promise closure item, not a req tick.

## Fix approach
1. **Per-tenant audit view:** link/button → filter the existing `/settings/audit-log` table by `tenantId` (SUPER_ADMIN path unblocked by M08-03's cross-tenant audit view) — mostly wiring, not new build.
2. **Export Data:** define scope with the client — likely a tenant-scoped CSV/JSON bundle (products, customers, sales summary, movements) via the shared CSV writer; recommend a **job-based export** (async + download link) rather than synchronous zip for large tenants; minimum viable: CSVs of the top 5 entities, owner-triggered, audit-logged (`TENANT_DATA_EXPORTED`).
3. Until built, hide the buttons (dead-affordance removal beats a "coming soon" toast in a paid product) — decision logged.

## Acceptance / gate
- Tenant audit button reaches a filtered audit view (200 + rows); export produces a downloadable file with tenant-scoped content + audit row; or both buttons removed with client sign-off.
