import { describe, expect, it } from 'vitest';

import {
  planCodBackfillRow,
  summarizeCodBackfill,
  type CodBackfillRow,
} from '@/lib/services/reconciliation-cod.core';

/**
 * ARGUS #511 — delivered unpaid COD parcels get one ledger entry for
 * goods + shipping; everything else is skipped.
 */
function row(overrides: Partial<CodBackfillRow> = {}): CodBackfillRow {
  return {
    id: 'd1',
    tenantId: 't1',
    orderRef: 'ORD-1',
    status: 'DELIVERED',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    codAmount: '1000.00',
    shippingFee: '350.00',
    hasEntry: false,
    waybillId: 'WB-1',
    ...overrides,
  };
}

describe('planCodBackfillRow', () => {
  it('creates a receivable for delivered unpaid COD with goods + shipping', () => {
    expect(planCodBackfillRow(row())).toEqual({
      action: 'create',
      expectedCod: '1350.00',
      reason: null,
    });
  });

  it('skips deliveries that already have an entry', () => {
    expect(planCodBackfillRow(row({ hasEntry: true })).action).toBe('skip-existing');
  });

  it('skips paid, non-COD and non-delivered rows', () => {
    expect(planCodBackfillRow(row({ paymentStatus: 'PAID' })).action).toBe('skip-not-eligible');
    expect(planCodBackfillRow(row({ paymentMethod: 'CARD' })).action).toBe('skip-not-eligible');
    expect(planCodBackfillRow(row({ status: 'IN_TRANSIT' })).action).toBe('skip-not-eligible');
  });

  it('skips a delivered COD parcel with nothing to collect', () => {
    expect(
      planCodBackfillRow(row({ codAmount: 0, shippingFee: 0 })).action,
    ).toBe('skip-not-eligible');
  });
});

describe('summarizeCodBackfill', () => {
  it('reports create/skip counts and the total to backfill', () => {
    const summary = summarizeCodBackfill([
      row({ id: 'a', codAmount: '1000.00', shippingFee: '350.00' }),
      row({ id: 'b', codAmount: '500.00', shippingFee: '0.00' }),
      row({ id: 'c', hasEntry: true }),
      row({ id: 'd', status: 'RETURNED' }),
    ]);

    expect(summary.createCount).toBe(2);
    expect(summary.existingCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.totalExpected).toBe('1850.00');
  });
});
