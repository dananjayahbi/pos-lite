# M26-01 — BUG-65: statement→match→settle reconciliation engine unreachable (ledger permanently empty) — upstream gate

**Severity:** P1-Critical (req 3.7 end-to-end unverifiable) · **Module:** 26 Reconciliation · **QA pins:** `tests/26_courier_reconciliation.spec.ts` F8, L1 (gate pins that flip-fail on unblock by design) · **Depends on:** M24-01 (courier auth) · **Blocks:** REQ-08

## Verified source state (2026-09-15) — holds exactly as QA described
- `src/lib/services/tracking.service.ts:100-113` — the **only** creator of `ReconciliationLedgerEntry` is an upsert that runs **only when a delivery maps to `DELIVERED`** (status `PENDING_SETTLEMENT`).
- Dispatch fails at courier auth (M24-01/BUG-60) → no `CourierShipment` → no delivery reaches DELIVERED → ledger permanently empty (live DB: 0 entries, 0 shipments, 0 disputes, 0 DELIVERED). Import→match→settle has nothing to operate on; only surface contracts (CSV import bookkeeping, dispute validation) are testable.

## Action (this is a dependency, not an independent fix)
1. **No code fix here** — this doc exists so the roadmap schedules it correctly: it **auto-resolves when M24-01 lands with valid Trans Express sandbox credentials** (INF-03). Until then req 3.7 stays ⚠️ BLOCKED.
2. **Pre-build the test data path so the engine is verifiable the moment dispatch works:** a sandbox flow that drives a delivery PENDING_DISPATCH → DISPATCHED → (courier marks) DELIVERED → assert a `PENDING_SETTLEMENT` ledger row appears with waybill/orderRef/barcode keys; then import a matching remittance CSV → assert `matchedCount>0`, deduction audit (±0.01 COMPLIANT), and the pending-COD aging/RED row (REQ-08).
3. Keep F8/L1 gate pins in place: they are *designed to fail* when the ledger is no longer empty, signalling the full matching suite must be extended — do not delete them; convert them.

## Acceptance / gate
- Post-M24-01: F8/L1 upgraded to populated-ledger assertions and green; req 3.7 bullets 2–3 (auto-reconciliation, deduction validation) ticked with evidence.
