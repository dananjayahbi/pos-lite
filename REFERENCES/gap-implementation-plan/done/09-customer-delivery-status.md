# 09 — Customer-Facing Delivery Status

**Module:** M2.2 — Order Tracking
**Severity:** High
**Status:** Partially implemented
**Related docs:** [08](./08-public-order-tracking-portal.md), [10](./10-multi-provider-courier.md)

## Issue / Current State

The delivery-status machinery exists entirely on the internal, staff-facing side. The `DeliveryStatus` enum and `DeliveryEvent` model are defined in `erp/prisma/schema.prisma`, the status pipeline runs through `erp/src/lib/services/tracking.service.ts`, and the `sync-shipments` cron job (`erp/src/app/api/cron/sync-shipments/route.ts`) feeds the latest courier updates into the system. The `CarrierProvider` enum currently supports `TRANSEXPRESS` only.

However, none of this is visible to customers. The internal statuses are courier/operational terms (for example, `PENDING_DISPATCH`, `HOLD`, `OUT_FOR_DELIVERY`, `FAILED`, `RETURNED`) that are not exposed through any public endpoint or rendered on any customer-facing page. There is no timeline view of `DeliveryEvent`s for the buyer, and no mapping of internal statuses to customer-friendly wording.

## Impact

- The business already knows the delivery state but cannot communicate it to the buyer, so the value of the tracking investment is unrealized.
- Couriers/operational status names confuse customers if shown raw; without a friendly mapping, customers cannot understand progress.
- Without a public timeline, support staff manually relay status, adding cost and delay.

## Implementation Plan

### Step 1 — Define a customer-facing status mapping
Add a mapping layer that translates internal `DeliveryStatus` values and `DeliveryEvent` states into customer-friendly, localized wording and ordered timeline stages (for example, "Order confirmed", "Preparing", "Shipped", "Out for delivery", "Delivered", with failure/return shown clearly). This mapping lives in the public tracking read path (see 08) so the website never handles raw enum values. Localization should hook into the i18n work in 06 where possible.

### Step 2 — Expose a read-only timeline in the public API
Extend the public tracking route from 08 to return an ordered, deduplicated timeline of `DeliveryEvent`s (timestamped, with the mapped stage and friendly label). Return only customer-safe event data and the current overall status.

### Step 3 — Render the status timeline on the tracking page
Build a timeline component for the `/[tenantSlug]/track` page (08) that renders each stage with its timestamp, highlights the current stage, and shows delivery status updates and any failure/return reason in the friendly wording. Keep it as a reusable component under `website/src/components/website/tracking/`.

### Step 4 — Keep the internal pipeline feeding the timeline
Confirm the `sync-shipments` cron and `tracking.service.ts` continue to populate `DeliveryEvent`s for all status transitions so the customer timeline stays current. Where a courier does not report granular stages, derive the timeline from the transitions the pipeline already records.

### Step 5 — Multi-provider readiness
Ensure the status mapping and timeline components are provider-agnostic so that when additional couriers are added (10), the same timeline works without per-provider UI changes.

## Dependencies
- [08](./08-public-order-tracking-portal.md) provides the page and public endpoint this timeline renders in.
- [10](./10-multi-provider-courier.md) may add providers whose statuses must map cleanly.
- [06](./06-multilingual-i18n.md) for localized friendly wording.

## Files / Areas affected
- `erp/src/lib/services/tracking.service.ts` (public mapping/read path)
- New public tracking route from 08 (`erp/src/app/api/public/site/[tenantSlug]/track/route.ts`)
- `website/src/app/[tenantSlug]/track/` and tracking components under `website/src/components/website/tracking/`
- `website/src/lib/api/` (tracking data layer)
