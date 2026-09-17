# M30-01 — progress details

Status: **implemented** (uncommitted, branch `QA-R1`).

## 1. Research findings (recorded before the first source edit)

Scope confirmed against the repo (branch `QA-R1`):

| Area | Verified state |
|---|---|
| `createTrialSubscription` | Real path **`erp/src/lib/billing/subscription.service.ts:4`** (not `lib/services/`). Repo-wide grep + LSP: **zero callers** — dead code, exactly as the work order states. Signature `(tenantId, planId, tx?: Prisma.TransactionClient)`; 30-day trial, sets `Subscription.status=TRIAL` **and** `Tenant.subscriptionStatus=TRIAL` in one `$transaction`; throws `'Plan not found or inactive'` when the plan is missing/inactive. |
| `getSubscriptionForTenant` | Same file, `findUnique({ where: { tenantId } })` + plan/tenant/invoices includes. `Subscription.tenantId` is `@unique`, so one subscription per tenant. |
| Billing UI | `erp/src/app/(store)/billing/page.tsx:35-38` — null → `redirect('/')` (role gate: OWNER/MANAGER/SUPER_ADMIN). Renders plan name, status badge, TRIAL/past-due/suspended/cancelled cards (`PayHereCheckoutButton`), invoice history, cancel button. `erp/src/app/(store)/billing/payment-methods/page.tsx` — null → `redirect('/billing')`. **Both keep their null fallback (per the work order).** |
| Checkout | `erp/src/app/(store)/billing/actions.ts#initiateCheckout` → `'No subscription found'` when `subscription` is null, then creates a PENDING `Invoice` (period 30d/365d, due +7d). No change needed once a subscription exists. |
| Cancel API | `erp/src/app/api/billing/cancel/route.ts` — OWNER-only, 404 `'No subscription found'` when absent, 409 `'Subscription is already cancelled'` on replay, else 200 `{ subscription }` with `status=CANCELLED` + tenant mirror. |
| Tenant-create path | **Live path:** `POST /api/superadmin/tenants` (`erp/src/app/api/superadmin/tenants/route.ts:90`) — `prisma.tenant.create(...)` then `prisma.user.create(...)`, **hard-capped at 2 businesses** (403 before the insert). `/superadmin/tenants/new` is a **stub** (`redirect('/superadmin/tenants')`). `erp/src/lib/services/tenant.service.ts#createTenant` also inserts a tenant inside `$transaction` but has **zero callers** (dead). Both get the hook — the live one and the "would-be" one the work order names. |
| Active-plan semantics | `SubscriptionPlan.isActive` Boolean, `name` `@unique`. **No `isDefault` column** — the work order's `isDefault` does not exist on this model. Seeded by M08-05 (`seedSubscriptionPlans`, `erp/prisma/seed.ts:836`): STARTER/GROWTH/ENTERPRISE, all `isActive: true`, REPAIR upsert-by-name, run at `main():45` **before** the demo-tenant/demo-data sections. `GET /api/superadmin/plans` filters `isActive: true`. |
| Seed | `prisma/seed.ts` never creates Subscription/Invoice rows. Demo-tenant blocks live in `seedHardwareAndAuditData()` as numbered sections (`1.`, `1b.`, `1b1.`, `1b2.`, `1b3.`, `1c.`) — the natural home for `1d.`. Seed is `npx tsx prisma/seed.ts`; `prisma.config.ts` sets the same. |
| Constants | `erp/src/lib/billing/constants.ts` = `GRACE_PERIOD_DAYS = 7` only (consumed by the suspension cron + overview card). The 30-day trial length was a magic number inline in `createTrialSubscription` — extracted to a shared constant so the seed cannot drift from the service. |
| Spec mirror | `erp/tests/30_payments_billing.spec.ts` exists (mirror; already 86 lines ahead of the frozen copy via M08-05 pins F3/F8/L2/P3/S1). Frozen `docs/QA-round1/tests/30_payments_billing.spec.ts` untouched. |
| Cross-module blast radius | `erp/tests/08_superadmin_tenants.spec.ts` **P1/P3** pin the "no Subscription row" baseline (`mrr`/`arr`/`activeSubscribers`/`trialSubscribers` = 0, `revenueByPlan[].activeCount` = 0, `tenants[].planName` = `'None'`). Seeding a TRIAL row **necessarily invalidates those pins** — see §4. Not edited (another module's mirror). |

## 2. Design decisions

* **New file `erp/src/lib/billing/provisioning.ts`** (work order: no big blocks in a monolith). Holds `TRIAL_POLICY` (with the assumption recorded as a comment), `resolveTrialPlanId`, `provisionTrialSubscription` (idempotent) and `provisionTrialSubscriptionSafely` (never throws).
* **No `import "server-only"`** in the new module (unlike `payhere.service.ts`): it must stay importable from the seed/tsx path, matching `subscription.service.ts`.
* **No Prisma schema change** — `Subscription`/`Invoice`/`SubscriptionPlan` already exist.
* **Trial-length constant shared** (`TRIAL_PERIOD_DAYS = 30`) so seed ⇄ service cannot drift; existing `30 * 24 * 60 * 60 * 1000` behaviour preserved byte-for-byte.
* **Seed block `1d`** is idempotent with the repo's established REPAIR idiom (same as `seedQaUsers`/`seedSubscriptionPlans`): create when absent; if the demo row is `CANCELLED` (a QA cancel round), restore the TRIAL baseline on reseed. Any other existing status is left untouched.
* **Cancel-replay pins** (F2/A3/R1/X5) were asserting the BUG-70 404. They now assert the real contract as an invariant that survives repeated runs: 200 with `subscription.status === 'CANCELLED'` on the first cancel, 409 `'already cancelled'` on replays — never 404, never 500.

## 3. Changes

| File | Change |
|---|---|
| `erp/src/lib/billing/provisioning.ts` | **NEW.** `TRIAL_POLICY` (documented assumption), `resolveTrialPlanId()` (requested-active → STARTER → any active → null), `provisionTrialSubscription()` (idempotent; existing row reported untouched), `provisionTrialSubscriptionSafely()` (never throws). |
| `erp/src/lib/billing/constants.ts` | Added `TRIAL_PERIOD_DAYS = 30` beside `GRACE_PERIOD_DAYS` so seed and service share one basis. |
| `erp/src/lib/billing/subscription.service.ts` | `createTrialSubscription` now uses `TRIAL_PERIOD_DAYS` (value unchanged) instead of an inline `30 * 24 * 60 * 60 * 1000`. **Behaviour preserved; `getSubscriptionForTenant` and its null-redirect fallback untouched.** |
| `erp/src/app/api/superadmin/tenants/route.ts` | **Live provisioning hook** — `await provisionTrialSubscriptionSafely(tenant.id)` after the tenant + owner inserts, before the 201. |
| `erp/src/lib/services/tenant.service.ts` | **Would-be provisioning hook** — same call, deliberately **outside** `$transaction` (a billing failure must not roll back a created tenant); renamed the inner transaction result to `created` to return it after the hook. |
| `erp/prisma/seed.ts` | Import of `TRIAL_PERIOD_DAYS` + one self-contained, clearly-delimited block **`// ── 1d. TRIAL subscription for the demo tenant (M30-01 / BUG-70) ──`** inside `seedHardwareAndAuditData()`, placed after the `1b3` website-module section and **before** the `1c` demo-user early-return (so a missing demo user can't skip it). No other part of `seed.ts` restructured. |
| `erp/tests/30_payments_billing.spec.ts` | Gate pins flipped (details in §5). |

## 4. Cross-module impact (NEW issue — NOT fixed, out of task scope)

Seeding a TRIAL `Subscription` necessarily invalidates two **pre-existing** assertions in another module's mirror, `erp/tests/08_superadmin_tenants.spec.ts` **P3**:

* `:676` `expect(m?.trialSubscribers).toBe(0)` → now **1** (the demo tenant's TRIAL row).
* `:689` `expect(t.planName).toBe('None')` → now **`'STARTER'`** (the metrics tenant list joins the subscription's plan).

Unaffected in the same spec: `mrr`/`arr`/`activeSubscribers` stay `0` (they count `ACTIVE` only, and the seeded row is `TRIAL`), `revenueByPlan[].activeCount` stays `0`, and `:1281` `subscriptionStatus === 'TRIAL'` still holds. Left unedited — it is Module 08's mirror, not this task's file.

## 5. Spec pin edits (old → new, quoted)

All in `erp/tests/30_payments_billing.spec.ts` (runnable mirror only; frozen `docs/QA-round1/tests/` untouched).

**F1** — the gate pin itself:
* old: `test('F1 (BUG-70 gate pin): no subscription exists — billing page redirects to /', ...)` with
  `expect(page.url(), 'BUG-70 gate: /billing rendered — a subscription now exists; extend the suite to the full billing UI').not.toContain('/billing');`
* new: `test('F1 (M30-01 / BUG-70 pin): seeded tenant HAS a TRIAL subscription — billing page renders', ...)` with
  `expect(page.url(), 'M30-01: /billing must RENDER for the seeded tenant (a subscription exists now)').toContain('/billing');`
  plus `getByRole('heading', { name: 'Billing', level: 1 })` visible, `'STARTER'` visible, `/LKR [\d.,]+ \/ month/` visible, the status badge `/^(Trial|Active|Past Due|Suspended|Cancelled)$/` visible, and `Invoice History` heading visible.

**L1** — comment-only upgrade: `// With an invalid signature the route must stop before touching orders.` → adds *"M30-01 note: a real TRIAL subscription now exists for the demo tenant, so a forged-success IPN is also a billing-path candidate — the signature gate must stop it there too (see S5, which asserts no activation)."* Assertions unchanged (still `200` + `received === true`).

**S5** — assertion upgrade (was comment-only, "no subscription/invoice state can be verified without rows (BUG-70)"):
* new tail: logs in as SUPER_ADMIN, reads `/api/admin/metrics`, finds the `dilani` tenant, and
  `expect(dilani.subscriptionStatus, 'a forged-signature IPN must never flip the tenant to ACTIVE').not.toBe('ACTIVE');`

**A1** — comment-only correction (assertions unchanged: `200`, always-200 contract): the *"With no matching invoice, no event can be written"* rationale now states the unknown `order_id` — not the absence of a subscription — is what makes the pin vacuous, and that the real-invoice half is gated on M30-02.

**Also flipped (all were asserting the BUG-70 404 / unreachable-UI state):**

| Pin | old | new |
|---|---|---|
| F2 | `test('F2: cancel route returns 404 when no subscription exists')` / `expect(res.status()).toBe(404)` / `expect(json.error).toContain('No subscription found')` | `test('F2: cancel route returns the real subscription contract (M30-01)')` / `expect([200, 409], ...).toContain(res.status())` / `200 → json.subscription.status === 'CANCELLED'` + `cancelledAt` truthy, else `error` contains `'already cancelled'` |
| F7 | `test('F7: payment-methods page is unreachable without a subscription (redirect)')` / `expect(page.url()).not.toContain('/billing/payment-methods')` | `test('F7: payment-methods page renders for the seeded subscription (M30-01)')` / `expect(page.url()).toContain('/billing/payment-methods')` + `Payment Methods` h1 + `'No token on file'` visible |
| A3 | `test('A3: cancel route is not idempotent-blind — 404 (no sub) is stable across replays')` / `expect(a.status()).toBe(404)` | `test('A3: cancel replays converge on 409 already-cancelled — never 404 (M30-01)')` / first `[200, 409]`, replays both `409` with `'already cancelled'` |
| R1 | `test('R1: concurrent cancel PATCHes never 500 (no subscription)')` / `expect(r.status()).toBe(404)` | `test('R1: concurrent cancel PATCHes never 500 and never 404 (M30-01)')` / `expect([200, 409]).toContain(r.status())` + `expect(r.status()).not.toBe(404)` |
| X5 | `expect(res.status()).toBe(404)` (incl. `// 404 (no subscription in the SESSION tenant)`) | `expect([200, 409]).toContain(res.status())` + on 200, `json.subscription.tenantId !== 'cmforeign0000000000000000'` |

Header comments (UI/API inventory + "Live-environment reality") rewritten to describe the post-fix state. Login helper and cleanup style untouched.

## 6. Verification

* `npx tsc --noEmit -p tsconfig.json` → 5 errors, **all pre-existing and none in touched files**: 2 × `jspdf` in `src/lib/reports/generate-report.ts` (excluded by the work order) + 3 × `website.validators.ts` (`TS1117`/`TS2300` duplicates from another agent's in-flight M29-03 edit). `get_errors` on every touched file → **0**.
* `npx vitest run` → **37 files / 286 tests passed**.
* `npx eslint` on the touched source files → 0 errors; the only warning is the intentional `console.error` in the non-fatal wrapper (`no-console` is `warn` repo-wide, and every logger in `src/lib` uses it the same way). `prisma/seed.ts`'s 4 lint **errors** (`FORM_SETS`, `PACK_SIZE_SETS`, `actors`, `actorRoles` unused) are pre-existing at HEAD and outside my hunks — not touched.
* `npx prisma db seed` run twice: 1st → `Demo TRIAL subscription seeded (30d, STARTER)`, 2nd → `Demo subscription already present, skipping` (**idempotent**).
* Read-only probes confirmed the acceptance condition: `getSubscriptionForTenant(dilani)` returns the row (`plan STARTER`, `status TRIAL`, `invoices 0`, `trialEndsAt +30d`, period 30d) and `resolveTrialPlanId()` returns the STARTER id — i.e. the `/billing` redirect condition is gone.
* Playwright **not** run, dev server not started, no `prisma db push`, nothing committed. Temporary probe scripts were deleted.

## 7. Trial-policy assumption (client D-level answer outstanding)

Duration **30 days** (`TRIAL_PERIOD_DAYS`, identical to the pre-existing inline math) · plan **STARTER** (entry tier, resolved by name) · grace **inherited, not re-implemented**: the existing `check-subscriptions` cron moves TRIAL → PAST_DUE at `trialEndsAt` and suspends after `GRACE_PERIOD_DAYS` (7). Recorded as a code comment in `provisioning.ts` and in the seed's `1d` block, and flagged via `TRIAL_POLICY.assumedBecauseClientPolicyUnanswered`.