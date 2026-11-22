import { describe, expect, it } from 'vitest';

import { resolveRecentSalePayment } from '@/components/dashboard/recentSalePayment';

/** ARGUS #41 — persisted legs (or the zero-value reason) must drive the label. */
describe('resolveRecentSalePayment', () => {
  it('labels a bank-paid zero sale from its zero-value reason, not NONE', () => {
    expect(
      resolveRecentSalePayment({
        paymentMethod: 'NONE',
        totalAmount: 0,
        zeroValueReason: 'BANK_PAYMENT',
        payments: [],
      }),
    ).toEqual({ label: 'Bank payment', tone: 'bank' });
  });

  it('uses payment legs even when the sale method is NONE', () => {
    expect(
      resolveRecentSalePayment({
        paymentMethod: 'NONE',
        totalAmount: 0,
        payments: [
          { method: 'CARD', amount: '0.00' },
          { method: 'CARD', amount: '1500.00' },
        ],
      }),
    ).toEqual({ label: 'Card', tone: 'card' });
  });

  it('labels cash, card and QR legs explicitly', () => {
    expect(
      resolveRecentSalePayment({ totalAmount: 100, payments: [{ method: 'CASH', amount: 100 }] }),
    ).toEqual({ label: 'Cash', tone: 'cash' });
    expect(
      resolveRecentSalePayment({ totalAmount: 100, payments: [{ method: 'CARD', amount: 100 }] }),
    ).toEqual({ label: 'Card', tone: 'card' });
    expect(
      resolveRecentSalePayment({
        totalAmount: 100,
        payments: [{ method: 'LANKAQR', amount: 100 }],
      }),
    ).toEqual({ label: 'LankaQR', tone: 'qr' });
  });

  it('joins split legs', () => {
    expect(
      resolveRecentSalePayment({
        paymentMethod: 'SPLIT',
        totalAmount: 2000,
        payments: [
          { method: 'CASH', amount: 500 },
          { method: 'CARD', amount: 1500 },
        ],
      }),
    ).toEqual({ label: 'Cash + Card', tone: 'split' });
  });

  it('labels store credit and exchange credit', () => {
    expect(
      resolveRecentSalePayment({
        totalAmount: 500,
        payments: [{ method: 'STORE_CREDIT', amount: 500 }],
      }),
    ).toEqual({ label: 'Store Credit', tone: 'credit' });
    expect(
      resolveRecentSalePayment({
        totalAmount: 500,
        payments: [{ method: 'EXCHANGE_CREDIT', amount: 500 }],
      }),
    ).toEqual({ label: 'Exchange Credit', tone: 'credit' });
  });

  it('labels a genuine zero-value sale without looking unpaid', () => {
    expect(
      resolveRecentSalePayment({
        paymentMethod: 'NONE',
        totalAmount: 0,
        zeroValueReason: 'COMPLIMENTARY_GIFT',
        payments: [],
      }),
    ).toEqual({ label: 'Zero-value (complimentary)', tone: 'zero' });
    expect(
      resolveRecentSalePayment({
        paymentMethod: 'NONE',
        totalAmount: 0,
        payments: [],
      }),
    ).toEqual({ label: 'Zero-value', tone: 'zero' });
  });

  it('falls back to a legacy paymentMethod when no legs exist', () => {
    expect(
      resolveRecentSalePayment({ paymentMethod: 'CASH', totalAmount: 100, payments: [] }),
    ).toEqual({ label: 'Cash', tone: 'cash' });
  });

  it('flags a positive sale with no legs/tender instead of saying NONE', () => {
    expect(
      resolveRecentSalePayment({ paymentMethod: 'NONE', totalAmount: 100, payments: [] }),
    ).toEqual({ label: 'Unrecorded', tone: 'neutral' });
  });
});
