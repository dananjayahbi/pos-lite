/**
 * ARGUS #310 — customer Returns tab mapping/summary.
 *
 * Kept pure so the tab's totals and item counts are testable without the
 * customer API.
 */
export interface CustomerReturnLike {
  refundAmount: number | string;
  lines?: ReadonlyArray<{ quantity: number }> | null;
}

export interface CustomerReturnSummary {
  count: number;
  totalRefund: number;
  totalItems: number;
}

export function returnItemCount(entry: CustomerReturnLike): number {
  return (entry.lines ?? []).reduce((sum, line) => sum + line.quantity, 0);
}

export function summarizeCustomerReturns(
  returns: ReadonlyArray<CustomerReturnLike> | null | undefined,
): CustomerReturnSummary {
  const rows = returns ?? [];
  return rows.reduce<CustomerReturnSummary>(
    (summary, entry) => {
      const amount = Number(entry.refundAmount);
      return {
        count: summary.count + 1,
        totalRefund: summary.totalRefund + (Number.isFinite(amount) ? amount : 0),
        totalItems: summary.totalItems + returnItemCount(entry),
      };
    },
    { count: 0, totalRefund: 0, totalItems: 0 },
  );
}
