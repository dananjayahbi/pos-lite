import { describe, expect, it } from 'vitest';

import { labelPriceDisplay } from '@/lib/pricing/label-price.core';

/** ARGUS #160: labels must not show the pre-VAT price as if it were final. */
describe('labelPriceDisplay', () => {
  it('adds standard VAT to the catalogue price', () => {
    const display = labelPriceDisplay({
      retailPrice: '2098.80',
      taxRule: 'STANDARD_VAT',
      vatRate: 18,
      ssclRate: 2.5,
    });

    expect(display.amount).toBe(2476.58);
    expect(display.taxAmount).toBe(377.78);
    expect(display.qualifier).toBe('incl. VAT');
  });

  it('adds SSCL for an SSCL product', () => {
    const display = labelPriceDisplay({
      retailPrice: 1000,
      taxRule: 'SSCL',
      vatRate: 18,
      ssclRate: 2.5,
    });

    expect(display.amount).toBe(1025);
    expect(display.qualifier).toBe('incl. SSCL');
  });

  it('keeps exempt products at the catalogue price with an explicit qualifier', () => {
    const display = labelPriceDisplay({
      retailPrice: 500,
      taxRule: 'EXEMPT',
      vatRate: 18,
      ssclRate: 2.5,
    });

    expect(display.amount).toBe(500);
    expect(display.taxAmount).toBe(0);
    expect(display.qualifier).toBe('VAT exempt');
  });

  it('marks the price as exclusive when no rate is configured', () => {
    const display = labelPriceDisplay({
      retailPrice: 750.5,
      taxRule: 'STANDARD_VAT',
      vatRate: 0,
      ssclRate: 0,
    });

    expect(display.amount).toBe(750.5);
    expect(display.qualifier).toBe('excl. VAT');
  });

  it('treats a missing tax rule as standard VAT', () => {
    const display = labelPriceDisplay({
      retailPrice: 100,
      vatRate: 18,
      ssclRate: 2.5,
    });

    expect(display.amount).toBe(118);
    expect(display.qualifier).toBe('incl. VAT');
  });
});
