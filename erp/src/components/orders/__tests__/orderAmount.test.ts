import { describe, expect, it } from 'vitest';

import {
  deliverySourceLabel,
  orderAmountSummary,
  paymentMethodLabel,
  paymentStatusLabel,
  totalToCollect,
} from '@/components/orders/orderAmount';

/**
 * ARGUS #266 - the table used to show goods-only COD without source or payment
 * state, so a paid card order and a zero-value manual order looked the same.
 */
describe('totalToCollect', () => {
  it('collects goods plus the stored shipping fee on an unpaid COD order', () => {
    expect(
      totalToCollect({
        codAmount: '500.00',
        shippingFee: '100.00',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      }).toFixed(2),
    ).toBe('600.00');
  });

  it('collects shipping even when the goods value is zero', () => {
    expect(
      totalToCollect({
        codAmount: '0.00',
        shippingFee: '575.00',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      }).toFixed(2),
    ).toBe('575.00');
  });

  it('collects nothing on a prepaid card order', () => {
    const summary = orderAmountSummary({
      codAmount: '500.00',
      shippingFee: '100.00',
      paymentMethod: 'CARD',
      paymentStatus: 'PAID',
    });
    expect(summary.isPrepaid).toBe(true);
    expect(summary.totalToCollect.toNumber()).toBe(0);
  });

  it('distinguishes a zero-value manual order from a paid card order', () => {
    const paid = orderAmountSummary({ codAmount: 0, paymentMethod: 'CARD', paymentStatus: 'PAID' });
    const manual = orderAmountSummary({ codAmount: 0, paymentMethod: 'COD', paymentStatus: 'PENDING' });
    expect(paid.isPrepaid).toBe(true);
    expect(manual.isPrepaid).toBe(false);
    expect(paid.totalToCollect.toNumber()).toBe(manual.totalToCollect.toNumber());
  });

  it('treats a missing shipping fee as zero', () => {
    expect(totalToCollect({ codAmount: 500 }).toFixed(2)).toBe('500.00');
  });

  it('keeps the goods, shipping and declared values for display', () => {
    const summary = orderAmountSummary({
      codAmount: '500.00',
      shippingFee: '100.00',
      declaredValue: '750.00',
    });
    expect(summary.goodsAmount.toFixed(2)).toBe('500.00');
    expect(summary.shippingFee.toFixed(2)).toBe('100.00');
    expect(summary.declaredValue?.toFixed(2)).toBe('750.00');
  });
});

describe('order table labels', () => {
  it('labels delivery sources', () => {
    expect(deliverySourceLabel('WEBSITE_CHECKOUT')).toBe('Website');
    expect(deliverySourceLabel('ERP_MANUAL')).toBe('Manual');
    expect(deliverySourceLabel('POS')).toBe('POS');
    expect(deliverySourceLabel('IMPORT')).toBe('Import');
    expect(deliverySourceLabel(null)).toBe('-');
  });

  it('labels payment methods', () => {
    expect(paymentMethodLabel('COD')).toBe('COD');
    expect(paymentMethodLabel('CARD')).toBe('Card');
    expect(paymentMethodLabel(null)).toBe('No method');
  });

  it('labels payment statuses', () => {
    expect(paymentStatusLabel('PAID')).toBe('Paid');
    expect(paymentStatusLabel('PENDING')).toBe('Pending');
    expect(paymentStatusLabel('FAILED')).toBe('Failed');
    expect(paymentStatusLabel('REFUNDED')).toBe('Refunded');
    expect(paymentStatusLabel(null)).toBe('Unknown');
  });
});
