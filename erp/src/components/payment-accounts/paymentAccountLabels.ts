import type { PaymentAccountType, PaymentEntrySource } from './paymentAccountTypes';

/** Human labels for the six account types. */
export const ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string> = {
  CASH: 'Cash',
  BANK: 'Bank',
  PAYMENT_GATEWAY: 'Payment Gateway',
  COURIER: 'Courier',
  WALLET: 'Wallet',
  CREDIT_CARD: 'Credit Card',
};

/** Human labels for every ledger source. */
export const ENTRY_SOURCE_LABELS: Record<PaymentEntrySource, string> = {
  OPENING_BALANCE: 'Opening Balance',
  SALE: 'Sale',
  SALE_REFUND: 'Sale Refund',
  PURCHASE_ORDER_PAYMENT: 'Purchase Order Payment',
  EXPENSE: 'Expense',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  FUND_TRANSFER: 'Fund Transfer',
  ADJUSTMENT: 'Adjustment',
  CLOSING_TRANSFER: 'Closing Transfer',
};

/** `yyyy-mm-dd` in the viewer's local timezone — what `<Input type="date">` wants. */
export function todayIso(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function formatEntryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Money as a plain number, or `null` when the string is not numeric. */
export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}
