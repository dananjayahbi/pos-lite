/**
 * ARGUS #182 — stock-take row actions.
 *
 * A session awaiting approval has no counting work left; the Review link must
 * open the approval screen. In-progress sessions keep the counting page.
 */
export interface StockTakeAction {
  href: string;
  label: string;
}

export function stockTakeAction(
  sessionId: string,
  status: string | null | undefined,
): StockTakeAction {
  const detailHref = `/stock-control/stock-takes/${sessionId}`;

  if (status === 'IN_PROGRESS') {
    return { href: detailHref, label: 'Continue Counting' };
  }
  if (status === 'PENDING_APPROVAL') {
    return { href: `${detailHref}/review`, label: 'Review' };
  }
  return { href: detailHref, label: 'View Details' };
}
