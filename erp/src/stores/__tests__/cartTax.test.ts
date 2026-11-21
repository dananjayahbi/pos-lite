import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import {
  getCartTotal,
  getLineTaxRate,
  getSaleDiscountAmount,
  type CartItem,
} from '@/stores/cartStore';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';

const TAX_RATES = { vatRate: 18, ssclRate: 2.5 };

function item(overrides: Partial<CartItem> & Pick<CartItem, 'variantId'>): CartItem {
  return {
    productName: `Product ${overrides.variantId}`,
    variantDescription: 'Default',
    sku: overrides.variantId.toUpperCase(),
    unitPrice: 1000,
    quantity: 1,
    discountPercent: 0,
    taxRule: 'STANDARD_VAT',
    ...overrides,
  };
}

/**
 * ARGUS #60: the cart showed Tax Rs. 0.00 and a pre-tax total while the saved
 * sale added 18% VAT. The preview must price exactly like `createSale`:
 * apportion the combined discount (manual + promotions) across lines, then tax
 * each line by its product tax rule.
 */
describe('getCartTotal tax preview', () => {
  it('adds standard VAT to the cart total', () => {
    const result = getCartTotal(
      [item({ variantId: 'a', unitPrice: 2100, quantity: 2 })],
      0,
      0,
      TAX_RATES,
    );

    expect(result.taxAmount.toNumber()).toBe(756);
    expect(result.total.toNumber()).toBe(4956);
    expect(result.taxRatesApplied).toEqual([18]);
  });

  it('taxes the amount left after a promotion, not the full price', () => {
    const result = getCartTotal(
      [item({ variantId: 'a', unitPrice: 2100, quantity: 2 })],
      0,
      0,
      TAX_RATES,
      378, // 10% promotion on a 4,200 subtotal
    );

    // 4,200 - 378 = 3,822 taxable at 18% = 687.96; total = 3,822 + 687.96.
    expect(result.taxAmount.toNumber()).toBe(687.96);
    expect(result.total.toNumber()).toBe(4509.96);
  });

  it('taxes after every discount (ARGUS #63 regression)', () => {
    const result = getCartTotal(
      [item({ variantId: 'bhringraj', unitPrice: 2098.8 })],
      0,
      0,
      TAX_RATES,
      209.88, // 10% automatic promotion
    );

    // 2,098.80 - 209.88 = 1,888.92 taxable; 18% = 340.01 (not 377.78).
    expect(result.taxAmount.toNumber()).toBe(340.01);
    expect(result.total.toNumber()).toBe(2228.93);
  });

  it('applies each line tax rule and apportions the combined discount', () => {
    const items = [
      item({ variantId: 'vat', unitPrice: 1000, quantity: 2 }),
      item({ variantId: 'exempt', unitPrice: 500, taxRule: 'EXEMPT' }),
    ];

    const result = getCartTotal(items, 0, 0, TAX_RATES, 100);

    // 2,500 subtotal - 100 discount = 2,400; only the VAT line (1,920) is taxed.
    expect(result.discountEffective.toNumber()).toBe(0);
    expect(result.saleDiscount.toNumber()).toBe(100);
    expect(result.taxAmount.toNumber()).toBe(345.6);
    expect(result.total.toNumber()).toBe(2745.6);
  });

  it('uses the SSCL rate for SSCL lines', () => {
    const result = getCartTotal(
      [item({ variantId: 'sscl', unitPrice: 1000, taxRule: 'SSCL' })],
      0,
      0,
      TAX_RATES,
    );

    expect(result.taxAmount.toNumber()).toBe(25);
    expect(result.total.toNumber()).toBe(1025);
    expect(result.taxRatesApplied).toEqual([2.5]);
  });

  it('charges no tax when a discount zeroes the cart', () => {
    const result = getCartTotal(
      [item({ variantId: 'a', unitPrice: 1000, quantity: 2 })],
      100,
      0,
      TAX_RATES,
    );

    expect(result.taxAmount.toNumber()).toBe(0);
    expect(result.total.toNumber()).toBe(0);
  });

  it('matches the sales service arithmetic line for line', () => {
    const items = [
      item({ variantId: 'a', unitPrice: 1999.5, quantity: 3, discountPercent: 7 }),
      item({ variantId: 'b', unitPrice: 750, quantity: 2, taxRule: 'SSCL' }),
      item({ variantId: 'c', unitPrice: 420, taxRule: 'EXEMPT' }),
    ];

    const preview = getCartTotal(items, 0, 250, TAX_RATES, 125.75);

    // Mirror createSale: combined discount allocated across post-line-discount
    // line totals, then each line taxed at its own rate.
    const lineTotals = items.map((line) => {
      const total = new Decimal(line.unitPrice).times(line.quantity);
      const discount = total.times(line.discountPercent).div(100);
      return total.minus(discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    });
    const subtotal = lineTotals.reduce((sum, total) => sum.plus(total), new Decimal(0));
    const cartDiscount = getSaleDiscountAmount(subtotal, 250, 125.75);
    const shares = allocateCartDiscountShares(lineTotals, cartDiscount);
    const totalTax = items
      .reduce((sum, line, index) => {
        const taxable = Decimal.max(lineTotals[index]!.minus(shares[index]!), 0);
        return sum.plus(
          taxable
            .times(getLineTaxRate(line.taxRule, TAX_RATES))
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        );
      }, new Decimal(0))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    expect(preview.subtotal.toNumber()).toBe(subtotal.toNumber());
    expect(preview.saleDiscount.toNumber()).toBe(cartDiscount.toNumber());
    expect(preview.taxAmount.toNumber()).toBe(totalTax.toNumber());
    expect(preview.total.toNumber()).toBe(subtotal.minus(cartDiscount).plus(totalTax).toNumber());
  });

  it('falls back to standard VAT when older cart items carry no tax rule', () => {
    const legacy = item({ variantId: 'legacy' });
    delete legacy.taxRule;

    const result = getCartTotal([legacy], 0, 0, TAX_RATES);

    expect(result.taxAmount.toNumber()).toBe(180);
    expect(result.total.toNumber()).toBe(1180);
  });

  it('charges no tax when the tenant has not configured rates', () => {
    const result = getCartTotal([item({ variantId: 'a' })], 0, 0, { vatRate: 0, ssclRate: 0 });

    expect(result.taxAmount.toNumber()).toBe(0);
    expect(result.total.toNumber()).toBe(1000);
  });
});
