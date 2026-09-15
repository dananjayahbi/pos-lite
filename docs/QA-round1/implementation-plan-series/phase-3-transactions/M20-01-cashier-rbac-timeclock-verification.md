# M20-01 — BUG-54 (dependent): cashier RBAC verification for timeclock & commissions — gates exist, live proof blocked by the login defect

**Severity:** P1 verification gap (root bug M01-07; this doc is the proof plan) · **Module:** 20 Timeclock/Commissions · **QA pin:** `tests/20_timeclock_commissions.spec.ts` T5 · **Depends on:** M01-07 (cashier login fixed), INF-01 (harness)

## Verified source state (2026-09-15)
The endpoints themselves already look correctly scoped:
- `src/app/api/store/timeclock/route.ts:24-26` — `GET ?userId=` history: a non-self userId requires role MANAGER/OWNER, else rejection → the "cashier reads only own history" contract is implemented.
- Commissions family present: `staff/[id]/commissions`, `staff/commissions`, `commissions/payout`, `commissions/payouts` route files exist; payout POST gates on `['MANAGER','OWNER'].includes(session.user.role)` (`payout/route.ts:33`).
- QA's T5 (`RBAC blocks cashiers from timeclock and commission actions`) never executed because cashier1 couldn't authenticate (BUG-54 → root-caused in M01-07).

## Action (mostly verification, small hardening)
1. After M01-07 lands, run `tests/20` T5: cashier1 → own timeclock history 200; `?userId=<other>` 403; commissions read/payout 403; dispatch role equivalents.
2. **Audit the gates for consistency while verifying:** timeclock uses an inline role array (`:26`) and payout another (`:33`) — replace both with the shared `hasPermission`/permission-key style (XC-03) so role-list drift can't recur; ensure a `timeclock:view_own`-style semantics is explicit rather than "not in array".
3. Commission accrual double-count check (roadmap note): returns (Module 17) must not leave stale `CommissionRecord`s — verify the return service decrements commission; if not, that's a new bug entry (append to this doc during implementation).

## Files
- `timeclock/route.ts`, `commissions/*` routes (guard refactor only), tests/20 run.

## Acceptance / gate
- `tests/20` T5 green; req 3.8 bullets "Cashier RBAC enforced" + "Payout creation validates" ticked in `QA_CLIENT_REQ.md`.
