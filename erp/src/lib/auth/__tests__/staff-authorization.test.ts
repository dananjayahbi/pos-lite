import { describe, expect, it } from 'vitest';

import {
  assertLastOwnerRemains,
  assertPermissionsGrantable,
  assignableRolesFor,
  canAssignRole,
  canManageStaffRole,
  canResetStaffPassword,
  grantablePermissions,
} from '@/lib/auth/staff-authorization';

/**
 * ARGUS #335: a manager must not be able to create/edit an owner, reset an
 * owner's password or grant owner-only permissions.
 */
describe('staff role hierarchy', () => {
  it('lets a manager administer operational roles only', () => {
    expect(canManageStaffRole('MANAGER', 'CASHIER')).toBe(true);
    expect(canManageStaffRole('MANAGER', 'FACTORY_MANAGER')).toBe(true);
    expect(canManageStaffRole('MANAGER', 'MANAGER')).toBe(false);
    expect(canManageStaffRole('MANAGER', 'OWNER')).toBe(false);
    expect(canManageStaffRole('MANAGER', 'SUPER_ADMIN')).toBe(false);
  });

  it('lets an owner manage every tenant role but not SUPER_ADMIN', () => {
    expect(canManageStaffRole('OWNER', 'OWNER')).toBe(true);
    expect(canManageStaffRole('OWNER', 'MANAGER')).toBe(true);
    expect(canManageStaffRole('OWNER', 'SUPER_ADMIN')).toBe(false);
  });

  it('only an owner/superadmin can assign OWNER', () => {
    expect(canAssignRole('MANAGER', 'OWNER')).toBe(false);
    expect(canAssignRole('MANAGER', 'MANAGER')).toBe(false);
    expect(canAssignRole('MANAGER', 'CASHIER')).toBe(true);
    expect(canAssignRole('OWNER', 'OWNER')).toBe(true);
    expect(canAssignRole('OWNER', 'MANAGER')).toBe(true);
  });

  it('offers only roles the actor can assign in the dropdown (ARGUS #346)', () => {
    const managerRoles = assignableRolesFor('MANAGER');
    expect(managerRoles).not.toContain('OWNER');
    expect(managerRoles).not.toContain('MANAGER');
    expect(managerRoles).toContain('CASHIER');

    const ownerRoles = assignableRolesFor('OWNER');
    expect(ownerRoles).toContain('OWNER');
    expect(ownerRoles).toContain('MANAGER');
    expect(assignableRolesFor('CASHIER')).toEqual([]);
  });

  it('restricts grantable permissions for managers to their own set', () => {
    const manager = grantablePermissions('MANAGER');
    expect(manager.has('staff:manage')).toBe(true);
    expect(manager.has('settings:manage')).toBe(false);
    expect(grantablePermissions('OWNER').has('settings:manage')).toBe(true);
  });

  it('rejects a permission outside the grantable set', () => {
    expect(() =>
      assertPermissionsGrantable('MANAGER', ['settings:manage']),
    ).toThrow(/PERMISSION_NOT_GRANTABLE/);
    expect(() =>
      assertPermissionsGrantable('MANAGER', ['sale:create']),
    ).not.toThrow();
  });

  it('prevents a manager from resetting an owner/manager password', () => {
    expect(canResetStaffPassword('MANAGER', 'CASHIER')).toBe(true);
    expect(canResetStaffPassword('MANAGER', 'OWNER')).toBe(false);
    expect(canResetStaffPassword('MANAGER', 'MANAGER')).toBe(false);
    expect(canResetStaffPassword('OWNER', 'OWNER')).toBe(true);
  });

  it('keeps at least one active owner', () => {
    expect(() =>
      assertLastOwnerRemains({
        existingRole: 'OWNER',
        existingIsActive: true,
        nextRole: 'MANAGER',
        otherActiveOwners: 0,
      }),
    ).toThrow(/LAST_OWNER_REQUIRED/);

    expect(() =>
      assertLastOwnerRemains({
        existingRole: 'OWNER',
        existingIsActive: true,
        nextIsActive: false,
        otherActiveOwners: 0,
      }),
    ).toThrow(/LAST_OWNER_REQUIRED/);

    expect(() =>
      assertLastOwnerRemains({
        existingRole: 'OWNER',
        existingIsActive: true,
        nextRole: 'MANAGER',
        otherActiveOwners: 1,
      }),
    ).not.toThrow();
  });
});
