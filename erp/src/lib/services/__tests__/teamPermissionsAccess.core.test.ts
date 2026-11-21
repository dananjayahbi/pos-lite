import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { resolveTeamPermissionsAccess } from '@/lib/services/teamPermissionsAccess.core';

/** ARGUS #460: page, roster and save share one permission model. */
describe('resolveTeamPermissionsAccess', () => {
  it('denies everything without staff keys', () => {
    expect(resolveTeamPermissionsAccess([])).toEqual({
      canViewRoster: false,
      canManage: false,
      canAssignPermissions: false,
      canSave: false,
    });
  });

  it('allows the roster with staff:view only, but not save', () => {
    const access = resolveTeamPermissionsAccess([PERMISSIONS.STAFF.viewStaff]);
    expect(access.canViewRoster).toBe(true);
    expect(access.canManage).toBe(false);
    expect(access.canSave).toBe(false);
  });

  it('does not grant the roster from settings:users alone', () => {
    const access = resolveTeamPermissionsAccess([PERMISSIONS.SETTINGS.manageUsers]);
    expect(access.canViewRoster).toBe(false);
  });

  it('requires both save keys to expose Save', () => {
    expect(
      resolveTeamPermissionsAccess([PERMISSIONS.STAFF.manageStaff]).canSave,
    ).toBe(false);
    expect(
      resolveTeamPermissionsAccess([PERMISSIONS.STAFF.assignPermissions]).canSave,
    ).toBe(false);

    const full = resolveTeamPermissionsAccess([
      PERMISSIONS.STAFF.viewStaff,
      PERMISSIONS.STAFF.manageStaff,
      PERMISSIONS.STAFF.assignPermissions,
    ]);
    expect(full.canViewRoster).toBe(true);
    expect(full.canSave).toBe(true);
  });
});
