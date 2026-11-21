import { describe, expect, it } from 'vitest';

import { evaluatePurchaseOrderPayment } from '@/lib/services/purchaseOrderPaymentGuard.core';

/** ARGUS #231: concurrent/instalment payments can never exceed the payable. */
describe('evaluatePurchaseOrderPayment', () => {
  it('allows a payment against the outstanding balance', () => {
    expect(evaluatePurchaseOrderPayment(4304, 2000, 1000)).toEqual({
      payable: 4304,
      paidTotal: 2000,
      requested: 1000,
      outstanding: 2304,
      newPaidTotal: 3000,
      allowed: true,
      rejection: null,
    });
  });

  it('allows an exact settlement of the remaining balance', () => {
    const result = evaluatePurchaseOrderPayment(4304, 2000, 2304);
    expect(result.allowed).toBe(true);
    expect(result.outstanding).toBe(2304);
    expect(result.newPaidTotal).toBe(4304);
  });

  it('rejects the second of two racing full payments once the total is covered', () => {
    // After the first payment commits, paid == payable; the loser must not post.
    const result = evaluatePurchaseOrderPayment(4304, 4304, 4304);
    expect(result.allowed).toBe(false);
    expect(result.rejection).toBe('ALREADY_SETTLED');
    // The hypothetical total is reported honestly (it would be an overpayment);
    // what matters is that the caller must not write it.
    expect(result.newPaidTotal).toBe(8608);
  });

  it('rejects a payment that exceeds the outstanding balance', () => {
    const result = evaluatePurchaseOrderPayment(4304, 2000, 2305);
    expect(result.allowed).toBe(false);
    expect(result.rejection).toBe('EXCEEDS_OUTSTANDING');
  });

  it('rejects a non-positive amount', () => {
    expect(evaluatePurchaseOrderPayment(100, 0, 0).rejection).toBe('NOT_POSITIVE');
    expect(evaluatePurchaseOrderPayment(100, 0, -5).rejection).toBe('NOT_POSITIVE');
  });

  it('rejects a payment against a zero payable', () => {
    expect(evaluatePurchaseOrderPayment(0, 0, 10).rejection).toBe('ALREADY_SETTLED');
  });

  it('keeps the new paid total at or below the payable for every allowed request', () => {
    const payable = 1000;
    const paid = 250;
    for (const requested of [0.01, 100, 749.99, 750]) {
      const result = evaluatePurchaseOrderPayment(payable, paid, requested);
      expect(result.allowed).toBe(true);
      expect(result.newPaidTotal).toBeLessThanOrEqual(result.payable);
    }
  });

  it('never reports a negative outstanding balance', () => {
    expect(evaluatePurchaseOrderPayment(1000, 1200, 10).outstanding).toBe(0);
  });

  it('rounds money to cents half-up', () => {
    const result = evaluatePurchaseOrderPayment('100.005', '0.004', '0.004');
    expect(result.payable).toBe(100.01);
    expect(result.paidTotal).toBe(0);
    expect(result.requested).toBe(0);
  });
});
