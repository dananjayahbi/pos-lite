import Decimal from 'decimal.js';

/**
 * Employee-side deduction total (ARGUS #381).
 *
 * A payroll item stores `totalDeductions` as no-pay + advances only; employee
 * EPF is a separate field. Payslips and summaries must show one consistent
 * "total deductions" figure that reconciles gross to net, so both derive it
 * here instead of each rendering its own variant.
 */
export function totalDeductionsIncludingEpf(input: {
  totalDeductions: Decimal.Value;
  employeeEpf: Decimal.Value;
}): string {
  return new Decimal(input.totalDeductions)
    .plus(input.employeeEpf)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
