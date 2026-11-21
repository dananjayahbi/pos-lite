import { describe, expect, it } from 'vitest';
import { saleBreakdown } from '@/lib/pos/saleBreakdown';

describe('saleBreakdown', () => {
  // ARGUS #75 — CMWGJR8W: the old modal subtracted the line discounts a
  // second time (sub-total is already net of them), so its rows summed to
  // 4,686.28 instead of the recorded 5,173.42.
  it('reconciles a sale that carries line discounts (CMWGJR8W)', () => {
    const breakdown = saleBreakdown({
      subtotal: 4384.26,
      discountAmount: 0.01,
      taxAmount: 789.17,
      deliveryCharge: 0,
      totalAmount: 5173.42,
    });

    expect(breakdown.rows.map((row) => row.key)).toEqual(['subtotal', 'discount', 'tax']);
    expect(breakdown.rowsTotal).toBe(5173.42);
    expect(breakdown.recordedTotal).toBe(5173.42);
    expect(breakdown.reconciles).toBe(true);
  });

  // ARGUS #75 — CMVS9AY1: the old modal dropped the Rs 400 delivery charge,
  // so its rows summed to 1,491.76 instead of the recorded 1,891.76.
  it('includes delivery so the rows reach the total (CMVS9AY1)', () => {
    const breakdown = saleBreakdown({
      subtotal: 1264.2,
      discountAmount: 0,
      taxAmount: 227.56,
      deliveryCharge: 400,
      totalAmount: 1891.76,
    });

    expect(breakdown.rows.map((row) => row.key)).toEqual(['subtotal', 'tax', 'delivery']);
    expect(breakdown.rowsTotal).toBe(1891.76);
    expect(breakdown.reconciles).toBe(true);
  });

  it('never emits a line-discount row', () => {
    const breakdown = saleBreakdown({
      subtotal: 100,
      discountAmount: 10,
      taxAmount: 5,
      deliveryCharge: 20,
      totalAmount: 115,
    });

    expect(breakdown.rows.some((row) => row.key === 'discount')).toBe(true);
    expect(breakdown.rows.map((row) => row.label)).not.toContain('Line Discounts');
    expect(breakdown.reconciles).toBe(true);
  });

  it('accepts Decimal-as-string values from the API', () => {
    const breakdown = saleBreakdown({
      subtotal: '1264.20',
      discountAmount: '0',
      taxAmount: '227.56',
      deliveryCharge: '400.00',
      totalAmount: '1891.76',
    });

    expect(breakdown.rowsTotal).toBe(1891.76);
    expect(breakdown.reconciles).toBe(true);
  });

  it('treats a plain subtotal-plus-tax sale as reconciling', () => {
    const breakdown = saleBreakdown({
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 150,
      totalAmount: 1150,
    });

    expect(breakdown.rows.map((row) => row.key)).toEqual(['subtotal', 'tax']);
    expect(breakdown.rowsTotal).toBe(1150);
  });

  it('reports a mismatch instead of hiding it', () => {
    const breakdown = saleBreakdown({
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 150,
      totalAmount: 1200,
    });

    expect(breakdown.rowsTotal).toBe(1150);
    expect(breakdown.recordedTotal).toBe(1200);
    expect(breakdown.reconciles).toBe(false);
  });

  it('reports an unknown reconciliation when no total is supplied', () => {
    const breakdown = saleBreakdown({ subtotal: 100 });

    expect(breakdown.rowsTotal).toBe(100);
    expect(breakdown.recordedTotal).toBeNull();
    expect(breakdown.reconciles).toBeNull();
  });

  it('floors malformed amounts to zero rather than rendering NaN', () => {
    const breakdown = saleBreakdown({
      subtotal: 100,
      discountAmount: 'not-a-number',
      taxAmount: null,
      deliveryCharge: undefined,
      totalAmount: 100,
    });

    expect(breakdown.rows).toHaveLength(1);
    expect(breakdown.rowsTotal).toBe(100);
    expect(breakdown.reconciles).toBe(true);
  });
});
