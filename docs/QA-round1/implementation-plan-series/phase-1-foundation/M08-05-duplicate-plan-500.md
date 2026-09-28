# M08-05 — BUG-39: duplicate subscription-plan name → unhandled 500 with EMPTY body (+ plan seeding & list-semantics decisions)

**Severity:** P2-Major · **Module:** 08 Super Admin / 30 Billing · **QA pin:** `tests/08_superadmin_tenants.spec.ts` (ensurePlan fallback), `tests/30` plans series · **Depends on:** INF-02 (P2002→409), M30-01 (plan seeding interlocks) · **Related:** OBS-12, OBS-17

## Verified source state (2026-09-15) — all holds
- `src/app/api/admin/plans/route.ts` POST (32-64): after `safeParse`, `await prisma.subscriptionPlan.create(...)` (52) is **unwrapped** — no try/catch, no pre-check. `SubscriptionPlan.name @unique` (`schema.prisma:541`); `createPlanSchema.name = z.enum(['STARTER','GROWTH','ENTERPRISE'])` (line 7) — so a second create of an existing name (even `isActive:false`) throws `P2002` → **500 with a completely empty body** (no JSON envelope). The 500 is name-dependent, not payload-dependent (QA: GROWTH 500, ENTERPRISE 201 same DB state).
- **OBS-17 (two list semantics):** `admin/plans` GET (23-26) has no `where` → returns `isActive:false` rows; `superadmin/plans` GET (11-14) filters `{isActive:true}`. Same resource, divergent contract.
- **OBS-12:** `subscription_plans` is empty in seed → MRR/ARR/revenueByPlan structurally zero on a pristine install; the dashboard revenue cards are dead weight.

## Fix approach
1. **409 contract:** wrap the create via INF-02 (`P2002` → 409 CONFLICT "A plan with this name already exists"); optionally a `findUnique` pre-check for the friendly message. Decide archived-name semantics: recommend **name stays taken** while any row exists (unique is global) → the 409 message should say so ("…an archived plan uses this name").
2. **List semantics:** make both GETs consistent. Recommend `isActive:true` default with `?includeInactive=true` for admin, OR always-active-filtered + a separate archived view. Superadmin is the primary consumer; align `admin/plans` to it. Record the choice.
3. **Seed plans (OBS-12):** add 3-4 realistic plans (STARTER/GROWTH/ENTERPRISE, at least one `isActive:true`) to `prisma/seed.ts` so MRR math and the billing UI (M30-01) have a substrate. This is the same seed file M01-07/M03-08 touch — sequence seed edits.
4. Empty-body 500 is itself a bug class: INF-02 guarantees every error path returns the typed envelope.

## Files
- `src/app/api/admin/plans/route.ts`, `src/app/api/superadmin/plans/route.ts`, `prisma/seed.ts`, INF-02 mapper.

## Acceptance / gate
- `tests/08` ensurePlan pin flips: duplicate name → 409 (typed envelope, not empty 500). `tests/30` plans series: both GETs agree; seeded active plan makes MRR non-zero (upgrade the zero-base P3 pin to a populated-data assertion).
