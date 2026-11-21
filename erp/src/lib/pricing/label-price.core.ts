import Decimal from 'decimal.js';

/**
 * Shelf-label price display (ARGUS #160).
 *
 * Retail prices are stored pre-tax and the till adds VAT/SSCL, so printing the
 * bare catalogue figure understated what the customer pays. Labels now show the
 * tax-inclusive amount with an explicit qualifier. Kept pure so the A4 sheet,
 * the thermal label and the tests round identically.
 */

export type LabelTaxRule = 'STANDARD_VAT' | 'SSCL' | 'EXEMPT' | string | null | undefined;

export interface LabelPriceInput {
  retailPrice: number | string | { toString(): string };
  taxRule?: LabelTaxRule;
  vatRate: number;
  ssclRate: number;
}

export interface LabelPriceDisplay {
  /** Amount the customer pays at the till, 2 dp. */
  amount: number;
  qualifier: string;
  /** Tax added over the catalogue price. */
  taxAmount: number;
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function labelPriceDisplay(input: LabelPriceInput): LabelPriceDisplay {
  const retail = money(Decimal.max(new Decimal(input.retailPrice.toString()), 0));
  const rule = input.taxRule ?? 'STANDARD_VAT';

  if (rule === 'EXEMPT') {
    return { amount: retail.toNumber(), qualifier: 'VAT exempt', taxAmount: 0 };
  }

  const rate = rule === 'SSCL' ? input.ssclRate : input.vatRate;
  const taxAmount = money(retail.times(rate).div(100));
  const amount = money(retail.plus(taxAmount));

  return {
    amount: amount.toNumber(),
    qualifier:
      rate > 0 ? (rule === 'SSCL' ? 'incl. SSCL' : 'incl. VAT') : 'excl. VAT',
    taxAmount: taxAmount.toNumber(),
  };
}
