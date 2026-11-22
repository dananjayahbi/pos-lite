import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { resolveCashTender } from '@/lib/services/saleCashTender.core';

/**
 * ARGUS #62: the sale API used to accept any cash amount above zero without
 * comparing it to the total, so a short tender was stored as a fully-paid cash
 * sale and no change was recorded. The server now derives the cash portion from
 * the payable amount (after discounts, store credit and exchange credit) and
 * rejects anything below it via `INSUFFICIENT_CASH`.
 */
describe('resolveCashTender', () => {
  describe('CASH', () => {
    it('settles an exact tender with no change', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('2184.75'),
        cashReceived: new Decimal('2184.75'),
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.cashDue.toNumber()).toBe(2184.75);
      expect(result.changeGiven.toNumber()).toBe(0);
    });

    it('records change on an overpayment', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('2184.75'),
        cashReceived: 2500,
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.changeGiven.toNumber()).toBe(315.25);
    });

    it('rejects a tender that is short by any amount', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('2184.75'),
        cashReceived: new Decimal('2184.74'),
      });

      expect(result.status).toBe('SHORT');
      if (result.status !== 'SHORT') return;
      expect(result.shortfall.toNumber()).toBe(0.01);
    });

    it('rejects a token tender instead of persisting the full total as cash', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('2184.75'),
        cashReceived: 1,
      });

      expect(result.status).toBe('SHORT');
      if (result.status !== 'SHORT') return;
      expect(result.cashReceived.toNumber()).toBe(1);
      expect(result.cashDue.toNumber()).toBe(2184.75);
      expect(result.shortfall.toNumber()).toBe(2183.75);
    });

    it('treats a missing tender as short rather than crashing', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('500'),
        cashReceived: undefined,
      });

      expect(result.status).toBe('SHORT');
      if (result.status !== 'SHORT') return;
      expect(result.cashReceived.toNumber()).toBe(0);
      expect(result.shortfall.toNumber()).toBe(500);
    });

    it('treats malformed, non-finite and negative tenders as short', () => {
      for (const cashReceived of ['', 'abc', 'NaN', Infinity, -50]) {
        const result = resolveCashTender({
          paymentMethod: 'CASH',
          payableAmount: new Decimal('500'),
          cashReceived,
        });
        expect(result.status, `tender ${String(cashReceived)}`).toBe('SHORT');
      }
    });

    it('collects only the payable remainder after store credit', () => {
      // 2,184.75 total with 1,500.00 store credit leaves 684.75 payable.
      const exact = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('684.75'),
        cashReceived: new Decimal('684.75'),
      });
      const short = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('684.75'),
        cashReceived: new Decimal('684.74'),
      });

      expect(exact.status).toBe('SETTLED');
      expect(short.status).toBe('SHORT');
    });

    it('requires no cash when the payable amount is zero', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: 0,
        cashReceived: undefined,
      });

      expect(result.status).toBe('NO_CASH_DUE');
    });
  });

  describe('SPLIT', () => {
    it('settles an exact cash remainder after the card leg', () => {
      const result = resolveCashTender({
        paymentMethod: 'SPLIT',
        payableAmount: new Decimal('1000'),
        cardAmount: new Decimal('400'),
        cashReceived: new Decimal('600'),
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.cashDue.toNumber()).toBe(600);
      expect(result.changeGiven.toNumber()).toBe(0);
    });

    it('rejects a short cash leg even when the card leg is valid', () => {
      const result = resolveCashTender({
        paymentMethod: 'SPLIT',
        payableAmount: new Decimal('1000'),
        cardAmount: new Decimal('400'),
        cashReceived: new Decimal('599.99'),
      });

      expect(result.status).toBe('SHORT');
      if (result.status !== 'SHORT') return;
      expect(result.cashDue.toNumber()).toBe(600);
      expect(result.shortfall.toNumber()).toBe(0.01);
    });

    it('computes change on the cash leg only, never the full total', () => {
      const result = resolveCashTender({
        paymentMethod: 'SPLIT',
        payableAmount: new Decimal('1000'),
        cardAmount: new Decimal('400'),
        cashReceived: new Decimal('700'),
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.changeGiven.toNumber()).toBe(100);
    });

    it('requires no cash when the digital leg covers the payable amount', () => {
      const result = resolveCashTender({
        paymentMethod: 'SPLIT',
        payableAmount: new Decimal('250'),
        cardAmount: new Decimal('250'),
        cashReceived: new Decimal('0.01'),
      });

      expect(result.status).toBe('NO_CASH_DUE');
    });

    it('clamps a card leg above the payable amount to "no cash due"', () => {
      const result = resolveCashTender({
        paymentMethod: 'SPLIT',
        payableAmount: new Decimal('250'),
        cardAmount: new Decimal('300'),
        cashReceived: undefined,
      });

      expect(result.status).toBe('NO_CASH_DUE');
    });

    it('falls back to the full payable amount when the card leg is missing', () => {
      const result = resolveCashTender({
        paymentMethod: 'SPLIT',
        payableAmount: new Decimal('250'),
        cardAmount: undefined,
        cashReceived: new Decimal('250'),
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.cashDue.toNumber()).toBe(250);
    });
  });

  describe('other tenders', () => {
    it.each(['CARD', 'LANKAQR', 'STORE_CREDIT', 'EXCHANGE_CREDIT', 'NONE'])(
      'does not require cash for %s',
      (paymentMethod) => {
        const result = resolveCashTender({
          paymentMethod,
          payableAmount: new Decimal('100'),
          cashReceived: undefined,
        });

        expect(result.status).toBe('NO_CASH_DUE');
      },
    );
  });

  describe('money rounding', () => {
    it('rounds change to 2dp instead of persisting sub-cent amounts', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('1000'),
        cashReceived: new Decimal('1000.004'),
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.changeGiven.toNumber()).toBe(0);
    });

    it('rounds a half-cent change up', () => {
      const result = resolveCashTender({
        paymentMethod: 'CASH',
        payableAmount: new Decimal('1000'),
        cashReceived: new Decimal('1000.005'),
      });

      expect(result.status).toBe('SETTLED');
      if (result.status !== 'SETTLED') return;
      expect(result.changeGiven.toNumber()).toBe(0.01);
    });
  });
});
