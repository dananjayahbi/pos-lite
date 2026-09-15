# M20-02 — Req 3.8: commission payout creation — validation contract + tenant scoping proof

**Severity:** P2 · **Module:** 20 Commissions · **QA ref:** `tests/20` (payout path blocked behind BUG-54 during live run) · **Depends on:** M01-07, INF-02

## Verified source state (2026-09-15)
- `src/app/api/store/staff/commissions/payout/route.ts` — `PayoutSchema = z.object({...})` (line 6) with `safeParse` (41) → typed 400 on malformed; role gate MANAGER/OWNER (33); records `authorizedByRole: session.user.role` (59).
- Unverified by QA live (login blockage): whether the schema rejects **empty bodies / zero-negative amounts / unknown commission ids**, whether payouts are **tenant-scoped** (cross-tenant commissionRecordId), and whether double-submit creates two payouts (double-click).

## Action
1. Read `PayoutSchema` fields at implementation time; add missing bounds (amount > 0, ids cuid, record must belong to tenant + the staff member) — extend rather than rewrite.
2. Add the three contract tests to the relocated spec: malformed → 400; cross-tenant record id → 404; concurrent double-submit → exactly one payout (or idempotent conflict) — if the last fails, a unique `(commissionRecordId, payoutBatch)` guard or transaction is the fix (XC-06 family).
3. Confirm payout decrements the pending-commission balance consistently with `CommissionRecord` state (no negative paid amounts).

## Files
- `commissions/payout/route.ts` (+ service), `tests/20` extension.

## Acceptance / gate
- Req 3.8 payout bullet ticked with live evidence; no 500s on any malformed payout payload.
