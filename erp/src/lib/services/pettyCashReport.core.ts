import Decimal from 'decimal.js';

/**
 * ARGUS #395 — filtered petty-cash exports must be a period statement.
 *
 * The CSV used to print the all-time opening/top-ups next to only the filtered
 * expenses, so a Sep window showed a September expense total against a
 * November top-up and called the result "Current Balance". The period statement
 * is:
 *
 *   opening(period start) + cash-in(in window) − expenses(in window) = closing
 *
 * where opening = fund opening allocation + cash-in before the window −
 * expenses before the window.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface PettyCashPeriodInput {
  /** The fund's original/all-time opening allocation. */
  fundOpeningBalance: Decimalish;
  /** Top-up ledger debits dated before the window. */
  topUpsBefore: Decimalish;
  /** Expenses dated before the window. */
  expensesBefore: Decimalish;
  /** Top-up ledger debits inside the window. */
  topUpsInPeriod: Decimalish;
  /** Expenses inside the window. */
  expensesInPeriod: Decimalish;
}

export interface PettyCashPeriodStatement {
  openingBalance: Decimal;
  totalTopUps: Decimal;
  totalExpenses: Decimal;
  closingBalance: Decimal;
}

function toDecimal(value: Decimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function computePettyCashPeriodStatement(
  input: PettyCashPeriodInput,
): PettyCashPeriodStatement {
  const openingBalance = round2(
    toDecimal(input.fundOpeningBalance)
      .plus(toDecimal(input.topUpsBefore))
      .minus(toDecimal(input.expensesBefore)),
  );
  const totalTopUps = round2(toDecimal(input.topUpsInPeriod));
  const totalExpenses = round2(toDecimal(input.expensesInPeriod));
  const closingBalance = round2(openingBalance.plus(totalTopUps).minus(totalExpenses));

  return { openingBalance, totalTopUps, totalExpenses, closingBalance };
}
