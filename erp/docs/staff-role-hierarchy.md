# Staff role hierarchy and owner protection

`staff:manage` no longer implies control over owners or unrestricted permission
grants (ARGUS #335). The MANAGER role receives `staff:manage` and
`staff:permissions:assign`, but a manager could create an OWNER, promote/demote
or deactivate the owner, reset the owner's password and grant any permission
(including owner-only settings) - a full tenant takeover path.

## Rules (server-enforced)

`src/lib/auth/staff-authorization.ts`, used by `staff.service`:

| Action | MANAGER | OWNER / SUPER_ADMIN |
| ------ | ------- | ------------------- |
| Manage a CASHIER / STOCK_CLERK / DISPATCH_STAFF / FACTORY_MANAGER | yes | yes |
| Manage a MANAGER / OWNER | no | yes (not SUPER_ADMIN) |
| Assign OWNER | no | yes |
| Assign MANAGER | no | yes |
| Assign operational roles | yes | yes |
| Grant permissions | only permissions MANAGER itself holds | all |
| Reset password | operational roles only | any tenant role (not SUPER_ADMIN) |

Additional guards:

- A manager cannot change **their own** role, status or permissions.
- The store must keep at least one active OWNER: demoting or deactivating the
  last one returns `409 LAST_OWNER_REQUIRED`.
- Creating a staff member with a role the actor cannot assign returns
  `403 STAFF_ROLE_NOT_ASSIGNABLE`; a password reset outside the hierarchy
  returns `403 STAFF_PASSWORD_RESET_FORBIDDEN`; a permission outside the
  actor's grantable set returns `403 PERMISSION_NOT_GRANTABLE`.

The role dropdowns still list every assignable role (the shared
`ASSIGNABLE_ROLES`), but the API rejects roles the actor cannot assign; the
error is shown by the staff form.

## Every staff PATCH is gated (ARGUS #336)

The route used to require `staff:manage` only when the body contained email,
role, status or commission; a payload with only `basicSalary`, bank details or
PII bypassed the permission check entirely. The PATCH route now always requires
`staff:manage` (plus `staff:permissions:assign` for a `permissions` array), and
`updateStaff` writes a durable `STAFF_UPDATED` audit row for any HR, contact,
salary or bank field it changes, recorded before/after. Deactivation,
reactivation and commission-rate changes get their own actions — see
`staff-audit-trail.md` (ARGUS #340).

## Verification

`src/lib/auth/__tests__/staff-authorization.test.ts` covers the hierarchy,
permission subsets, password resets and the last-owner guard; the map-service
error tests cover the new sentinels.
