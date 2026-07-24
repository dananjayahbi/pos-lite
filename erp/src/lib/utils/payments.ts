import Decimal from 'decimal.js';

export function computeChange(totalAmount: Decimal, amountPaid: Decimal): Decimal {
  if (amountPaid.lessThan(totalAmount)) {
    throw new Error('Insufficient funds: the amount paid is less than the total due.');
  }

  return amountPaid.minus(totalAmount);
}