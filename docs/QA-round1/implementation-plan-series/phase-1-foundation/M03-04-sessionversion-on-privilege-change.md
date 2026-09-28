# M03-04 — BUG-6: role / permission / deactivation changes never bump `sessionVersion` (revocations apply only at next login)

**Severity:** P1-Critical (privilege persistence after revocation) · **Module:** 03 RBAC/Users · **QA pins:** `tests/03_rbac_users.spec.ts` 4.4, 8.11 · **Depends on:** M01-06 + M03-03 (the gate must actually enforce versions) · **Mechanism precedent:** NEW-D

## Verified source state (2026-09-15) — still holds
- `src/lib/services/staff.service.ts:99-163` `updateStaff()` writes `email/role/isActive/commissionRate/permissions` — **zero references to `sessionVersion`** in the file (grep-confirmed).
- Permissions/role/tenantId are **frozen into the JWT at login**: `src/lib/auth.config.ts:24-32` jwt callback copies claims only `if (user)` (i.e. only during the credentials sign-in flow); `src/lib/auth.ts:124-131` `authorize()` returns `getEffectivePermissions(...)` once.
- The invalidation mechanism **already exists and is used elsewhere** (NEW-D): `api/auth/reset-password/route.ts:87` and `api/settings/account/route.ts:97` both increment `sessionVersion` — proving the pattern and the one-line-per-call fix shape.
- Consequence (QA repro): deactivate a signed-in cashier → `/api/store/customers` still 200 until token expiry; grant-then-revoke a permission → live session unaffected. Mitigation note: escalations also don't apply to a live token, so this is a revocation failure, not an escalation-on-current-token.

## Fix approach
1. In `updateStaff()`, when **any** of `role`, `permissions`, or `isActive` changes (compare against the pre-update row — the service already fetches it), increment `sessionVersion` in the same `prisma.user.update` call (`{ sessionVersion: { increment: 1 } }`).
2. Clear the Node-side cache (`clearSessionVersionCacheForUser`) after the write, same as force-logout route does; Edge-side staleness is governed by the M01-06 cache decision.
3. `createStaffMember` role changes via other routes? None exist today — keep scope to updateStaff.
4. Audit: the STAFF_ROLE_CHANGED/PERMISSION_CHANGED rows (M03-02) already capture before/after — no extra row needed for the bump itself.
5. **Explicit non-goal:** do NOT re-read permissions from DB per request (that's a session-architecture change with performance cost; the version-bump design is the established pattern here).

## Files
- `src/lib/services/staff.service.ts` (increment + cache clear), route unchanged (already passes tenantId/id; actor via M03-02).

## Acceptance / gate
- `tests/03` 4.4 flips: `isActive:false` → live cashier request → bounced (401/redirect per endpoint class).
- `tests/03` 8.11 flips: revoke a granted permission → existing session no longer exercises it.
- Existing 8.10 force-logout authorization matrix stays green.
