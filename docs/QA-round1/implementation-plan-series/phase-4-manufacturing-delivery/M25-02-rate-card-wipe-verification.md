# M25-02 — BUG-63: double-click "Save Rate Card" wipes card values to zero — **verification doc; source now appears guarded**

**Severity:** P1 as filed → likely CLOSE · **Module:** 25 Rate Cards · **QA pin:** `tests/25_rate_cards.spec.ts` R3 · **Depends on:** INF-01

## Verified source state (2026-09-15) — QA's mechanism appears fixed on this branch
`src/app/(store)/delivery/rate-card/RateCardPageClient.tsx`:
- Base-rate form renders only **after `isLoading` is false** (113-118) — cannot submit against an undefined card (the QA-era hydration race is gated).
- Zone-matrix hydration guarded by a `hydrated` ref (56-61).
- Both submit buttons `disabled={save.isPending}` / `disabled={saveEntries.isPending}` (198, 217) — TanStack-Query-driven disable, tighter than the old RHF-state pattern.
- QA's wipe mechanism (empty inputs → `z.coerce.number()` → 0) is additionally blocked by the post-load render gate.

## Action
1. Re-run R3 (double-click Save) with the INF-01 harness: expected exactly one save at the displayed values (350/50/1), card unchanged after the second click.
2. **Residual hardening while verifying (cheap, do in the same pass):** `defaultValues` are computed once from an initially-null `card` (66-77) with **no `reset()` when data arrives** — the isLoading gate currently saves it, but a `reset()` on first data (or `keepDefaultValues:false`) removes the fragility the QA run exposed. One-line change in the same file.
3. If R3 still reproduces a wipe, capture the PUT body at failure and upgrade this doc to a fix plan (likely candidate: a second form instance or the entries PUT path — note R3's original cascade affected the *base* card, not entries).

## Acceptance / gate
- R3 green → mark BUG-63 **CLOSED (fixed on web-refactor branch; verified 2026-09-15/…)** in the next QA round; keep R3 as the standing regression pin.

## W0 execution result (2026-09-15) — **RED → ESCALATE TO FIX PLAN**
- Re-ran `tests/25_rate_cards.spec.ts` R3 on the INF-01 harness (fresh seed): **FAILED — BUG-63 still reproduces.** After `saveBtn.dblclick()` the card persisted with `baseRate/extraKgRate/freeBaseWeightKg/coddCommissionPct/vatRatePct` all `"0"` (expected 350/50/1). The doc's "source appears guarded" read was WRONG: the `isLoading` render-gate + `disabled={save.isPending}` do NOT prevent the wipe.
- Confirmed mechanism (matches the doc's step-2 residual): `defaultValues` are computed once from an initially-`null` card with **no `reset()` when data arrives** — the double-click submits a form whose numeric fields are still the empty-string defaults, and `z.coerce.number()` turns `''` into 0. The `disabled={isPending}` guard is too late for a synchronous double-click.
- **Status: BUG-63 stays OPEN.** Upgraded to a fix plan owned by **W6** (M25-02). The doc's "residual hardening" is promoted from optional to **mandatory**: call `form.reset(card)` on first data arrival (or `values`/`keepDefaultValues:false`), and add a synchronous submit guard (ref, not React state) so a double-click cannot fire two PUTs. R3 remains the standing regression pin.
