# M03-06 — BUG-8: concurrent staff creation returns 500 instead of 409 (unhandled `P2002`)

**Severity:** P2-Major (the double-click / "button spam" path) · **Module:** 03 RBAC/Users · **QA pin:** `tests/03_rbac_users.spec.ts` 5.1 · **Depends on:** INF-02 (shared mapper), M03-01 (same validator file, sequence to avoid churn)

## Verified source state (2026-09-15) — still holds
- `src/lib/services/staff.service.ts:168-176` `createStaffMember`: **check-then-insert** — `findUnique({where:{email}})` (173) → throw `Error('A user with this email already exists')` (175) → `create` (179+). No transaction.
- `prisma/schema.prisma:443` `email String @unique` — the DB constraint **does** exist and **held** (QA: "no duplicate rows created — this is an error-mapping defect, not a data-integrity one"). Note email is **globally** unique (cross-tenant duplicate → 409 too — QA 1.4 passes on this and is the intended contract; do NOT change scoping here).
- `src/app/api/store/staff/route.ts:94-116` POST catch maps **only** the pre-checked message via **exact equality**: `if (message === 'A user with this email already exists')` (line 97). Under concurrency the loser's raw Prisma `P2002` message differs → falls through → **500**. QA: `500, 201, 500`.

## Fix approach
1. **Map `P2002` → 409** via the INF-02 `map-prisma-error` helper in the POST (and PATCH, which can also collide on email change) catch — friendly message "A user with this email already exists", no internals.
2. The exact-equality check becomes redundant once the mapper is in place; remove it (or keep as a fast path) — the point is the *unknown-error* branch must never 500 on a unique violation.
3. **Optionally** collapse check-then-insert into a single `create` with a caught `P2002` (the pre-check exists only to produce the friendly message; the mapper now does that). Keep `SUPER_ADMIN` guard (400) — escalation tests 8.7/8.8 stay green.
4. This is the reference instance of the whole "concurrent create → 500" family (also BUG-27/30/31/39/92/98 — see XC-06 for the DB-unique-completeness half).

## Files
- `src/lib/services/staff.service.ts`, `src/app/api/store/staff/route.ts`, `src/app/api/store/staff/[id]/route.ts` (PATCH email change), `src/lib/api/map-prisma-error.ts` (from INF-02).

## Acceptance / gate
- `tests/03` 5.1 flips: three simultaneous same-email POSTs → exactly one 201, two 409 CONFLICT, zero 500s.
- Sequential duplicate still 409 (1.4 unchanged); cross-tenant duplicate still 409.
