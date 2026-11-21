import Decimal from 'decimal.js';

import type { TaxRuleValue } from '@/lib/constants/product-options';

/**
 * Product tax rules are mutually exclusive (ARGUS #469).
 *
 * A product carries exactly one `TaxRule`, and the sale/cart engine resolves
 * exactly one percentage from it:
 *
 *   STANDARD_VAT -> tenant vatRate
 *   SSCL         -> tenant ssclRate
 *   EXEMPT       -> 0
 *
 * VAT and SSCL never stack. A Rs 1,065 VAT line is charged 191.70 (18%), not
 * 218.33 (18% + 2.5%). Kept pure and shared so `createSale`, the POS preview and
 * the settings copy cannot disagree.
 */

export interface TaxRatePair {
  vatRate: number;
  ssclRate: number;
}

/** A stored enum, a legacy/missing value, or an unknown string. */
export type TaxRuleInput = TaxRuleValue | string | null | undefined;

/**
 * Effective tax rate as a fraction for one line.
 *
 * Missing/unknown rules fall back to STANDARD_VAT, matching the legacy cart
 * items that predate the `taxRule` field (ARGUS #60).
 */
export function resolveTaxRate(rule: TaxRuleInput, rates: TaxRatePair): Decimal {
  switch (rule ?? 'STANDARD_VAT') {
    case 'SSCL':
      return new Decimal(rates.ssclRate).div(100);
    case 'EXEMPT':
      return new Decimal(0);
    case 'STANDARD_VAT':
    default:
      return new Decimal(rates.vatRate).div(100);
  }
}

/** The same rate as a percentage, for previews and labels. */
export function resolveTaxRatePercent(rule: TaxRuleInput, rates: TaxRatePair): number {
  return resolveTaxRate(rule, rates).times(100).toNumber();
}

export interface TaxRulePreviewRow {
  rule: TaxRuleValue;
  label: string;
  /** The single percentage this rule applies. */
  rate: number;
}

/**
 * Rows for the Tax settings preview. Each shows the one rate its rule applies;
 * the labels say "only" so the screen cannot read as VAT + SSCL combined.
 */
export function taxRulePreviewRows(rates: TaxRatePair): TaxRulePreviewRow[] {
  return [
    { rule: 'STANDARD_VAT', label: 'Standard VAT (VAT only)', rate: rates.vatRate },
    { rule: 'SSCL', label: 'SSCL (SSCL only)', rate: rates.ssclRate },
    { rule: 'EXEMPT', label: 'VAT Exempt', rate: 0 },
  ];
}
