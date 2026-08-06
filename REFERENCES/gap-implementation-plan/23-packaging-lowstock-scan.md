# 23 — Scheduled Packaging Low-Stock Scan

**Module:** M7 — Office Packaging Inventory
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [22-packaging-size-dimension](./22-packaging-size-dimension.md)

## Issue / Current State
Low-stock awareness for packaging is only triggered reactively. The `notifyLowStock()` function in `erp/src/lib/services/packaging.service.ts` creates `PACKAGING_LOW_STOCK` `NotificationRecord` entries, but it is invoked only during the dispatch/deduction flow and only evaluates items that were part of that deduction plus auto-deduct items already at or below `lowStockThreshold`. Packaging items that sit idle in inventory and drift below threshold are never flagged until the next dispatch.

The cron directory `erp/src/app/api/cron/` contains several scheduled jobs (e.g., `birthday-greetings/`, `check-subscriptions/`, `payment-reminders/`, `daily-summary/`) but no packaging job. Each existing job follows the same secured pattern: a `GET` handler guarded by a `CRON_SECRET` bearer check.

## Impact
The office can run out of shipping materials without any advance notice because low stock is only surfaced at the moment of dispatch. That leads to last-minute shortages, delivery delays, rushed purchases, and no systematic reordering cadence. Because only auto-deduct items are scanned, manually-consumed packaging is effectively invisible to alerts.

## Implementation Plan
### Step 1 — Add a scheduled cron job
Create a new cron route under `erp/src/app/api/cron/` (e.g., `packaging-low-stock/route.ts`) following the existing cron pattern: a `GET` handler validating the `CRON_SECRET` bearer token exactly like `check-subscriptions/route.ts`, returning unauthorized otherwise.

### Step 2 — Add a scan-all low-stock service function
Add a service function (in `packaging.service.ts`, near `notifyLowStock`) that, per tenant, scans **all** non-deleted `PackagingItem` records and selects those where `quantityOnHand <= lowStockThreshold`. Optionally support a per-item flag or per-tenant toggle to include manually-consumed items. Group findings by tenant and collect the affected item names and quantities.

### Step 3 — Emit notifications
Reuse the notification pattern: create `PACKAGING_LOW_STOCK` `NotificationRecord`s for recipients with roles `OWNER`, `MANAGER`, and `DISPATCH_STAFF` (mirroring `notifyLowStock`'s recipient selection). Because a scan job runs across tenants, ensure `tenantId` is set correctly per recipient group and `relatedEntityType`/`relatedEntityId` are meaningful (e.g., no delivery, so omit or use a packaging-related entity). Keep the emission non-blocking and wrapped so a failure logs a warning and does not abort other tenants.

### Step 4 — Register the schedule
Configure the schedule in the deployment/cron configuration (`erp/vercel.json` currently holds only `{"framework":"nextjs"}`, so the cron schedule would be added there or to the platform's cron config used by the other jobs). Choose an appropriate cadence (e.g., daily) consistent with existing jobs.

### Step 5 — (Optional) De-duplicate notifications
Consider suppressing repeated notifications for the same item until it is restocked, so the owner is not alerted daily for a stock item that cannot be replenished immediately. This could be a simple cooldown based on last notified time or by only alerting when stock changes.

## Dependencies
- [22-packaging-size-dimension](./22-packaging-size-dimension.md) — optional; per-size awareness makes scan results clearer but is not required.
- Existing cron infrastructure and `CRON_SECRET` auth pattern in `erp/src/app/api/cron/`.
- Existing `notifyLowStock` recipient logic as a reference.

## Files / Areas affected
- New cron route `erp/src/app/api/cron/packaging-low-stock/route.ts` (or similar).
- `erp/src/lib/services/packaging.service.ts` — scan-all low-stock function.
- `erp/vercel.json` (or platform cron config) — schedule registration.
- Notification recipient role list shared with `notifyLowStock`.
