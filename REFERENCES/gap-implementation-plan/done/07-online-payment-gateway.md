# 07 — Online Payment Gateway for Customer Orders

**Module:** M2.1 — Online Payments
**Severity:** High
**Status:** Not implemented
**Related docs:** [08](./08-public-order-tracking-portal.md), [09](./09-customer-delivery-status.md)

## Issue / Current State

Customer checkout is cash-on-delivery only. The checkout form, `website/src/components/website/checkout/CheckoutForm.tsx`, renders a single "Place order (COD)" action and posts only `{ codAmount, itemCount }` to the public orders API.

The public orders route, `erp/src/app/api/public/site/[tenantSlug]/orders/route.ts`, accepts COD-style payloads only and has no payment-method or payment-status handling. There is no card payment or integration with the PayHere gateway, even though PayHere is already used elsewhere in the ERP for subscription billing.

## Impact

- COD-only checkout is a major barrier for customers who prefer to pay by card, and carries fraud/non-delivery risk and cash-handling overhead for the business.
- Competitors offer card payments; its absence directly suppresses online conversion.
- No payment status lifecycle means orders cannot distinguish paid vs. pending, blocking clean reconciliation with the accounting/courier pipelines.

## Implementation Plan

### Step 1 — Define payment fields on the order model
Extend the order-related schema in `erp/prisma/schema.prisma` with a payment method and payment status (for example, COD vs. CARD, and PENDING / PAID / FAILED / REFUNDED). Add fields to capture the payment reference/token so the order links back to the gateway transaction. Migrate and backfill existing COD orders appropriately.

### Step 2 — Add a payment method selector to checkout
Extend `website/src/components/website/checkout/CheckoutForm.tsx` with a payment-method selector (COD or card). For the card path, integrate the PayHere client flow (matching the pattern already used for subscription billing) so the customer enters card details and the gateway returns a transaction token.

### Step 3 — Extend the public orders API
Update `erp/src/app/api/public/site/[tenantSlug]/orders/route.ts` to accept the payment method and, for card orders, the PayHere token. Create the order and register the payment intent. Add a callback/return route (or reuse the gateway's server-side notification mechanism) that updates the order's payment status on success or failure, using a service in `erp/src/lib/services/` (for example, an extension of the payment/order services) to keep gateway logic out of the route handler.

### Step 4 — Handle payment status in the order lifecycle
Ensure downstream order fulfilment (dispatch, courier submission) treats unpaid card orders as pending until payment confirmation, and COD orders as unpaid-by-design. Wire the payment status into the reconciliation/accounting flow so settled payments reconcile cleanly.

### Step 5 — Present status to customers
Expose a customer-visible indication of payment state (for example, on the confirmation screen and, once it exists, the tracking portal of 08).

## Dependencies
- [08](./08-public-order-tracking-portal.md) and [09](./09-customer-delivery-status.md) surface order/payment state to customers.

## Files / Areas affected
- `erp/prisma/schema.prisma` (payment fields on order model)
- New migration under `erp/prisma/migrations/`
- `erp/src/lib/services/order.service.ts` and `erp/src/lib/services/payment.service.ts`
- `erp/src/app/api/public/site/[tenantSlug]/orders/route.ts`
- New payment callback route under `erp/src/app/api/`
- `website/src/components/website/checkout/CheckoutForm.tsx`
- `website/src/lib/api/` (checkout data layer)
