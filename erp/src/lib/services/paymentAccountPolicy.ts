/**
 * Payment-account approval policy (ARGUS #428).
 *
 * There is no maker-checker queue for payment accounts, so high-risk events
 * require the OWNER role (the strongest existing money role) instead:
 *
 * - any account creation with a non-zero opening balance;
 * - any single transfer, deposit, withdrawal or closing sweep at or above
 *   `PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD`.
 *
 * Managers keep day-to-day movements below the limit. The policy is pure so the
 * API calls cannot drift from the documented rule.
 */

export const PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD = 100_000;

export type PaymentAccountOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'TRANSFER'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'CLOSE';

const OWNER_ROLES = new Set(['OWNER', 'SUPER_ADMIN']);

export interface PaymentAccountPolicyInput {
  operation: PaymentAccountOperation;
  actorRole: string;
  /** Movement amount; ignored for CREATE/UPDATE. */
  amount?: number | undefined;
  /** Opening balance supplied on CREATE. */
  openingBalance?: number | undefined;
}

export interface PaymentAccountPolicyDecision {
  allowed: boolean;
  requiresOwnerApproval: boolean;
  /** Present when `allowed` is false. */
  reason?: string;
  threshold: number;
}

function amountOf(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.abs(value);
}

export function evaluatePaymentAccountPolicy(
  input: PaymentAccountPolicyInput,
): PaymentAccountPolicyDecision {
  const isOwner = OWNER_ROLES.has(input.actorRole);
  const threshold = PAYMENT_ACCOUNT_OWNER_APPROVAL_THRESHOLD;

  if (input.operation === 'CREATE') {
    const openingBalance = amountOf(input.openingBalance);
    if (openingBalance > 0 && !isOwner) {
      return {
        allowed: false,
        requiresOwnerApproval: true,
        reason: 'Opening balances require owner approval. Create the account with a zero opening balance and ask an owner to fund it.',
        threshold,
      };
    }
  }

  if (
    input.operation === 'TRANSFER' ||
    input.operation === 'DEPOSIT' ||
    input.operation === 'WITHDRAW' ||
    input.operation === 'CLOSE'
  ) {
    const amount = amountOf(input.amount);
    if (amount >= threshold && !isOwner) {
      return {
        allowed: false,
        requiresOwnerApproval: true,
        reason: `Movements of Rs ${threshold.toLocaleString('en-US')} or more require owner approval.`,
        threshold,
      };
    }
  }

  return {
    allowed: true,
    requiresOwnerApproval: false,
    threshold,
  };
}
