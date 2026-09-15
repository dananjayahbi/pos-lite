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

## W0 execution result (2026-09-15) — **RED → ESCALATE TO FIX PLAN**
- Re-ran `tests/18_shifts_cash.spec.ts` F0 on the INF-01 harness (fresh seed): **FAILED**. The doc's "already implemented" read was stale.
- Evidence: after `page.goto('/pos/shift-report?shiftId=invalid')`, the page renders the **"Open Your Shift"** cashier screen (heading "Open Your Shift", Opening-Float input, "Start Shift"), NOT the expected "No shift ID provided." / "Failed to load report" empty/error state. So the `getByText(/no shift id provided|failed to load report/i)` assertion never matches.
- Root cause (to confirm in the fix pass): `/pos/shift-report` is under the POS route group, whose layout/page redirects a cashier with **no open shift** to the open-shift screen before `ShiftReportPageContent` renders the empty/error branch. The empty-state code exists (per this doc) but is unreachable for the F0 caller. This is a real defect, not a hydration race.
- **Status: BUG-52 stays OPEN.** This doc is upgraded from verification to a fix plan owned by **W5** (M18-01). Req 1.4 bullets are NOT ticked. Suggested fix direction: render the shift-report empty/error state independent of the open-shift redirect (e.g. guard order, or a distinct report route that doesn't bounce to open-shift), so an invalid/missing `shiftId` surfaces the documented empty/error UI.
