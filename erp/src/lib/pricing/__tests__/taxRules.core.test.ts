import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import {
  resolveTaxRate,
  resolveTaxRatePercent,
  taxRulePreviewRows,
} from '@/lib/pricing/taxRules.core';

const RATES = { vatRate: 18, ssclRate: 2.5 };

/**
 * ARGUS #469: the engine resolves exactly one rate from the product's tax rule.
 * VAT and SSCL are alternatives, never additive, despite the settings preview
 * listing both percentages.
 */
describe('resolveTaxRate exclusivity matrix', () => {
  it.each([
    ['STANDARD_VAT', 18],
    ['SSCL', 2.5],
    ['EXEMPT', 0],
  ] as const)('applies only the %s percentage', (rule, expectedPercent) => {
    expect(resolveTaxRatePercent(rule, RATES)).toBe(expectedPercent);
  });

  it('does not add SSCL on top of VAT', () => {
    const rate = resolveTaxRate('STANDARD_VAT', RATES);
    expect(rate.toNumber()).toBe(0.18);
    expect(rate.toNumber()).not.toBe(0.205);
  });

  it('does not add VAT on top of SSCL', () => {
    const rate = resolveTaxRate('SSCL', RATES);
    expect(rate.toNumber()).toBe(0.025);
    expect(rate.toNumber()).not.toBe(0.205);
  });

  it('charges the reported Rs 1,065 sale at 191.70, not 218.33', () => {
    const base = new Decimal(1065);
    const vat = base
      .times(resolveTaxRate('STANDARD_VAT', RATES))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const stacked = base
      .times(new Decimal(18).plus(2.5).div(100))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    expect(vat.toNumber()).toBe(191.7);
    expect(stacked.toNumber()).toBe(218.33);
    expect(vat.toNumber()).not.toBe(stacked.toNumber());
  });

  it('charges an SSCL line at only 2.5%', () => {
    const tax = new Decimal(1065)
      .times(resolveTaxRate('SSCL', RATES))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(tax.toNumber()).toBe(26.63);
  });

  it('charges nothing for EXEMPT even when both rates are configured', () => {
    expect(resolveTaxRate('EXEMPT', RATES).toNumber()).toBe(0);
  });

  it('falls back to STANDARD_VAT for a missing or unknown rule', () => {
    expect(resolveTaxRatePercent(undefined, RATES)).toBe(18);
    expect(resolveTaxRatePercent(null, RATES)).toBe(18);
    expect(resolveTaxRatePercent('NOT_A_RULE', RATES)).toBe(18);
  });
});

describe('taxRulePreviewRows', () => {
  it('shows each rule with its own single rate and no combined row', () => {
    const rows = taxRulePreviewRows(RATES);

    expect(rows.map((row) => [row.rule, row.rate])).toEqual([
      ['STANDARD_VAT', 18],
      ['SSCL', 2.5],
      ['EXEMPT', 0],
    ]);
    expect(rows.some((row) => row.rate === 20.5)).toBe(false);
  });

  it('labels the two taxable rules as alternatives', () => {
    const rows = taxRulePreviewRows(RATES);
    expect(rows[0]?.label).toContain('VAT only');
    expect(rows[1]?.label).toContain('SSCL only');
    expect(rows[2]?.label).toBe('VAT Exempt');
  });

  it('reflects changed tenant rates without changing the rule set', () => {
    const rows = taxRulePreviewRows({ vatRate: 20, ssclRate: 3 });
    expect(rows[0]?.rate).toBe(20);
    expect(rows[1]?.rate).toBe(3);
    expect(rows).toHaveLength(3);
  });
});
