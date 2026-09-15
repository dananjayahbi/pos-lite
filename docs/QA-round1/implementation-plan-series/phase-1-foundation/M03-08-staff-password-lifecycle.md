# M03-08 — GAP-2 / GAP-3: no way to set a new staff member's password; roles unverifiable end-to-end

**Severity:** P1-Critical (broken user-management lifecycle for a live rollout; blocks req 2.4 Roles 2–3 sign-off) · **Module:** 03 RBAC/Users · **QA refs:** `tests/03` GAP-2/GAP-3 notes; req 2.4 Role 3 "code-verified, not browser-verified" · **Depends on:** M03-01 (role enum), M01-07 (seed repair)

## Verified source state (2026-09-15) — still holds
- `src/lib/services/staff.service.ts:168-192` `createStaffMember`: `tempPassword = randomUUID()`, bcrypt-hashed (cost 12, lines 177-178) — the password is **never returned or emailed**; `POST /api/store/staff` (`route.ts:91-93`) returns the record without it. **A newly created account cannot sign in at all.**
- No admin set-password route and no invite route exists anywhere under `src/app/api` (grep-confirmed: only forgot/reset token flow + self-service `settings/account`).
- Consequently `TEST_CREDENTIALS.md` seeds only SUPER_ADMIN, 2×OWNER, 3×CASHIER, 1×DISPATCH. **No MANAGER / STOCK_CLERK / FACTORY_MANAGER with a known password** exists, so middleware factory isolation (`FACTORY_FORBIDDEN_PATH_PREFIXES`, middleware.ts:26-36,177-185) and `ROLE_PERMISSIONS.FACTORY_MANAGER` scoping are code-verified only (req 2.4 Role 3 stays `[ ]`).

## Fix approach
1. **Admin set-password (primary):** add `POST /api/store/staff/[id]/password` — OWNER-only (or `staff:update` + explicit guard), body `{ newPassword }` validated to policy, bcrypt hash, **increment `sessionVersion`** (mirrors `settings/account` + reset-password precedent, NEW-D) so any live session of the target dies, audit `STAFF_PASSWORD_RESET` with real actor (M03-02 helper).
2. **Invite email (secondary, provider-gated):** on create, optionally send a reset-link via the existing `sendPasswordResetEmail` path (reuses `VerificationToken`); silently no-op when email unconfigured (INF-03) — the admin password route remains the guaranteed path.
3. **Create-flow UX:** staff create dialog gets a "Set initial password" field (visible to OWNER only) that calls the new route after 201 — simplest possible lifecycle; document the alternative (invite) as the email-configured default.
4. **Verification seeds (unblocks req 2.4 Role 3):** extend `prisma/seed.ts` with known-password `manager@ayurpos.dev`, `stockclerk@ayurpos.dev`, `factory@ayurpos.dev` (dev-only guard like existing seeded users), update `TEST_CREDENTIALS.md`. Then QA can browser-verify FACTORY_MANAGER redirect and DISPATCH_STAFF surfaces (REQ-09).

## Files
- new `src/app/api/store/staff/[id]/password/route.ts`, `staff.service.ts`, `UserPermissionsSettingsClient.tsx` / staff create dialog, `prisma/seed.ts`, `docs/QA-round1/TEST_CREDENTIALS.md` (+ `erp/TEST_CREDENTIALS.md` copy), audit constants.

## Acceptance / gate
- New `tests/03` section (or extended): create staff → set password → sign in as them → role-scoped routes behave; password set bumps sessionVersion (old session bounced — shares M03-04's mechanism).
- `tests/21/22` factory RBAC and req 2.4 Role 2/3 become browser-verifiable (REQ-09 closes).
- GAP-2/GAP-3 marked resolved in the next QA round's report.
