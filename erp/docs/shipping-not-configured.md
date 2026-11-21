# Missing rate card is not free shipping

`calculateShippingFee` returned Rs 0.00 when the tenant had no active rate card.
Every caller treated that as a real fee, so an unconfigured store silently
offered free delivery (ARGUS #292).

## Behaviour

- `RateCalcResult` now carries `configured: boolean` (false with no active
  card). `estimateWebsiteShippingFee` exposes the same flag.
- `resolveShippingChargeDecision` (`lib/delivery/shippingConfig.core.ts`)
  separates three states:
  - `not-configured`: blocked, with an operator-facing message
  - `free`: an active card whose computed fee is genuinely 0 (allowed)
  - `charged`: an active card with a positive fee
- Blocked paths:
  - `createDelivery` and fee-recomputing `updateDelivery` throw
    `SHIPPING_NOT_CONFIGURED`, mapped by the delivery routes to 409 with a clear
    message.
  - `createWebsiteOrder` throws the same sentinel; the public order route
    returns 409 "Shipping is not configured for this store. Please contact the
    store before ordering."
  - The public shipping-quote route returns 409 instead of a zero quote.
- The ERP rate preview returns `configured: false`; the Create Delivery sheet
  shows "Shipping is not configured..." and does not treat it as an estimate.
- A configured card with base/extra rates of 0 remains genuine free shipping and
  is not blocked.

## Verification

`shippingConfig.core.test.ts` covers not-configured (blocked), configured zero
(free), configured positive, and an unparseable configured fee.
