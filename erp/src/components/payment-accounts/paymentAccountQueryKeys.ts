import type {
  PaymentEntrySource,
} from './paymentAccountTypes';

/**
 * Query-key helpers for the payment-account feature.
 *
 * Every key starts from the same root so a single
 * `invalidateQueries({ queryKey: paymentAccountKeys.all })` refreshes the list,
 * every account book and the cash-flow view after any money movement.
 */

interface AccountBookFilters {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  source: PaymentEntrySource | 'ALL';
  page: number;
}

interface CashFlowFilters {
  dateFrom: string;
  dateTo: string;
  accountId: string;
  page: number;
}

const ROOT = 'payment-accounts' as const;

export const paymentAccountKeys = {
  all: [ROOT] as const,

  lists: () => [ROOT, 'list'] as const,
  list: () => [ROOT, 'list', 'all'] as const,

  accounts: () => [ROOT, 'account'] as const,
  account: (accountId: string) => [ROOT, 'account', accountId] as const,

  books: () => [ROOT, 'book'] as const,
  book: (filters: AccountBookFilters) =>
    [
      ROOT,
      'book',
      filters.accountId,
      filters.dateFrom,
      filters.dateTo,
      filters.source,
      filters.page,
    ] as const,

  cashFlows: () => [ROOT, 'cash-flow'] as const,
  cashFlow: (filters: CashFlowFilters) =>
    [
      ROOT,
      'cash-flow',
      filters.accountId || 'all',
      filters.dateFrom,
      filters.dateTo,
      filters.page,
    ] as const,
};
