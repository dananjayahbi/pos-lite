import { describe, expect, it } from 'vitest';

import {
  countPermissionOverrides,
  filterPermissionGroups,
  grantGroupExtras,
  matchesPermissionQuery,
  permissionLabel,
  resetGroupPermissions,
  summarizePermissionOverrides,
} from '@/lib/services/permissionGrid.core';

/** ARGUS #466: searchable/collapsible grid, bulk actions and dirty summary. */
const groups = [
  {
    group: 'SALE',
    label: 'Sales',
    permissions: ['sale:create', 'sale:void', 'sale:receipt:reprint'],
  },
  {
    group: 'STAFF',
    label: 'Staff',
    permissions: ['staff:manage', 'staff:permissions:assign'],
  },
];
const cashierDefaults = ['sale:create'];
const inherited = new Set(cashierDefaults);
const grantable = new Set([
  'sale:create',
  'sale:void',
  'sale:receipt:reprint',
  'staff:manage',
  'staff:permissions:assign',
]);

describe('permission grid search', () => {
  it('derives a readable label from a key', () => {
    expect(permissionLabel('sale:receipt:reprint')).toBe('receipt reprint');
  });

  it('matches both the key and the label, ignoring case and padding', () => {
    expect(matchesPermissionQuery('sale:receipt:reprint', ' REPRINT ')).toBe(true);
    expect(matchesPermissionQuery('sale:receipt:reprint', 'sale:receipt')).toBe(true);
    expect(matchesPermissionQuery('sale:receipt:reprint', 'staff')).toBe(false);
    expect(matchesPermissionQuery('sale:create', '   ')).toBe(true);
  });

  it('drops groups with no matching permission', () => {
    const hits = filterPermissionGroups(groups, 'void');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.group).toBe('SALE');
    expect(hits[0]!.permissions).toEqual(['sale:void']);
    expect(filterPermissionGroups(groups, 'nothing')).toEqual([]);
  });
});

describe('bulk group actions', () => {
  it('grafts grantable extras and restores denied role defaults', () => {
    const next = grantGroupExtras({
      permissions: [],
      denied: ['sale:create'],
      groupPermissions: groups[0]!.permissions,
      inherited,
      grantable,
    });
    expect(next.changed).toBe(true);
    expect(next.permissions.sort()).toEqual(['sale:receipt:reprint', 'sale:void']);
    expect(next.denied).toEqual([]);
  });

  it('leaves non-grantable keys alone', () => {
    const next = grantGroupExtras({
      permissions: [],
      denied: [],
      groupPermissions: ['staff:manage'],
      inherited,
      grantable: new Set<string>(),
    });
    expect(next).toEqual({ permissions: [], denied: [], changed: false });
  });

  it('resets only the group being reset', () => {
    const next = resetGroupPermissions({
      permissions: ['sale:void', 'staff:manage'],
      denied: ['sale:create'],
      groupPermissions: groups[0]!.permissions,
    });
    expect(next.permissions).toEqual(['staff:manage']);
    expect(next.denied).toEqual([]);
    expect(next.changed).toBe(true);
  });
});

describe('roster override summary', () => {
  it('counts extras and revokes against the role defaults', () => {
    expect(
      countPermissionOverrides(
        ['sale:void', 'sale:void', '!sale:create', '!staff:manage'],
        'CASHIER',
        cashierDefaults,
      ),
    ).toEqual({ explicit: 1, revoked: 1 });
  });

  it('names the overrides and caps long lists', () => {
    const summary = summarizePermissionOverrides(
      ['staff:manage', '!sale:create', 'sale:void', 'report:view_sales'],
      cashierDefaults,
      2,
    );
    expect(summary.explicit).toEqual(['report:view_sales', 'sale:void', 'staff:manage']);
    expect(summary.revoked).toEqual(['sale:create']);
    expect(summary.truncated).toBe(true);
    expect(summary.text).toBe('+report:view_sales, +sale:void +2 more');
  });

  it('says role defaults only when nothing is stored', () => {
    expect(summarizePermissionOverrides([], cashierDefaults).text).toBe('Role defaults only');
    expect(summarizePermissionOverrides(['sale:create'], cashierDefaults).text).toBe(
      'Role defaults only',
    );
  });
});
