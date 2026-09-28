# M25-01 — BUG-62: city-level zone override unreachable — Postgres NULLS-FIRST ordering lets district-only rows win

**Severity:** P1-Critical (silent financial mispricing at checkout) · **Module:** 25 Rate Cards · **QA pin:** `tests/25_rate_cards.spec.ts` F10 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/lib/services/rate-engine.service.ts:72` — override `findFirst` with `orderBy: [{ destinationCityId: 'desc' }, { destinationDistrictId: 'desc' }]`, and the `OR` filter (62-70) deliberately includes card-default rows (both ids null).
- PostgreSQL `ORDER BY x DESC` puts **NULLs first** → a district-only row (`destinationCityId: null`) always sorts ahead of the exact city match → city rates never selected. QA measured: city override 900 stored, quote returned 725 (district math). The precedence comment at `:53` (city > district > card default) is not enforced.

## Fix approach
1. Prisma supports per-field nulls ordering: `orderBy: [{ destinationCityId: { sort: 'desc', nulls: 'last' } }, { destinationDistrictId: { sort: 'desc', nulls: 'last' } }]` — city rows sort first, then district rows, then all-null defaults. Verify Prisma 6 emits `NULLS LAST` (it does for `nulls` on orderBy since 4.x — confirm in generated SQL during implementation).
2. **Better (explicit, testable):** replace the single findFirst with a 3-step precedence query in the service: (a) city+district exact match, (b) district-only match, (c) card default — each a simple `findFirst` with full `where`. Deterministic, no NULL-ordering subtleties, trivially unit-tested. Recommend this.
3. Keep the rate-preview ↔ public shipping-quote parity assertion (QA F13/L2) as the regression net.

## Files
- `src/lib/services/rate-engine.service.ts` (+ Vitest for precedence).

## Acceptance / gate
- `tests/25` F10 flips: city override 900 quoted for city match; district still applies for other districts; default still falls back; F13/L2 parity green.
