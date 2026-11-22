# Permission grid: search, bulk actions and dirty state

ARGUS #466. The editor was one 134-checkbox scroll across 23 groups: no
permission search, no group collapse, no select-all/reset, no dirty indicator,
no unsaved-change warning, and Save was enabled even when nothing had changed.
The roster's "Extra permissions" cell showed only a count, so auditing who held
which extras meant opening every user.

## Editor

- **Search** filters by label or raw key; empty groups disappear.
- Each group header collapses/expands and offers **Grant all** (adds grantable
  extras and restores denied role defaults) and **Reset** (clears that group's
  extras and revokes). A toolbar adds **Collapse all** and **Reset extras**.
- **Unsaved changes** badge plus a disabled Save until the normalized draft
  (role, active flag, extras and revokes) differs from the stored member.
  Closing with unsaved changes asks for confirmation.
- The roster cell now names overrides (`+sale:void, !sale:create`, capped) with
  the full list in the `title`, while still showing the counts.

`src/lib/services/permissionGrid.core.ts` owns the pure parts
(`filterPermissionGroups`, `grantGroupExtras`, `resetGroupPermissions`,
`countPermissionOverrides`, `summarizePermissionOverrides`).

## Verification

- `src/lib/services/__tests__/permissionGrid.core.test.ts`
- `src/lib/services/__tests__/permissionSet.core.test.ts` (dirty comparison)
