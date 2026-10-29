/**
 * Wire shapes for the payment-account API.
 *
 * The API serialises Prisma `Decimal` columns as strings (decimal.js `toJSON`)
 * and `DateTime` columns as ISO strings, so every money/date field is typed as
 * a string here and formatted only at render time.
 */

export const PAYMENT_ACCOUNT_TYPES = [
  'CASH',
  'BANK',
  'PAYMENT_GATEWAY',
  'COURIER',
  'WALLET',
  'CREDIT_CARD',
] as const;

export type PaymentAccountType = (typeof PAYMENT_ACCOUNT_TYPES)[number];

export const PAYMENT_ENTRY_SOURCES = [
  'OPENING_BALANCE',
  'SALE',
  'SALE_REFUND',
  'PURCHASE_ORDER_PAYMENT',
  'EXPENSE',
  'DEPOSIT',
  'WITHDRAWAL',
  'FUND_TRANSFER',
  'ADJUSTMENT',
  'CLOSING_TRANSFER',
] as const;

export type PaymentEntrySource = (typeof PAYMENT_ENTRY_SOURCES)[number];

export type PaymentAccountStatus = 'ACTIVE' | 'CLOSED';

/** One row of the free-form "Account details" grid. */
export interface AccountDetailRow {
  label: string;
  value: string;
}

export interface PaymentAccount {
  id: string;
  name: string;
  type: PaymentAccountType;
  status: PaymentAccountStatus;
  accountNumber: string | null;
  details: AccountDetailRow[] | null;
  note: string | null;
  balance: string;
  closedAt: string | null;
  createdAt: string;
}

export interface PaymentAccountEntryAccountRef {
  id: string;
  name: string;
  type: PaymentAccountType;
}

export interface PaymentAccountEntry {
  id: string;
  source: PaymentEntrySource;
  description: string;
  debit: string;
  credit: string;
  balanceAfter: string;
  entryDate: string;
  createdAt: string;
  /** Present on the tenant-wide cash-flow view only. */
  account?: PaymentAccountEntryAccountRef;
}

export interface LedgerSums {
  debit: number;
  credit: number;
}

export interface PaymentAccountListResult {
  accounts: PaymentAccount[];
  totalBalance: number;
}

export interface AccountBookResult {
  account: PaymentAccount;
  entries: PaymentAccountEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sums: LedgerSums;
}

export interface CashFlowResult {
  entries: PaymentAccountEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sums: LedgerSums;
}

// ── Request payloads ─────────────────────────────────────────────────────────
// Dialogs build these; the page client turns them into mutations, so transport
// and cache invalidation live in exactly one place.

export interface CreateAccountPayload {
  name: string;
  type: PaymentAccountType;
  accountNumber?: string;
  openingBalance?: number;
  note?: string;
  details?: AccountDetailRow[];
}

export interface UpdateAccountPayload {
  name: string;
  type: PaymentAccountType;
  accountNumber: string | null;
  note: string | null;
  details: AccountDetailRow[];
}

export interface TransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  entryDate?: string;
  note?: string;
}

export interface DepositPayload {
  fromAccountId: string | null;
  amount: number;
  entryDate?: string;
  note?: string;
}

export interface WithdrawalPayload {
  toAccountId: string | null;
  amount: number;
  entryDate?: string;
  note?: string;
}

export interface ClosePayload {
  transferToAccountId?: string;
  note?: string;
}
