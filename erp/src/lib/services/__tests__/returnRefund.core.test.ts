import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { computeReturnRefund } from '@/lib/services/returnRefund.core';

const dec = (value: number | string) => new Decimal(value);

/**
 * ARGUS #90: a refund must include the tax that was collected. The first two
 * cases are the reported sales (single VAT line with an 18% tax of 375.12);
 * the second also carries a 475 delivery charge that stays non-refundable.
 */
describe('computeReturnRefund', () => {
  it('refunds the tax on a fully returned VAT line', () => {
    const result = computeReturnRefund(
      {
        lines: [
          {
            id: 'line-1',
            quantity: 1,
            lineTotalAfterDiscount: dec(2084),
            lineTax: dec('375.12'),
          },
        ],
        taxAmount: dec('375.12'),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    expect(result.lines[0]!.goodsRefund.toNumber()).toBe(2084);
    expect(result.lines[0]!.taxRefund.toNumber()).toBe(375.12);
    expect(result.totalRefund.toNumber()).toBe(2459.12);
    expect(result.totalTaxRefund.toNumber()).toBe(375.12);
  });

  it('does not refund the delivery charge', () => {
    const result = computeReturnRefund(
      {
        lines: [
          {
            id: 'line-1',
            quantity: 1,
            lineTotalAfterDiscount: dec(2084),
            lineTax: dec('375.12'),
          },
        ],
        taxAmount: dec('375.12'),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    // 2,084 goods + 375.12 VAT; the sale's 475 delivery is not included.
    expect(result.totalRefund.toNumber()).toBe(2459.12);
  });

  it('refunds a proportional share of goods and tax for a partial return', () => {
    const result = computeReturnRefund(
      {
        lines: [
          {
            id: 'line-1',
            quantity: 4,
            lineTotalAfterDiscount: dec(4000),
            lineTax: dec(720),
          },
        ],
        taxAmount: dec(720),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    expect(result.lines[0]!.goodsRefund.toNumber()).toBe(1000);
    expect(result.lines[0]!.taxRefund.toNumber()).toBe(180);
    expect(result.totalRefund.toNumber()).toBe(1180);
  });

  it('taxes each line by its own recorded share', () => {
    const result = computeReturnRefund(
      {
        lines: [
          { id: 'vat', quantity: 1, lineTotalAfterDiscount: dec(1000), lineTax: dec(180) },
          { id: 'exempt', quantity: 1, lineTotalAfterDiscount: dec(1000), lineTax: dec(0) },
        ],
        taxAmount: dec(180),
      },
      [
        { saleLineId: 'vat', quantity: 1 },
        { saleLineId: 'exempt', quantity: 1 },
      ],
    );

    expect(result.lines[0]!.taxRefund.toNumber()).toBe(180);
    expect(result.lines[1]!.taxRefund.toNumber()).toBe(0);
    expect(result.totalRefund.toNumber()).toBe(2180);
  });

  it('falls back to apportioning the sale tax for legacy rows without line tax', () => {
    const result = computeReturnRefund(
      {
        lines: [{ id: 'legacy', quantity: 1, lineTotalAfterDiscount: dec(2084) }],
        taxAmount: dec('375.12'),
      },
      [{ saleLineId: 'legacy', quantity: 1 }],
    );

    expect(result.totalTaxRefund.toNumber()).toBe(375.12);
    expect(result.totalRefund.toNumber()).toBe(2459.12);
  });

  it('apportions legacy tax without losing rounding cents', () => {
    const result = computeReturnRefund(
      {
        lines: [
          { id: 'a', quantity: 1, lineTotalAfterDiscount: dec('333.33') },
          { id: 'b', quantity: 1, lineTotalAfterDiscount: dec('666.67') },
        ],
        taxAmount: dec(100),
      },
      [
        { saleLineId: 'a', quantity: 1 },
        { saleLineId: 'b', quantity: 1 },
      ],
    );

    expect(result.totalTaxRefund.toNumber()).toBe(100);
    expect(result.totalRefund.toNumber()).toBe(1100);
  });

  it('refunds only the goods of an exempt sale', () => {
    const result = computeReturnRefund(
      {
        lines: [{ id: 'line-1', quantity: 1, lineTotalAfterDiscount: dec(500), lineTax: dec(0) }],
        taxAmount: dec(0),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    expect(result.totalTaxRefund.toNumber()).toBe(0);
    expect(result.totalRefund.toNumber()).toBe(500);
  });
});
