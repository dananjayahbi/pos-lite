# M26-02 — BUG-66: dispute sentinels unmapped → 500s (+ OBS-40 dispute audit-action reuse)

**Severity:** P2-Major · **Module:** 26 Reconciliation · **QA pins:** `tests/26_courier_reconciliation.spec.ts` F15, F18, R3, S5, X7 · **Depends on:** INF-02

## Verified source state (2026-09-15) — still holds
- `src/lib/services/reconciliation-dispute.service.ts` throws sentinels: `LEDGER_ENTRY_NOT_FOUND` (:34), `ALREADY_DISPUTED` (:35), `DISPUTE_NOT_FOUND` (:87).
- `mapDeliveryError` (`src/lib/api/delivery-route.ts:96-114`) has branches for delivery/shipment/packaging/dispatchable/courier codes but **none of these three** → every dispute route catch falls through to `internalError()` → **500** on routine client errors (unknown id, double-dispute, cross-tenant id). Five independent QA pins hit it.
- **OBS-40:** dispute open/update/resolved all reuse `AUDIT_ACTIONS.RECONCILIATION_IMPORTED` — the ledger can't distinguish the three operations by action code.

## Fix approach
1. Register the three sentinels in INF-02's service-error map: `LEDGER_ENTRY_NOT_FOUND`/`DISPUTE_NOT_FOUND` → 404 (typed code echoed), `ALREADY_DISPUTED` → 409 CONFLICT. (Same edit surface as M24-01's `DELIVERY_PAYMENT_NOT_SETTLED` addition — do them together.)
2. Add distinct audit actions `RECONCILIATION_DISPUTE_OPENED` / `_UPDATED` / `_RESOLVED` (or one `DISPUTE_CHANGED` with action-detail) in `audit.service.ts` and use them in the dispute service.

## Files
- `src/lib/api/delivery-route.ts` / map-service-error, `reconciliation-dispute.service.ts`, `audit.service.ts`.

## Acceptance / gate
- `tests/26` F15/F18/R3/S5/X7 flip to 404/409; audit rows distinguish dispute operations (L-series extension).
