# M31-02 — OBS-51/52/55: audience PII readable by any role, broadcast-history page client-gated only, send-receipt un-gated message vector

**Severity:** P2-Major bundle · **Module:** 31 Communications · **QA pins:** `tests/31` S3 (audience access), L2/L3 (send-receipt), OBS-52 history page · **Depends on:** XC-03 (shared guard), M05-05 (same endpoints — coordinate)

## Verified source state (2026-09-15) — all hold
1. **OBS-51:** `api/customers/preview/route.ts:7-22` + `count/route.ts:7-22` — auth + tenantId only, no role gate → CASHIER/STOCK_CLERK read full audience lists (names, **phones**, totalSpend). The broadcast *send* route correctly blocks them (`:41-46`) but the *data needed to send* is readable — inconsistent.
2. **OBS-52:** `/customers/broadcast/history` is a `'use client'` page with no server-side role gate — cashier loads the shell (API 403s leave an empty/erroring UI).
3. **OBS-55:** `api/store/sales/[id]/send-receipt/route.ts:15-28` — auth + tenantId only; any role can trigger WhatsApp sends to an **arbitrary attacker-supplied `phoneNumber`** (body field, L10/L68) for tenant sales. Moot only because the provider is unconfigured (M31-01); once configured it's a message-sending vector.

## Fix approach
1. preview/count: gate on the broadcast permission (decision recorded in M05-05 — implement once, both docs reference it).
2. History page: add the server-side role check matching the API's (redirect pattern like the broadcast page itself already does).
3. send-receipt: require the same permission as POS receipt actions (`sale:view` at minimum; recommend a `sale:send_receipt`-style key or reuse `SALE.create` family); **validate the phone belongs to the sale's customer** (or an explicit override permission) so it can't be used to blast arbitrary numbers.
4. Keep CASHIER legitimate flows working (they may need to re-send a receipt for THEIR sale — scope check `sale.cashierId === session.user.id` when lacking the broader permission).

## Files
- the two audience routes (shared decision), broadcast-history page, send-receipt route + its service check.

## Acceptance / gate
- S3 updated to chosen policy (403 or masked); history page 403/redirect for cashier server-side; send-receipt: cashier on own sale 200, on arbitrary phone 403; provider-configured dispatch asserts via L2 (M31-01).
