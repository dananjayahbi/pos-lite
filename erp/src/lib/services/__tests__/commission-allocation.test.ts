import { describe, expect, it } from 'vitest';
import {
  allocateCommissionPayment,
  summarizeOpenCommission,
} from '@/lib/services/commission-allocation';

const jan1 = new Date('2026-01-01T00:00:00Z');
const jan2 = new Date('2026-01-02T00:00:00Z');
const jan3 = new Date('2026-01-03T00:00:00Z');

describe('summarizeOpenCommission', () => {
  it('computes the outstanding balance per record and in total', () => {
    const { netOutstanding, records } = summarizeOpenCommission([
      { id: 'a', earnedAmount: '100.00', paidAmount: '40.00', createdAt: jan1 },
      { id: 'b', earnedAmount: '50.00', paidAmount: '0.00', createdAt: jan2 },
    ]);
    expect(netOutstanding.toFixed(2)).toBe('110.00');
    expect(records.map((record) => record.id)).toEqual(['a', 'b']);
    expect(records[0]!.outstanding.toFixed(2)).toBe('60.00');
  });

  it('respects negative return adjustments', () => {
    const { netOutstanding } = summarizeOpenCommission([
      { id: 'sale', earnedAmount: '100.00', paidAmount: '0.00', createdAt: jan1 },
      { id: 'return', earnedAmount: '-20.00', paidAmount: '0.00', createdAt: jan2 },
    ]);
    expect(netOutstanding.toFixed(2)).toBe('80.00');
  });
});

describe('allocateCommissionPayment', () => {
  it('allocates a partial payment oldest-first and leaves the remainder open', () => {
    const { records } = summarizeOpenCommission([
      { id: 'a', earnedAmount: '100.00', paidAmount: '40.00', createdAt: jan1 },
      { id: 'b', earnedAmount: '50.00', paidAmount: '0.00', createdAt: jan2 },
    ]);

    const allocations = allocateCommissionPayment(records, '70.00');
    expect(allocations).toEqual([
      { id: 'a', newPaid: '100.00', isPaid: true },
      { id: 'b', newPaid: '10.00', isPaid: false },
    ]);
  });

  it('settles every record when the payment covers the net outstanding', () => {
    const { netOutstanding, records } = summarizeOpenCommission([
      { id: 'sale', earnedAmount: '100.00', paidAmount: '20.00', createdAt: jan1 },
      { id: 'return', earnedAmount: '-20.00', paidAmount: '0.00', createdAt: jan2 },
    ]);
    expect(netOutstanding.toFixed(2)).toBe('60.00');

    const allocations = allocateCommissionPayment(records, '60.00');
    expect(allocations).toEqual([
      { id: 'sale', newPaid: '100.00', isPaid: true },
      { id: 'return', newPaid: '-20.00', isPaid: true },
    ]);
  });

  it('supports the 144.39 → 100 + 44.39 split from the client request', () => {
    const { records } = summarizeOpenCommission([
      { id: 'only', earnedAmount: '144.39', paidAmount: '0.00', createdAt: jan1 },
    ]);

    const first = allocateCommissionPayment(records, '100.00');
    expect(first).toEqual([{ id: 'only', newPaid: '100.00', isPaid: false }]);

    const afterFirst = summarizeOpenCommission([
      { id: 'only', earnedAmount: '144.39', paidAmount: first[0]!.newPaid, createdAt: jan1 },
    ]);
    expect(afterFirst.netOutstanding.toFixed(2)).toBe('44.39');

    const second = allocateCommissionPayment(afterFirst.records, '44.39');
    expect(second).toEqual([{ id: 'only', newPaid: '144.39', isPaid: true }]);
  });

  it('does not allocate past the requested amount', () => {
    const { records } = summarizeOpenCommission([
      { id: 'a', earnedAmount: '10.00', paidAmount: '0.00', createdAt: jan1 },
      { id: 'b', earnedAmount: '10.00', paidAmount: '0.00', createdAt: jan2 },
      { id: 'c', earnedAmount: '10.00', paidAmount: '0.00', createdAt: jan3 },
    ]);

    const allocations = allocateCommissionPayment(records, '15.00');
    expect(allocations).toEqual([
      { id: 'a', newPaid: '10.00', isPaid: true },
      { id: 'b', newPaid: '5.00', isPaid: false },
    ]);
  });
});
