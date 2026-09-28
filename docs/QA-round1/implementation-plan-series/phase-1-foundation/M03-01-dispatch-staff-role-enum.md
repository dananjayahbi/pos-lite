# M03-01 — BUG-3: `DISPATCH_STAFF` offered by the permission editor but rejected by the API (client req 2.4 Role 2 unmanageable)

**Severity:** P1-Critical · **Module:** 03 RBAC/Users · **QA pin:** `tests/03_rbac_users.spec.ts` 11.1 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds, three-way disagreement
| Layer | File / line | DISPATCH_STAFF? |
|---|---|---|
| Prisma enum | `prisma/schema.prisma:15-23` (`UserRole`) | ✅ exists |
| Permission matrix | `src/lib/constants/permissions.ts:192-194,223` — `ROLE_PERMISSIONS.DISPATCH_STAFF` with 10 delivery/recovery keys | ✅ exists |
| **API validator** | `src/lib/validators/staff.validators.ts:3` — `z.enum(['OWNER','MANAGER','CASHIER','STOCK_CLERK','FACTORY_MANAGER'])` | ❌ **missing** → create/patch with the role 400s |
| Settings editor | `src/components/settings/UserPermissionsSettingsClient.tsx:55` (`ASSIGNABLE_ROLES`, 6 roles) | ✅ offered → save always fails |
| Staff page | `src/app/(store)/staff/page.tsx:64` (`ASSIGNABLE_ROLES`, 5 roles) + `ROLE_COLORS:56-62` (no entry → default badge) | ❌ missing |

Net: the seeded `dispatch@ayurpos.dev` account exists but **cannot have its role or permissions edited at all** (the editor always sends `role` on save → even a no-op save 400s). Req 2.4 Role 2 is unmanageable through the UI.

## Fix approach
1. **Single source of truth for assignable roles** — derive the validator enum from the same constant the permission matrix is typed against instead of a second hand-written list: add `ASSIGNABLE_ROLES` (or reuse `ALL_ROLES` minus `SUPER_ADMIN`) to `src/lib/constants/permissions.ts`; `staff.validators.ts` builds its `z.enum` from it; both UI files import it. (SUPER_ADMIN stays excluded — escalation guard is a *passing* QA contract, tests 8.7/8.8.)
2. Add `DISPATCH_STAFF` to `ROLE_COLORS` in `staff/page.tsx` (brand-consistent token, not a new color).
3. Keep `/staff` and `/settings/users` offering the **same** set — the QA finding was literally "the two screens disagree"; the shared constant makes disagreement structurally impossible.
4. Whitelist guard for `permissions[]` (already `ALL_PERMISSIONS`-checked) unchanged.

## Files
- `src/lib/constants/permissions.ts`, `src/lib/validators/staff.validators.ts`, `src/app/(store)/staff/page.tsx`, `src/components/settings/UserPermissionsSettingsClient.tsx`.

## Acceptance / gate
- `tests/03_rbac_users.spec.ts` 11.1 flips from "rejected: DISPATCH_STAFF → 400" to "all advertised roles round-trip 200".
- New Vitest: every role in the editor list === every role in the validator enum === keys of `ROLE_PERMISSIONS` minus SUPER_ADMIN (the UI↔API enum contract, spec §11, now enforced at build time).
- Manual: set dispatch user's role to DISPATCH_STAFF via editor → 200; re-save no-op → 200.
