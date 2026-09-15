# M10-01 — BUG-81/82 + OBS-78: low-stock feed params unvalidated (NaN → misleading empty 200; int4 overflow → 500) and `countOnly` ignores the threshold override

**Severity:** P3 bundle (one misleading-empty is the dangerous one) · **Module:** 10 Low Stock · **QA pins:** `tests/10_low_stock_alerts.spec.ts` N1, X3, F3 · **Depends on:** XC-01

## Verified source state (2026-09-15) — all hold
`src/app/api/store/stock-control/low-stock/route.ts`:
- Line 52: `parseInt(thresholdParam, 10)` — `?threshold=abc` → `NaN`; guard at 74/97/110 is `threshold != null` and **`NaN != null` is true** → NaN interpolated into raw SQL (`${threshold}` at 79/106/112) → `qty <= NaN` false for every row → **200 `{data:[], total:0}`** — a dashboard reads "everything stocked" from a malformed request (BUG-81).
- `threshold=2147483648`+ → int4 overflow in the SQL expression → **500** (BUG-82; `2147483647` works).
- **OBS-78:** `countOnly` block (54-71) early-returns using per-variant thresholds — the `threshold` override is silently ignored for counts (list/CSV honor it; counts don't). Pinned F3/X1.
- Also noted: this route hand-rolls `userPermissions.includes('stock:view')` (line 42) instead of the shared guard — fold into XC-03.

## Fix approach
1. **Validate `threshold`** via XC-01 int helper: non-numeric → 400; out-of-range (<0 or >int4 max) → 400. Kills BUG-81's misleading empty AND BUG-82's 500 in one guard.
2. **`countOnly` semantics:** either apply the override in the count query (one-line SQL change — recommended, makes the param honest) or document + reject `threshold` when `countOnly=true` (400 "threshold not supported with countOnly"). Pick apply-override; flip F3/X1.
3. Replace the manual permission check with the shared guard (XC-03 helper).

## Files
- `src/app/api/store/stock-control/low-stock/route.ts`, `src/lib/api/query-params.ts`.

## Acceptance / gate
- N1/X3 flip (400s); F3 flips to "countOnly+threshold applies override"; CSV/list tests unchanged; cascade L2 (LOW_STOCK_ALERT) untouched.
