import { describe, expect, it } from 'vitest';

import { getEffectivePermissions, PERMISSIONS } from '@/lib/constants/permissions';
import { resolvePaymentAccountCapabilities } from '@/lib/services/paymentAccountAccess.core';

/** ARGUS #427: destination selection must not expose the management ledger. */
describe('payment-account capabilities', () => {
  it('gives a cashier destination selection but no ledger or controls', () => {
    const capabilities = resolvePaymentAccountCapabilities(
      getEffectivePermissions('CASHIER', []),
    );

    expect(capabilities.canUseDestinationPicker).toBe(true);
    expect(capabilities.canViewLedger).toBe(false);
    expect(capabilities.canManageAccounts).toBe(false);
    expect(capabilities.canTransfer).toBe(false);
    expect(capabilities.canDeposit).toBe(false);
    expect(capabilities.canWithdraw).toBe(false);
    expect(capabilities.canClose).toBe(false);
  });

  it('gives a stock clerk destination selection only', () => {
    const capabilities = resolvePaymentAccountCapabilities(
      getEffectivePermissions('STOCK_CLERK', []),
    );

    expect(capabilities.canUseDestinationPicker).toBe(true);
    expect(capabilities.canViewLedger).toBe(false);
  });

  it('gives owner and manager the full ledger and movement controls', () => {
    for (const role of ['OWNER', 'MANAGER'] as const) {
      const capabilities = resolvePaymentAccountCapabilities(
        getEffectivePermissions(role, []),
      );

      expect(capabilities.canViewLedger, role).toBe(true);
      expect(capabilities.canManageAccounts, role).toBe(true);
      expect(capabilities.canTransfer, role).toBe(true);
      expect(capabilities.canDeposit, role).toBe(true);
      expect(capabilities.canWithdraw, role).toBe(true);
      expect(capabilities.canClose, role).toBe(true);
      expect(capabilities.canUseDestinationPicker, role).toBe(true);
    }
  });

  it('honours an explicit permission override without leaking the ledger', () => {
    const capabilities = resolvePaymentAccountCapabilities([
      PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount,
      PERMISSIONS.PAYMENT_ACCOUNT.transferFunds,
    ]);

    expect(capabilities.canUseDestinationPicker).toBe(true);
    expect(capabilities.canTransfer).toBe(true);
    expect(capabilities.canViewLedger).toBe(false);
    expect(capabilities.canDeposit).toBe(false);
  });
});
