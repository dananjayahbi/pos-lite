# XC-06 — DB unique constraints + race-hardening sweep: close the "concurrent create/write → 500 or silent duplicate" family

**Severity:** P1 (data integrity spine) · **Type:** cross-cutting · **Depends on:** INF-02 (P2002→409), XC-05 (recreate policy) · **Members:** BUG-8 (M03-06), BUG-27 (M05-03), BUG-30/31 (M06-01), BUG-39 (M08-05), BUG-48 (M16-01), BUG-64 (M25-03), BUG-92 (M27-06), BUG-98 (M28-02), BUG-18 (M01-03)

## Verified source state (2026-09-15) — the pattern repeats across the app
Two failure shapes recur:
1. **Missing DB constraint** → concurrent writes silently create duplicates: Customer `(tenantId,phone)` has only `@@index` not `@@unique` (BUG-27 → 3×201); Supplier has no unique at all (BUG-30/31); Appointment has no overlap exclusion (BUG-92 → 3×201 same slot); Delivery `orderRef` non-unique (BUG-98 → 3×same ref); VerificationToken no partial-unique-live index (BUG-18 → 2 live tokens).
2. **Constraint exists but race-check is non-atomic** → the loser hits the DB and the route 500s instead of 409: Staff email (BUG-8 — `@unique` exists, P2002 unmapped); plan name (BUG-39 — `@unique`, empty-body 500); category/brand name (BUG-21 leak half); PO receive over-check (BUG-48 — transaction but no row lock); rate-card entries replace (BUG-64 — no transaction at all).

## Fix approach (systematic, one pass per entity)
1. **Constraint audit table** (the deliverable): for every "logically unique" field, confirm a DB-level `@@unique` (tenant-scoped, and per XC-05 either including or explicitly excluding soft-deleted rows via a partial index). Add the missing ones: `Customer@@unique([tenantId,phone])` (partial `WHERE deletedAt IS NULL`), `Supplier@@unique([tenantId,phone])` (+ name per client decision M06-01), `Delivery@@unique([tenantId,orderRef])`, `VerificationToken` partial-unique-live (M01-03), appointment overlap via `btree_gist` EXCLUDE (M27-06). Each add requires a pre-migration duplicate-detection + a documented dedupe step (never auto-delete real data — customer/supplier dupes may exist from QA runs).
2. **Atomic check-then-insert → insert-and-map:** standardize on "attempt the write inside the transaction; map `P2002`→409 via INF-02" (drop racy service pre-checks as the *guarantee*, keep them only as fast-path friendly messages). This is the fix for BUG-8/39 and the pattern for all new unique fields.
3. **Row-locking for read-modify-write** (stock, fund balance, PO receive, rate-card entries, orderRef counter): `SELECT … FOR UPDATE` or `updateMany` with a guard predicate (`stockQuantity >= delta`) so concurrent writers serialize correctly. BUG-41/53/64/48/98 all reduce to this.
4. **Idempotency keys** on the highest-double-click-risk writes (PO receive, GRN, checkout, rate-card save): accept an optional client key, return the original result on replay.
5. Provide the shared primitives in `src/lib/api/` (a `withUniqueGuard(fn)` wrapper + a `lockingTx` helper) so module docs reference them instead of each re-inventing.

## Files
- `prisma/schema.prisma` + several migrations (one per constraint, with dedupe pre-steps), the routes/services named in each member doc, `src/lib/api/` lock/idempotency helpers.

## Acceptance / gate
- Every member pin (tests/03 5.1, tests/05 R2, tests/06 R2/B2, tests/08 ensurePlan, tests/16 concurrent, tests/25 R2, tests/27 R2, tests/28 R1, tests/01 5.5) flips to "exactly one winner, losers typed 4xx, zero 500s, zero duplicate rows". A concurrency smoke test (Vitest with Promise.all against a test DB) per constraint.
