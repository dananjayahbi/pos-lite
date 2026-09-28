# REQ-05 — Req 3.2: e-commerce storefront cart/checkout UI + payment-gateway end-to-end (Visa/MC/Amex, wallets, LANKAQR, Paid→Ready)

**Severity:** P1 (client req, half-built; the payment leg is blocked) · **Type:** client-requirement gap · **Depends on:** M28-01 (checkout stock/lines), M30-01/02 (subscription+PayHere), M25 (rate card), M28-03 (pagination) · **Refs:** `website/` app, req 3.2

## Verified source state (2026-09-15)
- The **public storefront UI largely exists** in the separate `website/` app: `[tenantSlug]/cart/page.tsx`, `checkout/page.tsx` (46 lines), `product/[productId]`, `category/[categoryId]`, a `src/lib/api/` layer (products/categories/delivery/shippingQuote/shopFilters) calling the ERP public endpoints, WhatsApp buttons in Hero/Footer. So "modern catalog + responsive cart + checkout page" is **built** at the UI layer.
- The **data integrity underneath is broken**: checkout ignores `lines[]` and never decrements stock (M28-01/BUG-97) — the cart UI can place orders the ERP can't fulfill correctly.
- **Payment gateway:** the ERP's PayHere path is for **subscription billing** (M30), not storefront orders; storefront checkout is COD-only today (`createWebsiteOrder` → `paymentMethod COD`). No card/wallet/LANKAQR capture for customer orders exists. `PAYHERE_MERCHANT_SECRET` unset (M30-02) blocks even the billing leg. Card-brand coverage (Visa/MC/Amex/wallets/LANKAQR) is a PayHere-gateway concern; the ERP-side webhook contract is verified safe-rejecting (Module 30) but a successful-payment→`Paid/Ready to Dispatch` transition is unexercisable (M30-01 no subscription + M30-02 no secret).

## Fix approach
1. **Prereq:** M28-01 (checkout honors lines + reserves stock) — without it the storefront can't be trusted.
2. **Order payment:** extend `createWebsiteOrder`/checkout to support a PayHere (or chosen gateway) order flow distinct from subscription billing: create an order Payment intent, redirect/inline-gateway, IPN → order `paymentStatus:PAID` → delivery status `PLACED→(Paid/)READY_TO_DISPATCH`. This is a **new gateway integration surface** (public webhook consumer for storefront orders) — needs its own design doc if approved; flag scope.
3. **Two-way stock sync** completion (M28-01 makes site→pos work; pos→site already verified).
4. Until a gateway secret exists (INF-03), COD is the only verifiable path; card-brand bullets stay `[ ]`/blocked.

## Acceptance / gate
- Storefront cart→checkout with real lines → ERP order has matching lines + stock reserved; (with gateway) a test IPN moves the order to Paid/Ready and the storefront tracking reflects it. Req 3.2 catalog/cart/stock-sync bullets tickable; payment bullets gated on credentials.
