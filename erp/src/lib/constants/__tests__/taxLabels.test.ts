import { describe, expect, it } from 'vitest';

import { formatTaxRate, taxRuleLabel } from '@/lib/constants/product-options';

/**
 * ARGUS #143: product surfaces hard-coded "Standard VAT (15%)" while the tenant
 * and sale engine resolved 18%, understating tax by three points.
 */
describe('taxRuleLabel', () => {
  it('uses the tenant VAT rate', () => {
    expect(taxRuleLabel('STANDARD_VAT', { vatRate: 18, ssclRate: 2.5 })).toBe(
      'Standard VAT (18%)',
    );
  });

  it('uses the tenant SSCL rate', () => {
    expect(taxRuleLabel('SSCL', { vatRate: 18, ssclRate: 2.5 })).toBe('SSCL (2.5%)');
  });

  it('omits the rate until it is loaded instead of showing a wrong one', () => {
    expect(taxRuleLabel('STANDARD_VAT')).toBe('Standard VAT');
    expect(taxRuleLabel('SSCL', null)).toBe('SSCL');
  });

  it('keeps the exempt label and unknown rules readable', () => {
    expect(taxRuleLabel('EXEMPT', { vatRate: 18 })).toBe('VAT Exempt');
    expect(taxRuleLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });

  it('formats common rates without trailing noise', () => {
    expect(formatTaxRate(18)).toBe('18');
    expect(formatTaxRate(2.5)).toBe('2.5');
    expect(formatTaxRate(2.25)).toBe('2.25');
    expect(formatTaxRate(2.5)).not.toBe('2.50');
  });

  it('never falls back to the old fixed 15% when a rate is configured', () => {
    const label = taxRuleLabel('STANDARD_VAT', { vatRate: 18 });
    expect(label).toBe('Standard VAT (18%)');
    expect(label).not.toContain('15%');
    expect(taxRuleLabel('STANDARD_VAT', { vatRate: 20 })).toBe('Standard VAT (20%)');
  });
});
