/**
 * Helpers for computing cart totals and formatting them for display.
 */

import { formatLKR } from '@/lib/utils';
import type { CartLine } from '@/stores/cartStore';

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  formattedSubtotal: string;
  /** True when every line has stock > its quantity. */
  allInStock: boolean;
}

export function computeCartTotals(lines: CartLine[]): CartTotals {
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
  const allInStock = lines.every((l) => l.maxStock >= l.quantity);
  return {
    itemCount,
    subtotal,
    formattedSubtotal: formatLKR(subtotal),
    allInStock,
  };
}