import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface AppointmentSalePricing {
  subtotal: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  /** Deposits are money already collected at booking (capped at the total). */
  depositApplied: Decimal;
  balanceDue: Decimal;
}

/**
 * Price an appointment conversion like a sale (ARGUS #119).
 *
 * The service price is the subtotal, the tenant VAT rate is applied, and any
 * deposit recorded on the appointment is treated as already collected — the
 * balance is what the cashier takes on delivery. The previous conversion wrote
 * a bare total with no tax and ignored deposits entirely.
 */
export function computeAppointmentSalePricing(input: {
  price: Decimalish;
  vatRate: number;
  /** SSCL rate for SSCL services; ignored for VAT/exempt (ARGUS #131). */
  ssclRate?: number;
  /** TaxRule value: STANDARD_VAT (default), SSCL, EXEMPT. */
  taxRule?: string | null;
  deposit?: Decimalish | null;
}): AppointmentSalePricing {
  const subtotal = new Decimal(input.price.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const rule = input.taxRule ?? 'STANDARD_VAT';
  const rate =
    rule === 'EXEMPT'
      ? 0
      : rule === 'SSCL'
        ? (input.ssclRate ?? 0)
        : input.vatRate;
  const taxAmount = subtotal.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalAmount = subtotal.plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const deposit = new Decimal(input.deposit?.toString() ?? '0').toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const depositApplied = Decimal.min(Decimal.max(deposit, 0), totalAmount);
  const balanceDue = totalAmount.minus(depositApplied).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { subtotal, taxAmount, totalAmount, depositApplied, balanceDue };
}

/**
 * Who gets credit for a converted appointment (ARGUS #132): the assigned
 * staff/doctor when set, otherwise the operator who clicked Convert.
 */
export function resolveAppointmentSaleOwner(input: {
  staffId?: string | null | undefined;
  operatorId: string;
}): string {
  return input.staffId?.trim() || input.operatorId;
}
