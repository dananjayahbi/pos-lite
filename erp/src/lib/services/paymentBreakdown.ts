import Decimal from 'decimal.js';
import type { Payment } from '@/generated/prisma/client';

/**
 * Aggregates POS payment legs into a cash / card / LankaQR breakdown.
 *
 * Used by the shift Z-report and the printed Z-report so that LankaQR volumes
 * are reported as a distinct line alongside cash and card (doc 31).
 */
export interface PaymentBreakdown {
  cash: Decimal;
  card: Decimal;
  lankaqr: Decimal;
}

export function emptyPaymentBreakdown(): PaymentBreakdown {
  return { cash: new Decimal(0), card: new Decimal(0), lankaqr: new Decimal(0) };
}

export function sumPaymentBreakdown(
  payments: Array<Pick<Payment, 'method' | 'amount'>>,
): PaymentBreakdown {
  const total = emptyPaymentBreakdown();
  for (const p of payments) {
    const amount = new Decimal(p.amount.toString());
    switch (p.method) {
      case 'CASH':
        total.cash = total.cash.plus(amount);
        break;
      case 'CARD':
        total.card = total.card.plus(amount);
        break;
      case 'LANKAQR':
        total.lankaqr = total.lankaqr.plus(amount);
        break;
    }
  }
  return total;
}
