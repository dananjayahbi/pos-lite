/**
 * Query-key helpers for the purchase-order feature.
 *
 * Details keys live under the singular `purchase-order` root because the
 * receiving page already invalidates `['purchase-order', poId]`; keeping the
 * same shape means one invalidation refreshes the detail, the payments panel
 * and the receiving worksheet together.
 */

export interface POListFilters {
  supplierId: string;
  status: string;
  from: string;
  to: string;
  page: number;
}

export const poQueryKeys = {
  all: ['purchase-orders'] as const,

  lists: () => ['purchase-orders', 'list'] as const,
  list: (filters: POListFilters) =>    [
      'purchase-orders',
      'list',
      filters.supplierId,
      filters.status,
      filters.from,
      filters.to,
      filters.page,
    ] as const,

  details: () => ['purchase-order'] as const,
  detail: (poId: string) => ['purchase-order', poId] as const,
  payments: (poId: string) => ['purchase-order', poId, 'payments'] as const,

  /** Next-reference suggestion, keyed by the `yyyy-mm` month it applies to. */
  reference: (monthKey: string) => ['purchase-orders', 'reference', monthKey] as const,

  variantSearch: (term: string) => ['variant-search', term] as const,

  supplierOptions: () => ['suppliers', 'dropdown'] as const,
  paymentAccounts: () => ['payment-accounts', 'list'] as const,
};
