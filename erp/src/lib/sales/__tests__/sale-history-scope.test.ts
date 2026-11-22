import { describe, expect, it } from 'vitest';

import {
  applySaleHistoryScope,
  resolveSaleHistoryScope,
} from '@/lib/sales/sale-history-scope';

/**
 * ARGUS #78 — cashiers may call the sales endpoint for their own POS data, but
 * tenant-wide history requires the same permission as the /sales page.
 */
describe('resolveSaleHistoryScope', () => {
  it('gives a history-capable role tenant-wide scope', () => {
    expect(
      resolveSaleHistoryScope({
        canViewSale: true,
        canViewSaleHistory: true,
        userId: 'manager_1',
      }),
    ).toEqual({ kind: 'tenant' });
  });

  it('scopes a cashier (viewSale without history) to their own records', () => {
    expect(
      resolveSaleHistoryScope({
        canViewSale: true,
        canViewSaleHistory: false,
        userId: 'cashier_1',
      }),
    ).toEqual({ kind: 'cashier', cashierId: 'cashier_1' });
  });

  it('forbids callers without sale:view', () => {
    expect(
      resolveSaleHistoryScope({
        canViewSale: false,
        canViewSaleHistory: false,
        userId: 'clerk_1',
      }),
    ).toEqual({ kind: 'forbidden' });
    // History alone is not a valid substitute for the endpoint's base gate.
    expect(
      resolveSaleHistoryScope({
        canViewSale: false,
        canViewSaleHistory: true,
        userId: 'odd_1',
      }),
    ).toEqual({ kind: 'forbidden' });
  });
});

describe('applySaleHistoryScope', () => {
  it('keeps tenant-wide filters untouched, including a requested cashierId', () => {
    const filters = { cashierId: 'someone_else', shiftId: 'shift_1', status: 'OPEN' };
    expect(applySaleHistoryScope(filters, { kind: 'tenant' })).toEqual(filters);
  });

  it('forces the caller id for a cashier and ignores a spoofed cashierId', () => {
    const filters = { cashierId: 'someone_else', shiftId: 'shift_1', status: 'OPEN' };
    expect(
      applySaleHistoryScope(filters, { kind: 'cashier', cashierId: 'cashier_1' }),
    ).toEqual({ cashierId: 'cashier_1', shiftId: 'shift_1', status: 'OPEN' });
  });

  it('keeps the POS shift filter while scoping to the cashier', () => {
    const filters = { shiftId: 'shift_9', status: 'OPEN' };
    expect(
      applySaleHistoryScope(filters, { kind: 'cashier', cashierId: 'cashier_2' }),
    ).toEqual({ shiftId: 'shift_9', status: 'OPEN', cashierId: 'cashier_2' });
  });
});
