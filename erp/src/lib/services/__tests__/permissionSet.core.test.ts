import { describe, expect, it } from 'vitest';

import {
  effectivePermissions,
  extraPermissions,
  isStaffPermissionDraftUnchanged,
  normalizePermissionList,
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
