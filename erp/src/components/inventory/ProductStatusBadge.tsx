'use client';

import { getProductStockState } from '@/lib/inventory/stockState';

interface ProductStatusBadgeProps {
  isArchived: boolean;
  variants: Array<{ stockQuantity: number; lowStockThreshold: number }>;
}

export function ProductStatusBadge({ isArchived, variants }: ProductStatusBadgeProps) {
  if (isArchived) {
    return (
      <span className="inline-flex items-center rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium text-espresso">
        Archived
      </span>
    );
  }

  // One shared rule with the low/out-of-stock filters (ARGUS #142), so the
  // badge always agrees with the filter that produced the row.
  const state = getProductStockState(variants);

  if (state === 'OUT_OF_STOCK') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-pearl" style={{ backgroundColor: '#9B2226' }}>
        Out of Stock
      </span>
    );
  }

  if (state === 'LOW_STOCK') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-pearl" style={{ backgroundColor: '#B7791F' }}>
        Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-pearl" style={{ backgroundColor: '#2D6A4F' }}>
      Active
    </span>
  );
}
