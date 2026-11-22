# High-risk permission grants

ARGUS #461. All 134 permission keys rendered as identical checkboxes. Keys
that control the permission system, money movement, billing or payroll had no
warning, and the editor offered keys the actor cannot grant.

## Metadata

`src/lib/services/permissionRisk.core.ts` defines high-risk reasons for:

- `settings:users`, `settings:manage`, `settings:tax`
- `staff:manage`, `staff:permissions:assign`
- `billing:manage`
- `payroll:run`, `payroll:settings:manage`
- `payment_account:close`
- supplier approval, delivery courier/rate-card/remittance keys
- promotion delete, zero-value audit report, petty-cash fund settings

Each key exposes `highRisk`, `managerExcluded` and a plain-language `reason`.

## Editor

- High-risk keys get a red border and a **High risk** badge plus the reason.
- Keys outside `grantablePermissions(actorRole)` are disabled and labelled
  **Not grantable by your role**.
- Save first computes newly added high-risk keys in the EFFECTIVE set (so a
  role promotion that inherits a high-risk key also prompts; already-held keys
  do not prompt again). If any are new, a confirmation dialog lists each key
  and its reason before the PATCH is sent.

## Server

The server remains authoritative: the PATCH route requires
`staff:manage` + `staff:permissions:assign`, and
`staff-authorization.assertPermissionsGrantable` rejects any key outside the
actor's grantable set with `403 PERMISSION_NOT_GRANTABLE`. The UI restriction
only prevents a doomed request.

## Verification

- `src/lib/services/__tests__/permissionRisk.core.test.ts`
- `src/lib/auth/__tests__/staff-authorization.test.ts`
- `npx tsc --noEmit`
