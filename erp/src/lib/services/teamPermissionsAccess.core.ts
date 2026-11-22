import { PERMISSIONS } from '@/lib/constants/permissions';

/**
 * Team & Permissions page access (ARGUS #460).
 *
 * One model for page, roster and save:
 *  - the page and the roster list need `staff:view`;
 *  - managing a member needs `staff:manage`;
 *  - changing the explicit permission set needs `staff:permissions:assign`.
 *
 * `canSave` is deliberately the AND: a role/active-only change still uses the
 * same PATCH route, which requires `staff:manage`, and the form always sends
 * `permissions`, which requires `staff:permissions:assign`. Hiding the Save
 * control unless both are held prevents an editable grid whose Save 403s.
 */
export interface TeamPermissionsAccess {
  canViewRoster: boolean;
  canManage: boolean;
  canAssignPermissions: boolean;
  canSave: boolean;
}

export function resolveTeamPermissionsAccess(
  permissions: readonly string[],
): TeamPermissionsAccess {
  const set = new Set(permissions);
  const canViewRoster = set.has(PERMISSIONS.STAFF.viewStaff);
  const canManage = set.has(PERMISSIONS.STAFF.manageStaff);
  const canAssignPermissions = set.has(PERMISSIONS.STAFF.assignPermissions);

  return {
    canViewRoster,
    canManage,
    canAssignPermissions,
    canSave: canManage && canAssignPermissions,
  };
}
