/**
 * Brand delete-blocking rule (ARGUS #176).
 *
 * The blocked-lock copy is shared with categories so the two resources cannot
 * explain the same "products still assigned" constraint differently. The rule
 * is only a delegate: archiving a product does NOT unlink it, so the guard
 * keeps counting every live product until it is reassigned or deleted.
 */

import { assignedProductsReason } from '@/lib/categories/categoryDelete.core';

/** Blocked reason for an in-use brand, or `undefined` when deletable. */
export function brandDeleteBlockedReason(count: number): string | undefined {
  return count > 0 ? assignedProductsReason(count) : undefined;
}
