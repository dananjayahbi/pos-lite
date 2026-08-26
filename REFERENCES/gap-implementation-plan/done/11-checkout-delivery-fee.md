# 11 — Wire Delivery-Fee Calculation into Website Checkout

**Module:** M3.3 — Logistics & Courier
**Severity:** High
**Status:** Partially implemented
**Related docs:** [10-multi-provider-courier](./10-multi-provider-courier.md), [14-discrepancy-categorization](./14-discrepancy-categorization.md), [15-net-profit-calculation](./15-net-profit-calculation.md)

## Issue / Current State
A delivery-fee rate engine already exists and works for ERP manual deliveries. `calculateShippingFee()` in `erp/src/lib/services/rate-engine.service.ts` derives the shipping fee from the `RateCard` / `RateCardEntry` model, and it is invoked during `createDelivery()` / `updateDelivery()` in `erp/src/lib/services/delivery.service.ts`. This path is fully functional.

However, the customer-facing website checkout is not wired into this engine. When a web order is created, `createWebsiteOrder()` in `erp/src/lib/services/order.service.ts` does not call the rate engine, leaving `Delivery.shippingFee` null on the generated delivery record. On the website side, `placeOrder` in `website/src/lib/api/delivery.ts` posts only `{codAmount, itemCount}` to the server — it does not send the destination district/city or item weight needed to price delivery. As a result, the checkout UI (`website/src/components/website/checkout/CheckoutForm.tsx`) does not display a delivery charge, customers are never shown a shipping cost before paying, and the ERP delivery record carries no fee.

## Impact
- Delivery fees are effectively invisible to web customers, so the business collects no shipping revenue and cannot recover courier costs on website orders.
- `Delivery.shippingFee` being null on web-originated orders cascades into reconciliation and net-profit calculations (see docs 15, 16), where gross vs. net comparisons become inaccurate or impossible for those orders.
- Checkout transparency is missing: customers approve a total that excludes a fee that will later be charged, creating disputed charges and a poor trust experience.
- The existing, already-built rate engine is being bypassed, leaving an entire revenue path unconfigured.

## Implementation Plan

### Step 1 — Surface the shipping inputs needed for pricing
Extend the website checkout data flow so the destination district/city and the estimated order weight are available at order-creation time. On the website, ensure the shipping address fields (district/city) collected in `CheckoutForm.tsx` are included in the `placeOrder` payload in `website/src/lib/api/delivery.ts`. Add the necessary fields to the website order/checkout type definitions so weight (derived from line-item quantities and product weights) and destination can be carried to the server.

### Step 2 — Compute the fee during website order creation
Modify the ERP order-creation service so that when a website order is created, the destination district/city and total weight are resolved and passed to the existing rate engine. Call `calculateShippingFee()` from `rate-engine.service.ts` inside `createWebsiteOrder()` in `erp/src/lib/services/order.service.ts`, looking up the applicable `RateCard`/`RateCardEntry` for the destination. Store the returned fee onto the `Delivery.shippingFee` field at the moment the delivery record is created, and include the fee in the order total computations.

### Step 3 — Expose and display the fee in checkout
Update the ERP checkout/order API response so the computed delivery fee is returned to the website. On the website, display the fee as a line item in `CheckoutForm.tsx` and add it to the displayed order total before the customer confirms payment. Ensure the displayed amount matches exactly what is stored on the ERP delivery record so there is no discrepancy at reconciliation time.

### Step 4 — Reuse the shared pricing path (no duplication)
Keep fee calculation centralized in `rate-engine.service.ts` and reuse it from both the ERP manual delivery flow (`delivery.service.ts`) and the website-order flow (`order.service.ts`). Do not duplicate pricing logic in the website or in the API layer; the website should only consume the computed value returned by the ERP. This keeps a single source of truth for delivery pricing.

## Dependencies
- Relies on the existing, working rate engine in `rate-engine.service.ts` and the `RateCard` / `RateCardEntry` configuration.
- Depends on the ERP manual delivery wiring (`delivery.service.ts`) as the reference implementation to mirror.
- Feeds into docs 15 (net profit) and 16 (financial audit), which depend on a populated `Delivery.shippingFee`.

## Files / Areas affected
- `erp/src/lib/services/rate-engine.service.ts` (reuse `calculateShippingFee`)
- `erp/src/lib/services/order.service.ts` (wire fee into `createWebsiteOrder`)
- `erp/src/lib/services/delivery.service.ts` (reference implementation)
- `website/src/lib/api/delivery.ts` (add destination/weight to `placeOrder`)
- `website/src/components/website/checkout/CheckoutForm.tsx` (display fee line item)
- Website and ERP checkout/order type definitions for the new shipping fields
