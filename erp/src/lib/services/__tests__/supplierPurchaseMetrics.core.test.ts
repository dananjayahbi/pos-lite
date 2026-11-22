import { describe, expect, it } from 'vitest';

import { summarizeSupplierPurchaseOrders } from '@/lib/services/supplierPurchaseMetrics.core';

describe('supplier purchase metrics (ARGUS #239)', () => {
  it('splits an all-status count into lifecycle buckets', () => {
    const summary = summarizeSupplierPurchaseOrders([
      { status: 'DRAFT', totalAmount: 100 },
      { status: 'DRAFT', totalAmount: 200 },
      { status: 'SENT', totalAmount: 300 },
      { status: 'PARTIALLY_RECEIVED', totalAmount: 400 },
      { status: 'RECEIVED', totalAmount: 500 },
      { status: 'CANCELLED', totalAmount: 900 },
    ]);

    expect(summary).toMatchObject({
      total: 6,
      draft: 2,
      open: 2,
      received: 1,
      cancelled: 1,
    });
  });

  it('counts committed value but not drafts or cancellations', () => {
    const summary = summarizeSupplierPurchaseOrders([
      { status: 'DRAFT', totalAmount: 100 },
      { status: 'SENT', totalAmount: 300, paidAmount: 100 },
      { status: 'CANCELLED', totalAmount: 900 },
    ]);
    expect(summary.committedValue).toBe(300);
    expect(summary.outstandingValue).toBe(200);
  });

  it('never reports a negative balance after an overpayment', () => {
    expect(
      summarizeSupplierPurchaseOrders([
        { status: 'RECEIVED', totalAmount: 100, paidAmount: 150 },
      ]).outstandingValue,
    ).toBe(0);
  });
});
