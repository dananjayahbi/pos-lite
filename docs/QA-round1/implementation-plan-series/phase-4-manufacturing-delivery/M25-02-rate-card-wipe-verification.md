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
