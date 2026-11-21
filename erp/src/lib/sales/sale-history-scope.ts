/**
 * Sales history API scope (ARGUS #78).
 *
 * `/sales` is gated by `sale:view_history`, but `GET /api/store/sales` only
 * checked `sale:view` — so a cashier could read the whole tenant ledger by
 * calling the API directly. The POS still needs the same endpoint for its own
 * shift/held-sale queries (`shiftId + status=OPEN`), so the endpoint stays
 * available; the scope is what changes:
 *
 * - `sale:view_history` → tenant-wide (the Sales page behaviour);
 * - `sale:view` only    → the caller's own sales (`cashierId = self`), which
 *   covers CartPanel's held count, RetrieveHeldSalesSheet and shift close;
 * - neither             → forbidden (403), as before.
 *
 * Pure so the route and its tests share one decision.
 */

export type SaleHistoryScope =
  | { kind: 'tenant' }
  | { kind: 'cashier'; cashierId: string }
  | { kind: 'forbidden' };

export interface SaleHistoryScopeInput {
  canViewSale: boolean;
  canViewSaleHistory: boolean;
  userId: string;
}

export function resolveSaleHistoryScope(input: SaleHistoryScopeInput): SaleHistoryScope {
  if (!input.canViewSale) return { kind: 'forbidden' };
  if (input.canViewSaleHistory) return { kind: 'tenant' };
  return { kind: 'cashier', cashierId: input.userId };
}

export interface ScopableSaleFilters {
  cashierId?: string | undefined;
}

/**
 * Apply the scope to a caller's filters. A non-history caller cannot widen the
 * result by passing someone else's `cashierId`; the explicit value is replaced
 * with their own id. Tenant-wide callers keep their requested filters.
 */
export function applySaleHistoryScope<T extends object>(
  filters: T,
  scope: Exclude<SaleHistoryScope, { kind: 'forbidden' }>,
): T & ScopableSaleFilters {
  if (scope.kind === 'tenant') return filters;
  return { ...filters, cashierId: scope.cashierId };
}
