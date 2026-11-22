import { describe, expect, it } from 'vitest';

import {
  PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD,
  evaluatePaymentAccountPolicy,
} from '@/lib/services/paymentAccountPolicy';

/** ARGUS #428: owner-gated opening balances and large movements. */
describe('payment-account policy', () => {
  it('denies a manager creating an account with an opening balance', () => {
    const decision = evaluatePaymentAccountPolicy({
      operation: 'CREATE',
      actorRole: 'MANAGER',
      openingBalance: 25_000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresOwnerApproval).toBe(true);
    expect(decision.reason).toContain('Opening balances');
  });

  it('allows a manager to create a zero-opening-balance account', () => {
    const decision = evaluatePaymentAccountPolicy({
      operation: 'CREATE',
      actorRole: 'MANAGER',
      openingBalance: 0,
    });
    expect(decision.allowed).toBe(true);
  });

  it('allows an owner to create with any opening balance', () => {
    const decision = evaluatePaymentAccountPolicy({
      operation: 'CREATE',
      actorRole: 'OWNER',
      openingBalance: 500_000,
    });
    expect(decision.allowed).toBe(true);
  });

  it('allows manager movements below the threshold', () => {
    const decision = evaluatePaymentAccountPolicy({
      operation: 'TRANSFER',
      actorRole: 'MANAGER',
      amount: PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD - 0.01,
    });
    expect(decision.allowed).toBe(true);
  });

  it('requires an owner at or above the threshold', () => {
    for (const operation of ['TRANSFER', 'DEPOSIT', 'WITHDRAW', 'CLOSE'] as const) {
      const manager = evaluatePaymentAccountPolicy({
        operation,
        actorRole: 'MANAGER',
        amount: PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD,
      });
      const owner = evaluatePaymentAccountPolicy({
        operation,
        actorRole: 'OWNER',
        amount: PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD,
      });

      expect(manager.allowed, operation).toBe(false);
      expect(manager.requiresOwnerApproval, operation).toBe(true);
      expect(owner.allowed, operation).toBe(true);
    }
  });

  it('never gates metadata updates', () => {
    const decision = evaluatePaymentAccountPolicy({
      operation: 'UPDATE',
      actorRole: 'MANAGER',
      amount: 999_999,
    });
    expect(decision.allowed).toBe(true);
  });
});
