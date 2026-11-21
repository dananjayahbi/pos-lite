import { describe, expect, it } from 'vitest';

import { computePurchaseOrderPaymentState } from '@/lib/services/purchaseOrderPaymentState.core';

/** ARGUS #228: partial payments must not render as "Unpaid". */
describe('computePurchaseOrderPaymentState', () => {
  it('reports an order with no payments as UNPAID', () => {
    expect(computePurchaseOrderPaymentState(4304, 0)).toEqual({
      paidTotal: 0,
      payable: 4304,
      outstanding: 4304,
      state: 'UNPAID',
    });
  });

  it('reports a part payment as PARTIALLY_PAID with the balance', () => {
    expect(computePurchaseOrderPaymentState(4304, 2000)).toEqual({
      paidTotal: 2000,
      payable: 4304,
      outstanding: 2304,
      state: 'PARTIALLY_PAID',
    });
  });

  it('reports a fully covered order as PAID', () => {
    expect(computePurchaseOrderPaymentState('1048.41', '1048.41').state).toBe('PAID');
    expect(computePurchaseOrderPaymentState(1000, 1500).state).toBe('PAID');
  });

  it('keeps a one-cent shortfall as PARTIALLY_PAID', () => {
    const summary = computePurchaseOrderPaymentState(1000, 999.99);
    expect(summary.state).toBe('PARTIALLY_PAID');
    expect(summary.outstanding).toBe(0.01);
  });

  it('clamps an overpayment to zero outstanding', () => {
    expect(computePurchaseOrderPaymentState(1000, 1200).outstanding).toBe(0);
  });

  it('treats a zero payable with no payments as UNPAID', () => {
    expect(computePurchaseOrderPaymentState(0, 0).state).toBe('UNPAID');
  });

  it('rounds money to cents', () => {
    expect(computePurchaseOrderPaymentState('100.005', '0.004')).toEqual({
      paidTotal: 0,
      payable: 100.01,
      outstanding: 100.01,
      state: 'UNPAID',
    });
  });
});
