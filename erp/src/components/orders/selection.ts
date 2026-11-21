/**
 * ARGUS #264 - one selection source for every Dispatch Orders bulk action.
 *
 * The page keeps a set of selected ids, but only the rows currently rendered
 * are actionable. These helpers derive the visible selection, drop ids that a
 * refetch/filter no longer shows, and implement the checkbox toggles so status,
 * prepare, print and the bulk count all agree.
 */

interface SelectableOrder {
  id: string;
}

/** Selected ids that are visible on the current page, in display order. */
export function visibleSelectedIds(
  selectedIds: ReadonlySet<string>,
  orders: readonly SelectableOrder[],
): string[] {
  return orders.filter((order) => selectedIds.has(order.id)).map((order) => order.id);
}

/**
 * Intersect a selection with the visible rows.
 *
 * A refetch can remove rows without the operator touching a filter (a status
 * was changed elsewhere, a search result expired). Hidden ids stay out of the
 * result so a later bulk action can never include them.
 */
export function pruneSelection(
  selectedIds: ReadonlySet<string>,
  orders: readonly SelectableOrder[],
): Set<string> {
  const visible = new Set(orders.map((order) => order.id));
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}

export function toggleSelection(
  selectedIds: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Toggle the page-level checkbox: select every visible row, or clear the
 * visible rows when they are all selected already.
 */
export function toggleAllVisible(
  selectedIds: ReadonlySet<string>,
  orders: readonly SelectableOrder[],
): Set<string> {
  if (orders.length > 0 && orders.every((order) => selectedIds.has(order.id))) {
    return new Set();
  }
  return new Set(orders.map((order) => order.id));
}
