import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

/**
 * Parse a money input without ever throwing. Returns `null` for missing,
 * empty, non-numeric, NaN or infinite values, so a malformed tender is treated
 * as "nothing was tendered" instead of crashing the transaction.
 */
function parseMoney(value: Decimalish | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value.toString());
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

export type CashTenderCheck =
  /** The tender collects no cash (card/QR/credit, or nothing left to pay). */
  | { status: 'NO_CASH_DUE' }
  /** Less cash was tendered than the server-computed cash portion. */
  | {
      status: 'SHORT';
      cashDue: Decimal;
      cashReceived: Decimal;
      shortfall: Decimal;
    }
  /** Enough cash was tendered; `changeGiven` is zero on an exact tender. */
  | {
      status: 'SETTLED';
      cashDue: Decimal;
      cashReceived: Decimal;
      changeGiven: Decimal;
    };

/**
 * Decide whether a CASH or SPLIT sale was tendered in full (ARGUS #62).
 *
 * The cash portion is derived from the SERVER-computed payable amount, never
 * from the client's total:
 * - CASH: the whole payable amount is due in cash.
 * - SPLIT: only the payable remainder after the card/QR leg is due in cash.
 *
 * Payable already excludes discounts, store credit and exchange credit, so a
 * short tender on the remainder cannot be persisted as a fully-paid sale.
 * A missing/malformed `cashReceived` is treated as zero tendered (SHORT), not
 * as a crash. `changeGiven` is the change owed back on the cash tender, rounded
 * to 2dp the same way money is stored everywhere else.
 *
 * `cardAmount` is clamped to `[0, payable]` here; callers still reject a card
 * leg larger than the payable amount with their own error.
 */
export function resolveCashTender(input: {
  paymentMethod: string;
  payableAmount: Decimalish;
  cardAmount?: Decimalish | null | undefined;
  cashReceived?: Decimalish | null | undefined;
}): CashTenderCheck {
  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'SPLIT') {
    return { status: 'NO_CASH_DUE' };
  }

  const payable = parseMoney(input.payableAmount) ?? new Decimal(0);
  if (payable.lessThanOrEqualTo(0)) return { status: 'NO_CASH_DUE' };

  const cashDue =
    input.paymentMethod === 'CASH'
      ? payable
      : payable.minus(
          Decimal.max(Decimal.min(parseMoney(input.cardAmount) ?? new Decimal(0), payable), 0),
        );
  const roundedDue = cashDue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (roundedDue.lessThanOrEqualTo(0)) return { status: 'NO_CASH_DUE' };

  // A negative tender is not cash received; treat it as nothing tendered.
  const received = Decimal.max(parseMoney(input.cashReceived) ?? new Decimal(0), 0);

  if (received.lessThan(roundedDue)) {
    return {
      status: 'SHORT',
      cashDue: roundedDue,
      cashReceived: received.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      shortfall: roundedDue.minus(received).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    };
  }

  return {
    status: 'SETTLED',
    cashDue: roundedDue,
    cashReceived: received.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    changeGiven: received.minus(roundedDue).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}
