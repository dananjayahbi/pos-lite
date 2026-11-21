import Decimal from 'decimal.js';

/**
 * ARGUS #145 — stock valuation tax presentation.
 *
 * Retail prices are stored pre-tax. The till value adds VAT for STANDARD_VAT
 * lines and SSCL for SSCL lines; EXEMPT lines add nothing. Kept pure so the
 * API, CSV and page all use the same per-line rounding.
 */
type Decimalish = Decimal | { toString(): string } | number | string;

export interface ValuationTaxRates {
  vatRate: number;
  ssclRate: number;
}

export interface ValuationTaxLineInput {
  retailValue: Decimalish;
  taxRule: string | null | undefined;
}

export interface ValuationTaxLine extends ValuationTaxLineInput {
  retailValue: Decimal;
  taxAmount: Decimal;
  inclusiveValue: Decimal;
}

export interface ValuationTaxSummary {
  lines: ValuationTaxLine[];
  retailValueExTax: Decimal;
  vatAmount: Decimal;
  ssclAmount: Decimal;
  taxAmount: Decimal;
  retailValueInclTax: Decimal;
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function readValuationTaxRates(settings: unknown): ValuationTaxRates {
  const source =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};
  return {
    vatRate: typeof source.vatRate === 'number' ? source.vatRate : 0,
    ssclRate: typeof source.ssclRate === 'number' ? source.ssclRate : 0,
  };
}

export function summarizeValuationTax(
  lines: ReadonlyArray<ValuationTaxLineInput>,
  rates: ValuationTaxRates,
): ValuationTaxSummary {
  let retailValueExTax = new Decimal(0);
  let vatAmount = new Decimal(0);
  let ssclAmount = new Decimal(0);
  const enriched: ValuationTaxLine[] = [];

  for (const line of lines) {
    const retail = money(Decimal.max(new Decimal(line.retailValue.toString()), 0));
    let vat = new Decimal(0);
    let sscl = new Decimal(0);

    if (line.taxRule === 'STANDARD_VAT') {
      vat = money(retail.times(rates.vatRate).div(100));
    } else if (line.taxRule === 'SSCL') {
      sscl = money(retail.times(rates.ssclRate).div(100));
    }

    retailValueExTax = retailValueExTax.plus(retail);
    vatAmount = vatAmount.plus(vat);
    ssclAmount = ssclAmount.plus(sscl);
    enriched.push({
      ...line,
      retailValue: retail,
      taxAmount: vat.plus(sscl),
      inclusiveValue: retail.plus(vat).plus(sscl),
    });
  }

  const taxAmount = vatAmount.plus(ssclAmount);
  return {
    lines: enriched,
    retailValueExTax: money(retailValueExTax),
    vatAmount: money(vatAmount),
    ssclAmount: money(ssclAmount),
    taxAmount: money(taxAmount),
    retailValueInclTax: money(retailValueExTax.plus(taxAmount)),
  };
}

/** Margin percentage with the valuation page's 2-dp precision. */
export function valuationMarginPercent(
  retailValue: Decimalish,
  costValue: Decimalish,
): number {
  const retail = new Decimal(retailValue.toString());
  if (retail.lessThanOrEqualTo(0)) return 0;
  return money(
    retail.minus(new Decimal(costValue.toString())).div(retail).times(100),
  ).toNumber();
}
