/**
 * One shared prefix for every sales-list query.
 *
 * `SaleHistoryTable` reads `['sale-history', …]`, so a create/edit elsewhere in
 * the app must invalidate THAT prefix. Before this module existed, the record
 * sheet invalidated `['sales']` — a key nothing listened to — and the table
 * only refreshed after a manual page reload.
 */
export const SALES_QUERY_KEY = 'sale-history' as const;

/** Prefix for the paginated management/history list. */
export function saleQueryKey() {
  return [SALES_QUERY_KEY] as const;
}
