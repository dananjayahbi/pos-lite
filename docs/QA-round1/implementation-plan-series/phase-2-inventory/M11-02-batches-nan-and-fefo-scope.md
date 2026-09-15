# M11-02 — BUG-84: batches list NaN page/limit → 500, + OBS-83 batch permanence / no FEFO consumption (scope decision)

**Severity:** P3 (BUG-84) + P2-scope-decision (OBS-83) · **Module:** 11 Batch & Expiry · **QA pins:** `tests/11_batches_expiry.spec.ts` N1, N2 · **Depends on:** XC-01

## Verified source state (2026-09-15)
**BUG-84 (holds):** `src/app/api/store/batches/route.ts:40-41` — `page = Math.max(1, Number(...))`, `limit = Math.min(100, Math.max(1, Number(...)))`; `Math.max(1, NaN)=NaN`, `Math.min(100, NaN)=NaN` → NaN into `listBatches` skip/take → Prisma throws → 500 (caught at 64-69). Unlike the low-stock route's silent fallback, batches 500s.
**OBS-83 (holds, and it's a design gap not a bug):** `prisma/schema.prisma:860-879` `model BatchTracking` has `createdAt/updatedAt` but **no `deletedAt`**; the only `batchTracking.update` in the whole service layer is `purchaseOrder.service.ts:296` (an **increment** on PO receive). `sale.service.ts` and any production path contain **no** `batchTracking`/`batchId` decrement (grep-confirmed). So batch `quantity` is a **cumulative receipt**, not live on-hand; FEFO is display-only. QA fixtures needed DB-level cleanup (no delete API).

## Fix approach
1. **BUG-84:** route page/limit through XC-01 int guards (400 on non-numeric, clamp on out-of-domain) — same fix shape as M06-02/M09-01; flip N1/N2.
2. **OBS-83 — two sub-decisions, flag for the client (do NOT silently change):**
   - **Batch consumption:** true FEFO (decrement batch.quantity on each sale/production, allocate earliest-expiry-first) is a **feature**, not a bug fix — it touches `sale.service.ts` + `production` path + `SaleLine.batchTrackings` linkage and changes reported batch semantics. Recommend a separate REQ/scope item; record that req 3.10 "batch & expiry tracking" is currently satisfied at the *visibility* level, not the *inventory-consumption* level.
   - **Batch delete/soft-delete:** batches are permanent receipts. If a delete is ever needed, add `deletedAt` + filter (consistent with other masters) — but receipts arguably shouldn't be deletable; recommend **keep permanent**, add a read-only note. No code change now.

## Files
- `src/app/api/store/batches/route.ts`, `src/lib/api/query-params.ts`; OBS-83 → decision record only (update `QA_CLIENT_REQ.md` 3.10 wording when the client rules).

## Acceptance / gate
- N1/N2 flip (400s). OBS-83: no test until the client decides on FEFO consumption; if approved it becomes its own REQ doc with a new spec section.
