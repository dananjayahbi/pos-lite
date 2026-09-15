# M01-07 — BUG-54: seeded cashier login bounces back to `/login` (RBAC verification blocked)

**Severity:** P1-Critical (blocks Module 20 + req 3.8 RBAC verification) · **Module:** 01 Auth / seeding · **QA pin:** `tests/20_timeclock_commissions.spec.ts` T5 · **Depends on:** M01-06 (gate semantics), INF-01 (harness to prove it)

## Verified source state (2026-09-15) — symptom open; root cause now *ranked*, not guessed
QA observed `cashier1@ayurpos.dev` / `cashier123!` never establishing a session (redirect back to `/login`), so Module 20's negative-RBAC contract was untestable. Source analysis on this branch ranks four plausible causes — **the fix must eliminate all four classes**, because each independently produces the observed loop:

1. **Seed idempotency hole (most likely).** `cashier1`/`cashier2` are created **only inside `seedDemoSales()`** (`prisma/seed.ts:663-702`): if the tenant already has ≥20 sales the whole function — including user creation — is skipped, and the upsert uses `update: {}`, so a stale row (wrong hash from an earlier seed version, `isActive:false` flipped by a staff toggle, or wrong tenantId) is **never repaired**. Module 03's housekeeping even documents a `beforeAll` that *restores* the seeded cashier — QA was working around this.
2. **Login rate limiter.** `src/lib/auth.ts:33-38` — 10 failed attempts / IP / 15 min, in-memory; repeated QA suites from one IP hit `TOO_MANY_ATTEMPTS` → `CredentialsSignin` → "redirected back to /login" with a generic message.
3. **Cookie-name mismatch.** `middleware.ts:124-135` derives `secureCookie` from `x-forwarded-proto`; behind an HTTPS-proxying dev setup while the app serves HTTP, the NextAuth cookie is `__Secure-authjs.session-token` on one side and `authjs.session-token` on the other → middleware sees no token → immediate bounce even though server-side `auth()` works.
4. **sessionVersion invalidation loop.** reset-password / `settings/account` PATCH / force-logout all bump `sessionVersion`; middleware (199–226) then bounces to `/login?sessionExpired=true`. If a prior test force-logged-out cashier1, every later login attempt in the window looks like this bug. (M01-06 makes this gate deterministic — which makes this cause *easier* to diagnose, not more likely.)

## Fix approach
1. **Seed hardening (primary):** move cashier1/cashier2 (and dispatch) creation **out of** `seedDemoSales()` into the top-level user-seeding section (same as owners/superadmin); change every seeded user's upsert to `update: { passwordHash, role, isActive: true, tenantId }`-style repair semantics (idempotent re-seed must *fix* drift, not preserve it). Document that `pnpm prisma db seed` is the canonical reset for QA environments.
2. **Limiter observability:** on `TOO_MANY_ATTEMPTS`, the login page already maps the error text (page.tsx:30-47) — verify the message renders distinctly from bad credentials (it should: "Too many attempts…"). Add a dev-only reset hook or document the 15-min wait; suites must reuse `storageState` (they already do).
3. **Cookie-name determinism:** in dev (`NODE_ENV !== 'production'`), force `useSecureCookies: false` in the NextAuth config so HTTP dev never mixes names; document that HTTPS-proxy dev setups need `AUTH_TRUST_HOST` + `x-forwarded-proto` awareness. (Check `auth.config.ts` current cookie settings during implementation.)
4. **Diagnosability:** when middleware bounces due to sessionVersion, the redirect already carries `?sessionExpired=true` and the login page renders a banner (page.tsx:67,130-135) — confirm the banner fires for *all* four causes above where applicable (1 has no session at all, so the form must show the underlying error, not silence — covered by M01-05 item 2).
5. **Proof:** after fix, `tests/20_timeclock_commissions.spec.ts` runs T1–T5 green (cashier authenticates, reads own timeclock, 403s on other-staff routes); M20-01 then covers the RBAC surface itself.

## Files
- `prisma/seed.ts` (restructure + repair semantics), `src/lib/auth.config.ts` (cookie determinism), possibly `src/lib/auth.ts` (limiter message), no page changes beyond M01-05.

## Acceptance / gate
- Cold seed on a dirty DB (delete cashier1, flip a stale hash, re-run seed) → cashier1 logs in from a browser **and** `POST /api/auth/callback/credentials` establishes a session (test 20 T5's precondition).
- `tests/20_timeclock_commissions.spec.ts` fully green (was 5 passed / 1 failed / 3 did not run).
- Dev HTTP behind a proxy no longer bounces a fresh session (manual note in PR).
