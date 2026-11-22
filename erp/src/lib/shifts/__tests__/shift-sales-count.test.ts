import { describe, expect, it } from 'vitest';

import {
  SHIFT_SALES_LABELS,
  emptyShiftSales,
  groupShiftSalesByShift,
  shiftSalesDetailLabel,
  summarizeShiftSales,
} from '@/lib/shifts/shift-sales-count';

/**
 * ARGUS #110 — voided/held rows are transactions, never "Sales". These tests
 * pin the definition the closure/Z-report already uses (COMPLETED only).
 */
describe('summarizeShiftSales', () => {
  it('counts completed, voided and held rows separately (the 56 vs 10 case)', () => {
    const summary = summarizeShiftSales([
      ...Array.from({ length: 10 }, () => 'COMPLETED'),
      ...Array.from({ length: 46 }, () => 'VOIDED'),
    ]);

    expect(summary).toEqual({ completed: 10, voided: 46, held: 0, total: 56 });
    expect(shiftSalesDetailLabel(summary)).toBe('46 voided');
  });

  it('counts held (OPEN) sales without treating them as completed', () => {
    const summary = summarizeShiftSales(['OPEN', 'OPEN', 'COMPLETED']);

    expect(summary).toEqual({ completed: 1, voided: 0, held: 2, total: 3 });
    expect(shiftSalesDetailLabel(summary)).toBe('2 held');
  });

  it('reports zero for an empty shift', () => {
    expect(summarizeShiftSales([])).toEqual({
      completed: 0,
      voided: 0,
      held: 0,
      total: 0,
    });
    expect(shiftSalesDetailLabel(emptyShiftSales())).toBe('');
  });

  it('combines voided and held in the detail label', () => {
    const summary = summarizeShiftSales(['VOIDED', 'OPEN', 'COMPLETED', 'COMPLETED']);

    expect(summary).toEqual({ completed: 2, voided: 1, held: 1, total: 4 });
    expect(shiftSalesDetailLabel(summary)).toBe('1 voided · 1 held');
  });

  it('labels the all-status figure as transactions, not sales', () => {
    expect(SHIFT_SALES_LABELS.transactions).toBe('Transactions');
    expect(SHIFT_SALES_LABELS.completed).toBe('Completed sales');
  });
});

describe('groupShiftSalesByShift', () => {
  it('groups aggregated rows per shift and ignores rows without a shift', () => {
    const byShift = groupShiftSalesByShift([
      { shiftId: 'shift_a', status: 'COMPLETED', count: 10 },
      { shiftId: 'shift_a', status: 'VOIDED', count: 46 },
      { shiftId: 'shift_b', status: 'COMPLETED', count: 1 },
      { shiftId: 'shift_b', status: 'VOIDED', count: 10 },
      { shiftId: null, status: 'COMPLETED', count: 5 },
    ]);

    expect(byShift.get('shift_a')).toEqual({
      completed: 10,
      voided: 46,
      held: 0,
      total: 56,
    });
    expect(byShift.get('shift_b')).toEqual({
      completed: 1,
      voided: 10,
      held: 0,
      total: 11,
    });
    expect(byShift.size).toBe(2);
  });

  it('returns an empty map when there are no rows', () => {
    expect(groupShiftSalesByShift([]).size).toBe(0);
  });
});
