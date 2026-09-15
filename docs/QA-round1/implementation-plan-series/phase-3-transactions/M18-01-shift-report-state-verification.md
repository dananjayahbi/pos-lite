# M18-01 — BUG-52 + req 1.4: shift-report empty state and cash over/short display — BOTH now appear implemented (verification doc)

**Severity:** P2 → likely CLOSE (re-verify live) · **Module:** 18 Shifts/Z-Report · **QA pin:** `tests/18_shifts_cash.spec.ts` F0 · **Depends on:** INF-01 (harness to re-run F0)

## Verified source state (2026-09-15) — the QA-era findings look STALE on this branch
- **BUG-52 (empty state):** `src/app/(store)/pos/shift-report/page.tsx:75-84` — `ShiftReportPageContent` reads `searchParams.get('shiftId')` and **does** render the "No shift ID provided." empty state when absent; lines 98-106 render a failure state (`error.message ?? 'Failed to load report'`) when the Z-report fetch fails. `fetchZReport` (37-45) throws with the server's `error.message` or `Failed to load Z-Report (status)` on non-OK. The QA assertion `/no shift id provided|failed to load report/i` should match **both** the missing-param and invalid-shiftId cases (invalid id → API 404 'Shift not found' per `api/store/shifts/[id]/z-report/route.ts:39-42` → error state).
- **Req 1.4 cash over/short:** the report renders Expected Cash in Drawer (202), Actual Cash Counted (207), and a signed **Difference** row with zero/over/short styling (210-217). The unchecked req bullet appears satisfied by current code.

## Why it may still have failed for QA
Their run predated this branch's page work (or hit the Suspense/loading race: `useSearchParams` in a client component under `Suspense` (57-63) — if the test asserted before hydration, text was absent). The page also needs a shift open/close path for the *populated* report (API-verified by QA already).

## Action
1. Re-run `tests/18_shifts_cash.spec.ts` F0 against current build (INF-01 harness) — if green, mark BUG-52 **CLOSED (fixed in source)** and tick req 1.4 bullets "cash over/short displayed" + "petty cash In/Out during shift" (PettyCashSection wired at 226-228) in `QA_CLIENT_REQ.md`.
2. If it still fails, capture the DOM at assertion time — likely a hydration-timing or `?shiftId=invalid` nuance (invalid id shows the *error* branch, not the no-id branch; the QA regex covers both, so a genuine miss would be a rendering bug worth a follow-up doc).
3. No code change presumptively — this doc exists so the implementation session runs the check instead of "fixing" already-fixed behavior (the C-1/C-2 lesson).

## Acceptance / gate
- F0 green → BUG-52 closed in next QA report; req 1.4 bullets ticked with evidence line.
