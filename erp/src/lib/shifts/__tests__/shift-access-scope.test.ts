import { describe, expect, it } from 'vitest';

import {
  applyShiftListScope,
  isShiftInAccessScope,
  isShiftManagement,
  resolveShiftAccessScope,
} from '@/lib/shifts/shift-access-scope';

const base = {
  canAccessShifts: true,
  userId: 'cashier_1',
};

/**
 * ARGUS #111 — shift:view is held by cashiers, so the tenant-wide ledger must
 * be gated by management (role/history) instead.
 */
describe('resolveShiftAccessScope', () => {
  it('gives OWNER/MANAGER the tenant-wide ledger', () => {
    expect(
      resolveShiftAccessScope({
        ...base,
        role: 'OWNER',
        canViewSaleHistory: true,
        userId: 'owner_1',
      }),
    ).toEqual({ kind: 'tenant' });
    expect(
      resolveShiftAccessScope({
        ...base,
        role: 'MANAGER',
        canViewSaleHistory: false,
        userId: 'manager_1',
      }),
    ).toEqual({ kind: 'tenant' });
  });

  it('scopes a cashier (shift:view without history) to their own shift', () => {
    expect(
      resolveShiftAccessScope({
        ...base,
        role: 'CASHIER',
        canViewSaleHistory: false,
      }),
    ).toEqual({ kind: 'own', cashierId: 'cashier_1' });
  });

  it('treats an explicit sale:view_history grant as management', () => {
    expect(
      resolveShiftAccessScope({
        ...base,
        role: 'CASHIER',
        canViewSaleHistory: true,
      }),
    ).toEqual({ kind: 'tenant' });
  });

  it('forbids callers without any shift capability', () => {
    expect(
      resolveShiftAccessScope({
        ...base,
        canAccessShifts: false,
        role: 'OWNER',
        canViewSaleHistory: true,
      }),
    ).toEqual({ kind: 'forbidden' });
  });

  it('never infers management from shift:view alone', () => {
    expect(isShiftManagement('CASHIER', false)).toBe(false);
    expect(isShiftManagement(undefined, false)).toBe(false);
    expect(isShiftManagement('MANAGER', false)).toBe(true);
  });
});

describe('applyShiftListScope', () => {
  it('keeps management filters untouched, including a requested cashierId', () => {
    const filters = { cashierId: 'someone_else', status: 'OPEN', page: 1 };
    expect(applyShiftListScope(filters, { kind: 'tenant' })).toEqual(filters);
  });

  it('forces the caller id for a cashier and ignores a spoofed cashierId', () => {
    const filters = { cashierId: 'someone_else', status: 'CLOSED', page: 2 };
    expect(
      applyShiftListScope(filters, { kind: 'own', cashierId: 'cashier_1' }),
    ).toEqual({ cashierId: 'cashier_1', status: 'CLOSED', page: 2 });
  });

  it('keeps other filters when no cashierId was supplied', () => {
    expect(
      applyShiftListScope(
        { from: new Date('2026-01-01'), limit: 20 },
        { kind: 'own', cashierId: 'cashier_2' },
      ),
    ).toEqual({
      from: new Date('2026-01-01'),
      limit: 20,
      cashierId: 'cashier_2',
    });
  });
});

describe('isShiftInAccessScope', () => {
  it('allows management, own shifts only, and nothing when forbidden', () => {
    expect(isShiftInAccessScope({ kind: 'tenant' }, 'anyone')).toBe(true);
    expect(
      isShiftInAccessScope({ kind: 'own', cashierId: 'cashier_1' }, 'cashier_1'),
    ).toBe(true);
    expect(
      isShiftInAccessScope({ kind: 'own', cashierId: 'cashier_1' }, 'cashier_2'),
    ).toBe(false);
    expect(isShiftInAccessScope({ kind: 'forbidden' }, 'cashier_1')).toBe(false);
  });
});
