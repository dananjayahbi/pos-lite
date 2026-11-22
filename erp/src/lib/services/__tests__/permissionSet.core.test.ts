import { describe, expect, it } from 'vitest';

import {
  deniedPermissions,
  effectivePermissions,
  extraPermissions,
  isStaffPermissionDraftUnchanged,
  normalizePermissionList,
  permissionPayloadToSave,
  permissionsToSave,
  roleDefaultPermissions,
  samePermissionSet,
} from '@/lib/services/permissionSet.core';

/**
 * ARGUS #459: display and save only the extras, and make an unchanged save a
 * no-op so it cannot bump sessionVersion / audit for nothing.
 */
const cashierDefaults = roleDefaultPermissions('CASHIER');

describe('permission set normalization', () => {
  it('returns the role defaults for a cashier', () => {
    expect(cashierDefaults.length).toBeGreaterThan(0);
    expect(cashierDefaults).toContain('sale:create');
    expect(roleDefaultPermissions('NOT_A_ROLE')).toEqual([]);
  });

  it('de-duplicates and sorts stored permissions', () => {
    expect(normalizePermissionList(['b', 'a', 'b', 3, null])).toEqual(['a', 'b']);
    expect(normalizePermissionList(undefined)).toEqual([]);
  });

  it('shows extras, not inherited defaults', () => {
    const stored = [...cashierDefaults, 'settings:view', 'report:view_sales'];
    expect(extraPermissions(stored, 'CASHIER')).toEqual(['report:view_sales', 'settings:view']);
  });

  it('computes effective permissions as defaults plus extras', () => {
    const effective = effectivePermissions('CASHIER', ['report:view_sales']);
    expect(effective).toContain('sale:create');
    expect(effective).toContain('report:view_sales');
    expect(effective.length).toBe(cashierDefaults.length + 1);
  });

  it('compares permission lists as sets', () => {
    expect(samePermissionSet(['b', 'a', 'a'], ['a', 'b'])).toBe(true);
    expect(samePermissionSet(['a'], ['a', 'b'])).toBe(false);
  });

  it('strips inherited defaults when saving a draft', () => {
    const stored = [...cashierDefaults, 'report:view_sales'];
    expect(permissionsToSave(stored, 'CASHIER')).toEqual(['report:view_sales']);
  });
});

describe('explicit revokes (ARGUS #464)', () => {
  it('treats a !key entry as a deny, not an extra', () => {
    const stored = ['!sale:create', 'report:view_sales'];
    expect(extraPermissions(stored, 'CASHIER')).toEqual(['report:view_sales']);
    expect(deniedPermissions(stored, 'CASHIER')).toEqual(['sale:create']);
    expect(effectivePermissions('CASHIER', stored)).not.toContain('sale:create');
    expect(effectivePermissions('CASHIER', stored)).toContain('report:view_sales');
  });

  it('only keeps denies that the selected role actually inherits', () => {
    // report:view_sales is not a cashier default, so `!report:view_sales` is
    // not a meaningful revoke.
    expect(deniedPermissions(['!report:view_sales'], 'CASHIER')).toEqual([]);
    expect(deniedPermissions(['!sale:create'], 'CASHIER')).toEqual(['sale:create']);
  });

  it('saves extras and revokes together, pruning stale denies', () => {
    expect(
      permissionPayloadToSave(
        ['report:view_sales'],
        'CASHIER',
        ['sale:create', 'settings:manage'],
      ),
    ).toEqual(['report:view_sales', '!sale:create']);
  });

  it('detects a revoke as a change and de-duplicates repeated denies', () => {
    const existing = { role: 'CASHIER', isActive: true, permissions: [...cashierDefaults] };
    expect(
      isStaffPermissionDraftUnchanged(existing, {
        role: 'CASHIER',
        isActive: true,
        permissions: [...cashierDefaults, '!sale:create', '!sale:create'],
      }),
    ).toBe(false);
    // Legacy duplicates of a deny are not a new change.
    expect(
      isStaffPermissionDraftUnchanged(
        { ...existing, permissions: ['!sale:create', '!sale:create'] },
        { role: 'CASHIER', isActive: true, permissions: ['!sale:create'] },
      ),
    ).toBe(true);
  });

  it('prunes a deny the selected role never inherited', () => {
    // shift:open is a manager default but not a factory-manager one, so the
    // deny only survives the role change that still inherits the key.
    expect(permissionPayloadToSave([], 'MANAGER', ['shift:open'])).toEqual(['!shift:open']);
    expect(permissionPayloadToSave([], 'FACTORY_MANAGER', ['shift:open'])).toEqual([]);
  });
});

describe('isStaffPermissionDraftUnchanged', () => {
  const existing = {
    role: 'CASHIER',
    isActive: true,
    // Legacy row that stores all 8 effective permissions, not just extras.
    permissions: [...cashierDefaults, 'report:view_sales'],
  };

  it('treats a legacy full set as unchanged against the same normalized extras', () => {
    expect(
      isStaffPermissionDraftUnchanged(existing, {
        role: 'CASHIER',
        isActive: true,
        permissions: [...cashierDefaults, 'report:view_sales'],
      }),
    ).toBe(true);
  });

  it('detects an added explicit extra', () => {
    expect(
      isStaffPermissionDraftUnchanged(existing, {
        role: 'CASHIER',
        isActive: true,
        permissions: [...cashierDefaults, 'report:view_sales', 'settings:view'],
      }),
    ).toBe(false);
  });

  it('detects a role change even when the extras are identical', () => {
    expect(
      isStaffPermissionDraftUnchanged(existing, {
        role: 'MANAGER',
        isActive: true,
        permissions: ['report:view_sales'],
      }),
    ).toBe(false);
  });

  it('detects an active-flag change', () => {
    expect(
      isStaffPermissionDraftUnchanged(existing, {
        role: 'CASHIER',
        isActive: false,
        permissions: ['report:view_sales'],
      }),
    ).toBe(false);
  });
});
