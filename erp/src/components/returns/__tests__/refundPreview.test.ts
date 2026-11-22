import { describe, expect, it } from 'vitest';

import { buildReturnRefundPreview } from '@/components/returns/refundPreview';
import type { RefundSaleForPricing } from '@/lib/services/returnRefund.core';

/**
 * ARGUS #99 — the preview must include line refunds, the cart discount and the
 * tax that was collected, matching the server calculation.
 */
const sale: RefundSaleForPricing = {
  lines: [
    { id: 'a', quantity: 2, lineTotalAfterDiscount: '200.00', lineTax: '20.00' },
    { id: 'b', quantity: 1, lineTotalAfterDiscount: '100.00', lineTax: '10.00' },
  ],
  taxAmount: '30.00',
  discountAmount: '0.00',
};

describe('buildReturnRefundPreview', () => {
  it('returns zero lines when nothing is selected', () => {
    expect(buildReturnRefundPreview(sale, [])).toEqual({
      lines: [],
      goodsSubtotal: '0.00',
      taxTotal: '0.00',
      totalRefund: '0.00',
    });
  });

  it('shows a partial line refund including its tax share', () => {
    const preview = buildReturnRefundPreview(sale, [{ saleLineId: 'a', quantity: 1 }]);
    expect(preview.lines).toEqual([
      {
        saleLineId: 'a',
        quantity: 1,
        goodsRefund: '100.00',
        taxRefund: '10.00',
        lineRefundAmount: '110.00',
      },
    ]);
    expect(preview.goodsSubtotal).toBe('100.00');
    expect(preview.taxTotal).toBe('10.00');
    expect(preview.totalRefund).toBe('110.00');
  });

  it('adds multiple partial lines to a subtotal/tax/total', () => {
    const preview = buildReturnRefundPreview(sale, [
      { saleLineId: 'a', quantity: 2 },
      { saleLineId: 'b', quantity: 1 },
    ]);
    expect(preview.lines.map((line) => line.lineRefundAmount)).toEqual(['220.00', '110.00']);
    expect(preview.goodsSubtotal).toBe('300.00');
    expect(preview.taxTotal).toBe('30.00');
    expect(preview.totalRefund).toBe('330.00');
  });

  it('uses the post-cart-discount base, not the list line total', () => {
    const discounted: RefundSaleForPricing = {
      lines: [
        { id: 'a', quantity: 2, lineTotalAfterDiscount: '200.00', lineTax: '0' },
        { id: 'b', quantity: 1, lineTotalAfterDiscount: '100.00', lineTax: '0' },
      ],
      taxAmount: '30.00',
      discountAmount: '60.00',
    };

    const preview = buildReturnRefundPreview(discounted, [{ saleLineId: 'a', quantity: 1 }]);
    expect(preview.lines[0]).toMatchObject({
      goodsRefund: '80.00',
      taxRefund: '10.00',
      lineRefundAmount: '90.00',
    });
    expect(preview.totalRefund).toBe('90.00');
  });

  it('full return equals the post-discount goods plus recorded tax', () => {
    const discounted: RefundSaleForPricing = {
      lines: [
        { id: 'a', quantity: 2, lineTotalAfterDiscount: '200.00', lineTax: '0' },
        { id: 'b', quantity: 1, lineTotalAfterDiscount: '100.00', lineTax: '0' },
      ],
      taxAmount: '30.00',
      discountAmount: '60.00',
    };
    const preview = buildReturnRefundPreview(discounted, [
      { saleLineId: 'a', quantity: 2 },
      { saleLineId: 'b', quantity: 1 },
    ]);
    expect(preview.goodsSubtotal).toBe('240.00');
    expect(preview.taxTotal).toBe('30.00');
    expect(preview.totalRefund).toBe('270.00');
  });
});
