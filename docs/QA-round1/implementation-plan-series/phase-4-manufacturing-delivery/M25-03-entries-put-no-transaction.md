# M25-03 — BUG-64: concurrent zone-override saves blend matrices (delete+create not in a transaction)

**Severity:** P2-Major · **Module:** 25 Rate Cards · **QA pin:** `tests/25_rate_cards.spec.ts` R2 · **Depends on:** XC-06 (race family)

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/delivery/ratecard/entries/route.ts:37-68` — PUT does `deleteMany` (by `notIn` payload ids, or all) then a `for` loop of `update`/`create` calls — **all as separate top-level `prisma.*` calls, NOT wrapped in `$transaction`**.
- Two concurrent PUTs interleave: both delete, both create → final matrix is a **blend of both payloads** (QA observed `[district 6, district 5]` where each writer sent exactly one). Each writer reported success; the persisted state matches neither save → silent zone mispricing.

## Fix approach
1. Wrap the whole delete+update+create sequence in `prisma.$transaction([...])` (array form is fine — independent ops, one commit) so each PUT is atomic.
2. Serialize writers on the card row: `SELECT … FOR UPDATE` the parent RateCard at transaction start (or a Postgres advisory lock keyed by `cardId`) so two concurrent PUTs queue rather than interleave → last-write-wins holds.
3. Response should reflect the final committed matrix (or the loser gets a 409 "concurrent save" — recommend queue+success via the lock, matching user expectation of "my save applied").

## Files
- `src/app/api/store/delivery/ratecard/entries/route.ts`.

## Acceptance / gate
- `tests/25` R2 flips: two concurrent entries PUTs → final matrix equals exactly one writer's payload; no blend; both 200 (locked) or one 409 (rejected) — whichever contract is chosen, pinned.
