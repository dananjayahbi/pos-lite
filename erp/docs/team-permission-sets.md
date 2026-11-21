# Team permissions: explicit extras and no-op saves

ARGUS #459. The roster printed `member.permissions.length`, which for legacy
accounts included role-inherited defaults (a cashier showed 8), while the
editor showed only 4 explicit overrides. Saving rewrote the 8 stored values as
4, bumped `sessionVersion`, logged the user out and wrote an audit row for a
change the operator never made.

## Contract

`src/lib/services/permissionSet.core.ts` is the single normalization:

- `extraPermissions(stored, role)` = stored permissions minus that role's
  defaults;
- `effectivePermissions(role, extras)` = role defaults plus extras;
- `permissionsToSave(draft, draftRole)` strips inherited keys before the
  PATCH body (a role change cannot persist stale defaults as overrides);
- `isStaffPermissionDraftUnchanged(existing, draft)` compares role, active flag
  and the normalized extras.

The roster and the editor both display the normalized extras. The staff detail
page's "Explicit Permissions" card uses the same helper.

## No-op save

`UserPermissionsSettingsClient.requestSave()`:

1. normalizes both the stored and draft extras;
2. if role, active flag and extras are unchanged, closes with
   `No changes to save.` and sends no PATCH;
3. otherwise sends only the explicit extras.

No PATCH means no `sessionVersion` increment, no audit row and no forced logout
for an unchanged save.

## Verification

- `src/lib/services/__tests__/permissionSet.core.test.ts`
- `npx tsc --noEmit`
