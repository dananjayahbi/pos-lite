# VelvetPOS Implementation Backlog

> Living audit log for missing pages, incomplete frontend wiring, and system completion tasks.
>
> Rule: append new tasks as gaps are discovered; do not regenerate this document from scratch.

## Audit Log

### Audit Wave 01 — Core store operations

- [x] Create a dedicated sales management page at `/sales` to expose `src/app/api/store/sales/route.ts` outside the POS-only history view.
- [x] Create a dedicated returns management page at `/returns` so `src/app/api/store/returns/route.ts` is available outside `/pos/returns`.
- [x] Build a shifts management page to surface open/closed shifts, closing workflows, and reports from `src/app/api/store/shifts/**`.
- [x] Build a dedicated timeclock page for attendance history and clock events using `src/app/api/store/timeclock/**` beyond the current widget/tab-only access.
- [x] Remove or repurpose the orphaned legacy directory `src/app/(store)/stock/stock-take/` so stock-take navigation is not duplicated/confusing.
- [x] Review and complete product detail editing workflows in `src/app/(store)/inventory/[productId]/page.tsx` and related variant editing components.
- [x] Review promotions creation/editing UX to determine whether inline dialogs are enough or whether a dedicated full-page workflow is needed.
- [x] Review purchase-order receiving UX and decide whether the current modal flow should become a dedicated receiving page.
- [x] Wire `src/app/api/store/stock-control/summary/route.ts` into owner-facing UI cards or dashboards.
- [x] Wire `src/app/api/store/stock-control/recent-movements/route.ts` into owner-facing stock/audit views.
- [x] Wire `src/app/api/store/stock-control/actors/route.ts` into stock adjustment/history UI so owners can see who changed stock.
- [x] Add customer CSV import UI to expose `src/app/api/store/customers/import/route.ts` from the customers area.

### Audit Wave 02 — CRM, reports, notifications, settings, billing, integrations

- [x] Replace the placeholder notifications page with a full notification inbox using `src/app/api/notifications/**`, including unread/read actions.
- [x] Create a staff shifts hub at `src/app/(store)/staff/shifts/page.tsx` backed by `src/app/api/store/shifts/route.ts` filters and list data.
- [x] Create a shift detail experience using `src/app/api/store/shifts/[id]/route.ts`, `z-report`, and `cash-movements` endpoints.
- [x] Build a store profile settings page in `src/app/(store)/settings/store/` and add any missing backend needed for store-level profile/config management.
- [x] Build a tax rules/settings page in `src/app/(store)/settings/taxes/` plus any missing backend/schema work needed for configurable tax management.
- [x] Build a users/permissions settings page in `src/app/(store)/settings/users/` for role assignment and fine-grained permissions management.
- [x] Add webhook delivery history and retry/testing UX to complement the existing webhook endpoint management UI.
- [x] Add commission payout history/proof/receipt tracking to complete the commissions workflow after payout.
- [ ] Create a unified saved reports page (for example `src/app/(store)/reports/saved/page.tsx`) to manage saved report presets outside individual report screens.
- [ ] Review audit log filters/export UX and ensure the frontend fully exposes the backend filtering capabilities.
- [ ] Add billing/payment-method management UI if the intended billing scope includes card/payment method updates beyond subscription cancelation.
- [ ] Add broadcast delivery analytics/tracking so customer broadcast sends can be monitored after submission.
- [ ] Verify hardware test actions provide clear loading and success/failure feedback and close any remaining UX gaps.

### Audit Wave 03 — Placeholder directories and cross-cutting completion gaps

- [x] Create a dedicated sales list page at `src/app/(store)/sales/page.tsx` and a sale detail page under `src/app/(store)/sales/[saleId]/`.
- [x] Build a standalone owner-facing timeclock/attendance page instead of relying only on the shared widget and per-staff tab.
- [x] Complete CSV export for commissions from `src/app/(store)/staff/commissions/page.tsx` where it currently surfaces a coming-soon toast.
- [x] Add an account/session settings area for signed-in users to manage password/session-related preferences.
- [x] Build the superadmin billing dashboard in `src/app/(superadmin)/superadmin/billing/`.
- [x] Review all remaining `.gitkeep` placeholder directories under `src/app` and either implement the intended page or remove the placeholder path from the architecture.

