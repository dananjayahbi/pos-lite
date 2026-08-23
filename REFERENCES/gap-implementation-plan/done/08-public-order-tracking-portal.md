# 08 — Public Order Tracking Portal

**Module:** M2.2 — Order Tracking
**Severity:** High
**Status:** Not implemented
**Related docs:** [09](./09-customer-delivery-status.md), [07](./07-online-payment-gateway.md)

## Issue / Current State

There is no public order-tracking portal. The public API surface under `erp/src/app/api/public/site/[tenantSlug]/` currently exposes only `brands`, `categories`, `config`, `orders`, `products`, and `tenant`; the `orders` route is POST-only (creation), so customers have no read path to their order.

A delivery-status pipeline exists internally — staff-facing, driven by `erp/src/lib/services/tracking.service.ts` and populated by the `sync-shipments` cron job — but it is not exposed to customers. There is no `/[tenantSlug]/track` page or lookup component in `website/`.

## Impact

- Customers must phone or message the business to learn where their order is, generating support load and frustration.
- No self-serve tracking increases inbound support cost and erodes trust, especially as online payments (07) grow order volume.
- The existing internal tracking investment is under-utilized because it is invisible to the buyer.

## Implementation Plan

### Step 1 — Add a public lookup endpoint
Add a read-only lookup route under the public API (for example, `erp/src/app/api/public/site/[tenantSlug]/track/route.ts`). Accept a lookup key — the order reference or the customer phone number (optionally combined with a delivery postcode or order ref for privacy) — and return a summary of the matching order(s) and their current delivery state. Guard against exposing sensitive data by returning only customer-safe fields and by rate-limiting the endpoint.

### Step 2 — Build the tracking service read path
Add a read-focused function (in `erp/src/lib/services/tracking.service.ts` or a new public-facing tracking service) that joins the order, shipment, and delivery events into a clean, public-facing shape. Reuse the existing `DeliveryStatus`/`DeliveryEvent` data already produced by the internal pipeline.

### Step 3 — Create the tracking page on the website
Add a `/[tenantSlug]/track` page in `website/src/app/` with a lookup form (order ref or phone) and a results component that renders the returned order summary and delivery timeline. Place the lookup link in the site footer and header (`website/src/components/website/sections/WebsiteFooter.tsx` and `WebsiteHeader.tsx`) for discoverability.

### Step 4 — Wire to checkout confirmation
Link the post-checkout confirmation screen (and email, where applicable) to the tracking page so customers can follow their order from the moment of purchase.

## Dependencies
- [09](./09-customer-delivery-status.md) defines the customer-facing status wording and timeline rendering.
- [07](./07-online-payment-gateway.md) provides payment state that the portal may display.

## Files / Areas affected
- New route `erp/src/app/api/public/site/[tenantSlug]/track/route.ts`
- `erp/src/lib/services/tracking.service.ts` (public read path)
- New page `website/src/app/[tenantSlug]/track/`
- New tracking components under `website/src/components/website/tracking/` (or similar)
- `website/src/components/website/sections/WebsiteHeader.tsx` and `WebsiteFooter.tsx` (lookup link)
- `website/src/components/website/checkout/CheckoutForm.tsx` (confirmation link)
