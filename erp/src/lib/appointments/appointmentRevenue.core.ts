/**
 * ARGUS #121 — appointment revenue is money actually collected, not catalogue
 * value.
 *
 * A visit contributes its full price only once it is marked paid (the sale
 * flow, which also records the deposit as part of the settlement). Until then
 * the only money received is the booking deposit, so that is what the stats
 * count. Cancelled bookings are excluded upstream: their deposit is returned as
 * store credit by the cancellation guard.
 */
type Decimalish = { toString(): string } | number | string | null | undefined;

function toAmount(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface AppointmentRevenueInput {
  /** Sum of `price` over appointments marked paid. */
  paidPrice: Decimalish;
  /** Sum of `depositAmount` over appointments not marked paid. */
  unpaidDeposits: Decimalish;
  /** Sum of `price` over COMPLETED appointments not marked paid. */
  completedUnpaidPrice?: Decimalish;
  /** Sum of `depositAmount` over COMPLETED appointments not marked paid. */
  completedUnpaidDeposits?: Decimalish;
}

export interface AppointmentRevenueSummary {
  /** Collected money: paid visits at price, otherwise the deposit. */
  revenue: number;
  /** Deposits collected on bookings that are not paid in full yet. */
  depositsHeld: number;
  /** What completed-but-unpaid visits still owe after their deposit. */
  outstandingBalance: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarizeAppointmentRevenue(
  input: AppointmentRevenueInput,
): AppointmentRevenueSummary {
  const paidPrice = round2(toAmount(input.paidPrice));
  const depositsHeld = round2(toAmount(input.unpaidDeposits));
  const outstandingBalance = round2(
    Math.max(toAmount(input.completedUnpaidPrice) - toAmount(input.completedUnpaidDeposits), 0),
  );

  return {
    revenue: round2(paidPrice + depositsHeld),
    depositsHeld,
    outstandingBalance,
  };
}
