/**
 * Shared delete-blocking copy for resources that still have products assigned
 * (categories, brands). Kept pure so the list row and the detail panel cannot
 * drift into two different explanations for the same constraint (ARGUS #165).
 */

export function assignedProductsReason(count: number): string {
  return `${count} product${count === 1 ? '' : 's'} assigned - reassign or archive them first`;
}

/** Blocked reason for an in-use category, or `undefined` when deletable. */
export function categoryDeleteBlockedReason(count: number): string | undefined {
  return count > 0 ? assignedProductsReason(count) : undefined;
}
