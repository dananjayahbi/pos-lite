import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { emptyPaymentBreakdown, sumPaymentBreakdown } from '@/lib/services/paymentBreakdown';
import type { Payment } from '@/generated/prisma/client';

function leg(method: Payment['method'], amount: string): Pick<Payment, 'method' | 'amount'> {
  return { method, amount: new Decimal(amount) };
}

describe('sumPaymentBreakdown', () => {
  it('returns zeroed totals for no payments', () => {
    const b = sumPaymentBreakdown([]);
    expect(b.cash.toNumber()).toBe(0);
    expect(b.card.toNumber()).toBe(0);
    expect(b.lankaqr.toNumber()).toBe(0);
  });

  it('separates LankaQR from cash and card', () => {
    const b = sumPaymentBreakdown([
      leg('CASH', '100.50'),
      leg('CARD', '200.00'),
      leg('LANKAQR', '300.25'),
    ]);
    expect(b.cash.toNumber()).toBe(100.5);
    expect(b.card.toNumber()).toBe(200);
    expect(b.lankaqr.toNumber()).toBe(300.25);
  });

  it('accumulates multiple legs of the same method', () => {
    const b = sumPaymentBreakdown([
      leg('CASH', '10'),
      leg('CASH', '20'),
      leg('LANKAQR', '5'),
      leg('LANKAQR', '15'),
    ]);
    expect(b.cash.toNumber()).toBe(30);
    expect(b.lankaqr.toNumber()).toBe(20);
    expect(b.card.toNumber()).toBe(0);
  });

  it('does not lump LankaQR into the card total', () => {
    const b = sumPaymentBreakdown([
      leg('CARD', '50'),
      leg('LANKAQR', '75'),
    ]);
    expect(b.card.toNumber()).toBe(50);
    expect(b.lankaqr.toNumber()).toBe(75);
  });

  it('emptyPaymentBreakdown returns a usable zeroed breakdown', () => {
    const b = emptyPaymentBreakdown();
    expect(b.cash).toBeInstanceOf(Decimal);
    expect(b.card.toNumber()).toBe(0);
    expect(b.lankaqr.toNumber()).toBe(0);
  });
});
