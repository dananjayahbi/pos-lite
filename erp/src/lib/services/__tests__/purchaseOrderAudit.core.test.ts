import { describe, expect, it } from 'vitest';

import { purchaseOrderAuditSnapshot } from '@/lib/services/purchaseOrderAudit.core';

/** ARGUS #229: audit snapshots must flatten Prisma Decimal/Date values. */
describe('purchaseOrderAuditSnapshot', () => {
  it('converts Decimal-like amounts and dates to JSON primitives', () => {
    const snapshot = purchaseOrderAuditSnapshot({
      referenceNo: 'PO-202610-0002',
      status: 'PARTIALLY_RECEIVED',
      supplierId: 'sup_1',
      orderDate: new Date('2026-10-29T06:30:00.000Z'),
      expectedDeliveryDate: null,
      subtotalAmount: { toString: () => '4304.00' },
      discountType: 'FIXED',
      discountValue: { toString: () => '4.00' },
      discountAmount: { toString: () => '4.00' },
      totalAmount: { toString: () => '4300.00' },
      paymentTermDays: 30,
      notes: null,
    });

    expect(snapshot).toEqual({
      referenceNo: 'PO-202610-0002',
      status: 'PARTIALLY_RECEIVED',
      supplierId: 'sup_1',
      orderDate: '2026-10-29T06:30:00.000Z',
      expectedDeliveryDate: null,
      subtotalAmount: 4304,
      discountType: 'FIXED',
      discountValue: 4,
      discountAmount: 4,
      totalAmount: 4300,
      paymentTermDays: 30,
      notes: null,
    });
  });

  it('accepts numbers and ISO strings', () => {
    const snapshot = purchaseOrderAuditSnapshot({
      referenceNo: 'PO-1',
      status: 'DRAFT',
      supplierId: 'sup_1',
      orderDate: '2026-10-29T06:30:00.000Z',
      subtotalAmount: 100,
      discountValue: 0,
      discountAmount: 0,
      totalAmount: '100.00',
    });

    expect(snapshot.orderDate).toBe('2026-10-29T06:30:00.000Z');
    expect(snapshot.totalAmount).toBe(100);
    expect(snapshot.expectedDeliveryDate).toBeNull();
    expect(snapshot.discountType).toBeNull();
    expect(snapshot.notes).toBeNull();
  });

  it('falls back to zero for unusable amounts instead of emitting NaN', () => {
    const snapshot = purchaseOrderAuditSnapshot({
      referenceNo: 'PO-2',
      status: 'SENT',
      supplierId: 'sup_1',
      orderDate: 'not-a-date',
      subtotalAmount: 'abc',
      discountValue: 0,
      discountAmount: 0,
      totalAmount: 0,
    });

    expect(snapshot.orderDate).toBe('');
    expect(snapshot.subtotalAmount).toBe(0);
  });
});
