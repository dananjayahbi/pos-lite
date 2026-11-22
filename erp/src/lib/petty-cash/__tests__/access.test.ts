import { describe, expect, it } from 'vitest';

import { resolvePettyCashPageAccess } from '@/lib/petty-cash/access';
import { PERMISSIONS } from '@/lib/constants/permissions';

describe('resolvePettyCashPageAccess (ARGUS #409)', () => {
  it('denies the page to a cashier', () => {
    expect(resolvePettyCashPageAccess({ role: 'CASHIER' })).toEqual({
      canView: false,
      canManage: false,
      canManageSettings: false,
      canCreateExpense: false,
    });
  });

  it('grants owner the full surface and manager everything except fund settings', () => {
    expect(resolvePettyCashPageAccess({ role: 'OWNER' })).toEqual({
      canView: true,
      canManage: true,
      canManageSettings: true,
      canCreateExpense: true,
    });
    expect(resolvePettyCashPageAccess({ role: 'MANAGER' })).toEqual({
      canView: true,
      canManage: true,
      canManageSettings: false,
      canCreateExpense: true,
    });
  });

  it('keeps an explicit view-only override from exposing manage actions', () => {
    expect(
      resolvePettyCashPageAccess({
        role: 'CASHIER',
        permissions: [PERMISSIONS.PETTY_CASH.viewPettyCash],
      }),
    ).toEqual({
      canView: true,
      canManage: false,
      canManageSettings: false,
      canCreateExpense: false,
    });
  });

  it('returns all false for a missing user', () => {
    expect(resolvePettyCashPageAccess(null)).toEqual({
      canView: false,
      canManage: false,
      canManageSettings: false,
      canCreateExpense: false,
    });
  });
});
