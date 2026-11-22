# Team permissions: revoking a single role default

ARGUS #464. The permission model was additive-only: a role default was always
present, so removing one manager capability meant changing the whole role and
losing every other default with it. There was no deny path and no custom role.

## Contract

`User.permissions` (already a `String[]`, so no migration) now stores two kinds
of entry:

- `sale:void` - an explicit extra on top of the role;
- `!sale:void` - an explicit **revoke** of a role default for this user only.

`src/lib/constants/permissions.ts` resolves both:

```
effective = (role defaults + extras) - revokes
```

`getEffectivePermissions` is the single resolver behind the session payload,
page guards, API guards and `usePermissions`, so a revoke is enforced
server-side, not just greyed out in the editor.

## Editor

`permissionSet.core.ts` exposes `splitPermissionEntries`, `deniedPermissions`,
`permissionPayloadToSave` and teaches `isStaffPermissionDraftUnchanged` about
revokes. An inherited checkbox can now be unchecked, which stores a `!key`
entry; a revoked row is badged **Revoked** and the role itself is untouched.

Only keys the selected role inherits can be stored as revokes, so a role change
cannot leave a stale deny behind. The staff PATCH validator accepts `!key`, and
`assertPermissionsGrantable` checks the underlying key: an actor may only
revoke a capability they themselves hold.

## Verification

- `src/lib/services/__tests__/permissionSet.core.test.ts`
- `src/lib/constants/__tests__/security-permissions.test.ts`
