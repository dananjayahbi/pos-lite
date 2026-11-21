import { describe, expect, it } from 'vitest';

import { collectableCodAmount, isPrepaidOrder } from '@/lib/delivery/cod';

/**
 * ARGUS #288 — shipping is charged at checkout but was excluded from COD, so
 * the courier collected goods only and reconciliation then deducted the fee
 * from that payout. One rule: COD/unpaid parcels collect goods + shipping.
 */
describe('collectableCodAmount', () => {
  it('collects goods plus shipping on a COD order', () => {
    // QA-INV-LINES: Subtotal 500, Shipping 100, Grand Total 600.
    expect(
      collectableCodAmount({
        codAmount: '500.00',
        shippingFee: '100.00',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      }).toFixed(2),
    ).toBe('600.00');
  });

  it('collects shipping even when the goods value is zero', () => {
    // DEL-2026-000024: Subtotal 0, Shipping 575, Grand Total 575.
    expect(
      collectableCodAmount({
        codAmount: '0.00',
        shippingFee: '575.00',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      }).toFixed(2),
    ).toBe('575.00');
  });

  it('collects nothing on a prepaid order', () => {
    expect(
      collectableCodAmount({
        codAmount: '500.00',
        shippingFee: '100.00',
        paymentMethod: 'CARD',
        paymentStatus: 'PAID',
      }).toNumber(),
    ).toBe(0);
  });

  it('treats a missing shipping fee as zero (legacy deliveries)', () => {
    expect(collectableCodAmount({ codAmount: '500.00' }).toNumber()).toBe(500);
  });

  it('floors negative components at zero', () => {
    expect(
      collectableCodAmount({ codAmount: -50, shippingFee: 100 }).toNumber(),
    ).toBe(100);
    expect(
      collectableCodAmount({ codAmount: 100, shippingFee: -20 }).toNumber(),
    ).toBe(100);
  });

  it('rounds to paise', () => {
    expect(
      collectableCodAmount({ codAmount: '10.005', shippingFee: '0.005' }).toFixed(2),
    ).toBe('10.01');
  });

  it('accepts Decimal-like values from Prisma', () => {
    expect(
      collectableCodAmount({
        codAmount: { toString: () => '475.00' },
        shippingFee: { toString: () => '100.00' },
      }).toFixed(2),
    ).toBe('575.00');
  });
});

describe('isPrepaidOrder', () => {
  it('is true only for PAID orders', () => {
    expect(isPrepaidOrder({ paymentStatus: 'PAID' })).toBe(true);
    expect(isPrepaidOrder({ paymentStatus: 'PENDING' })).toBe(false);
    expect(isPrepaidOrder({})).toBe(false);
  });
});
