# M01-03 — BUG-18: concurrent forgot-password requests mint multiple simultaneously-live tokens

**Severity:** P2-Major (defense-in-depth; leak surface scales with load) · **Module:** 01 Auth · **QA pin:** `tests/01_auth.spec.ts` 5.5 (load-sensitive: reproduced under full-suite load, not isolated) · **Depends on:** nothing (sequence with M01-01/M01-02 — same route)

## Verified source state (2026-09-15) — still holds
`src/app/api/auth/forgot-password/route.ts`: `deleteMany` for the identifier (lines ~57–61) then a **separate awaited `create`** (~66–72) — not wrapped in `$transaction` (contrast: `reset-password/route.ts:86-95` *does* use a transaction). Two simultaneous requests both observe zero rows and both insert → one identifier holds **two live 1-h tokens** (QA observed count=2 after a 2-request burst). Every copy is independently usable.

## Fix approach (pick one, prefer (a))
1. **(a) Transactional delete+create** around lines 57–72 (mirror the reset-password transaction pattern), plus
2. **(b) DB-level guarantee:** partial unique index on `verification_tokens(identifier)` filtered to `expires > now()` (migration; Prisma raw migration via `scripts/apply-sql-migration.mjs` pattern already used by this repo). With (b), a racing second mint gets a unique violation → map via INF-02 to a neutral success (the *older* token was just invalidated by the transaction, or on conflict re-run delete+create once).
3. Either way: on any mint, all prior tokens for the identifier become dead — "at most one live token per identifier" is the invariant to unit-test.

## Files
- `src/app/api/auth/forgot-password/route.ts`, new migration under `prisma/migrations/` if (b).

## Acceptance / gate
- `tests/01_auth.spec.ts` 5.5: after a concurrent burst, `verification_tokens WHERE identifier=<email>` live count ≤ 1.
- Vitest: two parallel calls to the mint helper → exactly one live token, both calls return the same neutral 200.
