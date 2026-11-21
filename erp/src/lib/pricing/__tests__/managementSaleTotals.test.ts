import { describe, expect, it } from 'vitest';

import { computeManagementSaleTotals } from '@/lib/pricing/managementSaleTotals';

const TAX_RATES = { vatRate: 18, ssclRate: 2.5 };

/**
 * ARGUS #74: the management Record Sale sheet priced a 2,098.80 product at
 * 2,098.80 while the API persisted 2,476.58 (18% VAT 377.78). The sheet now
 * prices exactly like createSale.
 */
describe('computeManagementSaleTotals', () => {
  it('adds standard VAT so the sheet total matches the saved sale', () => {
    const totals = computeManagementSaleTotals(
      [{ unitPrice: 2098.8, quantity: 1, discountPercent: 0, taxRule: 'STANDARD_VAT' }],
      { cartDiscount: 0, taxRates: TAX_RATES },
    );

    expect(totals.subtotal).toBe(2098.8);
    expect(totals.taxAmount).toBe(377.78);
    expect(totals.total).toBe(2476.58);
    expect(totals.taxRatesApplied).toEqual([18]);
  });

  it('taxes the amount left after the cart discount', () => {
    const totals = computeManagementSaleTotals(
      [
        { unitPrice: 1000, quantity: 2, discountPercent: 0, taxRule: 'STANDARD_VAT' },
        { unitPrice: 500, quantity: 1, discountPercent: 0, taxRule: 'EXEMPT' },
      ],
      { cartDiscount: 100, taxRates: TAX_RATES },
    );

    // 2,500 − 100 = 2,400 apportioned 1,920/480; VAT applies to the VAT line only.
    expect(totals.subtotal).toBe(2500);
    expect(totals.discountAmount).toBe(100);
    expect(totals.taxAmount).toBe(345.6);
    expect(totals.total).toBe(2745.6);
  });

  it('applies line discounts before the cart discount allocation', () => {
    const totals = computeManagementSaleTotals(
      [{ unitPrice: 1000, quantity: 2, discountPercent: 10, taxRule: 'STANDARD_VAT' }],
      { cartDiscount: 100, taxRates: TAX_RATES },
    );

    // 2,000 − 200 line discount = 1,800; − 100 cart = 1,700 taxable at 18%.
    expect(totals.subtotal).toBe(1800);
    expect(totals.discountAmount).toBe(100);
    expect(totals.taxAmount).toBe(306);
    expect(totals.total).toBe(2006);
  });

  it('adds the delivery charge after tax', () => {
    const totals = computeManagementSaleTotals(
      [{ unitPrice: 1000, quantity: 1, discountPercent: 0, taxRule: 'STANDARD_VAT' }],
      { cartDiscount: 0, deliveryCharge: 250, taxRates: TAX_RATES },
    );

    expect(totals.taxAmount).toBe(180);
    expect(totals.deliveryCharge).toBe(250);
    expect(totals.total).toBe(1430);
  });

  it('charges no tax on SSCL lines when only VAT is configured', () => {
    const totals = computeManagementSaleTotals(
      [{ unitPrice: 1000, quantity: 1, discountPercent: 0, taxRule: 'SSCL' }],
      { cartDiscount: 0, taxRates: { vatRate: 18, ssclRate: 0 } },
    );

    expect(totals.taxAmount).toBe(0);
    expect(totals.taxRatesApplied).toEqual([]);
    expect(totals.total).toBe(1000);
  });

  it('caps the discount at the subtotal (zero total)', () => {
    const totals = computeManagementSaleTotals(
      [{ unitPrice: 1000, quantity: 1, discountPercent: 0, taxRule: 'STANDARD_VAT' }],
      { cartDiscount: 5000, taxRates: TAX_RATES },
    );

    expect(totals.discountAmount).toBe(1000);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('leaves totals untaxed when the tenant has no rates configured', () => {
    const totals = computeManagementSaleTotals(
      [{ unitPrice: 1000, quantity: 1, discountPercent: 0, taxRule: 'STANDARD_VAT' }],
      { cartDiscount: 0, taxRates: { vatRate: 0, ssclRate: 0 } },
    );

    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(1000);
  });
});
