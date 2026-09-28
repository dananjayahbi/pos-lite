# M11-01 — BUG-83: `expiryStatus` filter is a post-filter after pagination → `meta.total` unfiltered, page math breaks

**Severity:** P2-Major · **Module:** 11 Batch & Expiry · **QA pin:** `tests/11_batches_expiry.spec.ts` F4 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/lib/services/batchTracking.service.ts:103-160` `listBatches`: the `where` (113-127) has **no** expiry predicate; `findMany`+`count` (129-137) run against it (skip/take applied); `expiryStatus` is applied only as a **post-filter** on the mapped page: `.filter(b => expiryStatus ? b.expiryStatus === expiryStatus : true)` (159).
- `src/app/api/store/batches/route.ts:62` sets `meta.total = listResult.total` (the unfiltered count). Result: `?expiryStatus=EXPIRED` returned 1 row but `meta.total:11`; any consumer paginating loses rows and shows wrong page counts.
- Summary cards (Total/Healthy/Expiring/Expired) come from a separate aggregate, so the dashboard *looks* right while the list is wrong — the QA pin asserts the inconsistency (`meta.total === meta.totalBatches`).

## Fix approach
1. **Push the predicate into the query.** `expiryStatus` is derived (EXPIRED = past, EXPIRING_SOON = within 30d, OK = >30d/null). Compute the two boundary dates in the service and add to `where`:
   - EXPIRED → `expiryDate: { lt: now }`
   - EXPIRING_SOON → `expiryDate: { gte: now, lte: now+30d }`
   - OK → `OR: [expiryDate: null, expiryDate: { gt: now+30d }]`
   Match the exact boundary semantics the classification function uses (QA pinned +30d=EXPIRING_SOON, +31d=OK — preserve inclusive/exclusive edges).
2. `count` then uses the same `where` → `meta.total` correct; post-filter (159) becomes unnecessary — remove it.
3. Keep the summary-card aggregate as-is (it's the all-batches breakdown, independent of the filter).

## Files
- `src/lib/services/batchTracking.service.ts` (listBatches + share the boundary constants with the classifier), `batches/route.ts` if it re-filters.

## Acceptance / gate
- `tests/11` F4 flips: `data.length` consistent with `meta.total` under each expiryStatus; summary cards still match unfiltered totals; boundary rows land in the right bucket (F-series classification tests stay green).
