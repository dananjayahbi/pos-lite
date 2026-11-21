import { describe, expect, it } from 'vitest';

import { toPackagingHistoryRow } from '@/lib/packaging/packagingHistory.core';

/** ARGUS #281: the consumption ledger must be readable, not just balances. */
describe('toPackagingHistoryRow', () => {
  const base = {
    id: 'cons_1',
    deliveryId: 'del_123456789',
    orderRef: 'ORD-2026-0007',
    saleId: 'sale_1',
    packagingItemId: 'item_1',
    itemName: 'Bubble Wrap 50m',
    itemSku: 'BUBB-BUBBLE-WRAP-50M',
    unit: 'METER',
    quantity: '2.50',
    createdAt: '2026-11-20T10:15:00.000Z',
  };

  it('keeps the delivery/order reference, item, quantity and timestamp', () => {
    expect(toPackagingHistoryRow(base)).toEqual({
      id: 'cons_1',
      deliveryId: 'del_123456789',
      reference: 'ORD-2026-0007',
      orderRef: 'ORD-2026-0007',
      saleId: 'sale_1',
      itemId: 'item_1',
      itemName: 'Bubble Wrap 50m',
      itemSku: 'BUBB-BUBBLE-WRAP-50M',
      unit: 'METER',
      quantity: 2.5,
      quantityLabel: '2.5 m',
      createdAt: '2026-11-20T10:15:00.000Z',
    });
  });

  it('falls back to the delivery id when an order reference is missing', () => {
    expect(toPackagingHistoryRow({ ...base, orderRef: null }).reference).toBe('del_123456789');
    expect(toPackagingHistoryRow({ ...base, orderRef: '   ' }).reference).toBe('del_123456789');
  });

  it('formats a piece quantity with its compact unit', () => {
    expect(
      toPackagingHistoryRow({ ...base, unit: 'PIECE', quantity: 3 }).quantityLabel,
    ).toBe('3 pcs');
  });
});
