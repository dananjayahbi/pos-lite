import { describe, expect, it } from 'vitest';

import { validateReturnCancellation } from '@/lib/services/returnCancellation.core';

const base = {
  status: 'COMPLETED',
  reason: 'Typed the wrong return',
  linkedSaleCount: 0,
  refundMethod: 'CASH',
  refundAmount: 500,
  customerId: 'customer-1',
  customerCreditBalance: 0,
};

/** ARGUS #102: reversal guard rules. */
describe('validateReturnCancellation', () => {
  it('allows a completed return with a reason and no linked sale', () => {
    expect(validateReturnCancellation(base)).toBeNull();
  });

  it('requires a meaningful reason', () => {
    expect(validateReturnCancellation({ ...base, reason: '' })?.code).toBe(
      'RETURN_CANCEL_REASON_REQUIRED',
    );
    expect(validateReturnCancellation({ ...base, reason: 'oops' })?.code).toBe(
      'RETURN_CANCEL_REASON_REQUIRED',
    );
  });

  it('refuses a return that is not completed', () => {
    expect(validateReturnCancellation({ ...base, status: 'CANCELLED' })?.code).toBe(
      'RETURN_NOT_CANCELLABLE',
    );
  });

  it('refuses when the exchange credit was already spent', () => {
    expect(validateReturnCancellation({ ...base, linkedSaleCount: 1 })?.code).toBe(
      'RETURN_ALREADY_EXCHANGED',
    );
  });

  it('recovers store credit only when the balance still covers it', () => {
    const storeCredit = { ...base, refundMethod: 'STORE_CREDIT' };
    expect(
      validateReturnCancellation({ ...storeCredit, customerCreditBalance: 500 }),
    ).toBeNull();
    expect(
      validateReturnCancellation({ ...storeCredit, customerCreditBalance: 100 })?.code,
    ).toBe('RETURN_CREDIT_ALREADY_SPENT');
  });

  it('requires a customer for a store-credit reversal', () => {
    expect(
      validateReturnCancellation({
        ...base,
        refundMethod: 'STORE_CREDIT',
        customerId: null,
      })?.code,
    ).toBe('RETURN_STORE_CREDIT_NO_CUSTOMER');
  });
});
