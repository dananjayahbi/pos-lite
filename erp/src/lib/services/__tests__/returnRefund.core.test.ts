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

/**
 * ARGUS #91: the sale's cart-level discount had to be apportioned across the
 * lines too. Without it a zero-value (100% discounted) sale refunded its list
 * price.
 */
describe('computeReturnRefund - cart-level discounts', () => {
  it('refunds nothing for a fully discounted zero-value sale', () => {
    const result = computeReturnRefund(
      {
        lines: [
          {
            id: 'line-1',
            quantity: 1,
            lineTotalAfterDiscount: dec('2098.80'),
            lineTax: dec(0),
          },
        ],
        discountAmount: dec('2098.80'),
        taxAmount: dec(0),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    expect(result.lines[0]!.goodsRefund.toNumber()).toBe(0);
    expect(result.totalRefund.toNumber()).toBe(0);
  });

  it('refunds the paid amount after a partial cart discount', () => {
    const result = computeReturnRefund(
      {
        lines: [
          {
            id: 'line-1',
            quantity: 1,
            lineTotalAfterDiscount: dec('2098.80'),
            lineTax: dec('340.01'),
          },
        ],
        discountAmount: dec('209.88'),
        taxAmount: dec('340.01'),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    // 2,098.80 − 209.88 = 1,888.92 paid; + 340.01 VAT.
    expect(result.lines[0]!.goodsRefund.toNumber()).toBe(1888.92);
    expect(result.totalRefund.toNumber()).toBe(2228.93);
  });

  it('splits the cart discount across mixed lines before refunding', () => {
    const sale = {
      lines: [
        { id: 'vat', quantity: 1, lineTotalAfterDiscount: dec(2000), lineTax: dec('345.60') },
        { id: 'exempt', quantity: 1, lineTotalAfterDiscount: dec(500), lineTax: dec(0) },
      ],
      discountAmount: dec(100),
      taxAmount: dec('345.60'),
    };

    const full = computeReturnRefund(sale, [
      { saleLineId: 'vat', quantity: 1 },
      { saleLineId: 'exempt', quantity: 1 },
    ]);

    // 2,500 − 100 discount = 2,400 paid, + 345.60 tax = sale total.
    expect(full.totalRefund.toNumber()).toBe(2745.6);

    const vatOnly = computeReturnRefund(sale, [{ saleLineId: 'vat', quantity: 1 }]);
    expect(vatOnly.lines[0]!.goodsRefund.toNumber()).toBe(1920);
    expect(vatOnly.totalRefund.toNumber()).toBe(2265.6);
  });

  it('allocates the discount proportionally for a partial quantity return', () => {
    const result = computeReturnRefund(
      {
        lines: [
          {
            id: 'line-1',
            quantity: 2,
            lineTotalAfterDiscount: dec(2000),
            lineTax: dec(324),
          },
        ],
        discountAmount: dec(200),
        taxAmount: dec(324),
      },
      [{ saleLineId: 'line-1', quantity: 1 }],
    );

    // (2,000 − 200) / 2 = 900 paid; tax 324 / 2 = 162.
    expect(result.lines[0]!.goodsRefund.toNumber()).toBe(900);
    expect(result.lines[0]!.taxRefund.toNumber()).toBe(162);
    expect(result.totalRefund.toNumber()).toBe(1062);
  });

  it('never refunds more than the sale total for a full return', () => {
    const sale = {
      lines: [
        { id: 'a', quantity: 3, lineTotalAfterDiscount: dec('1999.50'), lineTax: dec('377.91') },
        { id: 'b', quantity: 2, lineTotalAfterDiscount: dec(750), lineTax: dec(0) },
        { id: 'c', quantity: 1, lineTotalAfterDiscount: dec(420), lineTax: dec(0) },
      ],
      discountAmount: dec('175.75'),
      taxAmount: dec('377.91'),
    };

    const result = computeReturnRefund(
      sale,
      sale.lines.map((line) => ({ saleLineId: line.id, quantity: line.quantity })),
    );

    const saleTotal = new Decimal(1999.5)
      .plus(750)
      .plus(420)
      .minus(175.75)
      .plus(377.91)
      .toDecimalPlaces(2);

    expect(result.totalRefund.toNumber()).toBe(saleTotal.toNumber());
  });
});
