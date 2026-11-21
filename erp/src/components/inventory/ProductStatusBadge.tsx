'use client';

import { resolveProductStatusBadge } from '@/lib/inventory/stockState';

interface ProductStatusBadgeProps {
  isArchived: boolean;
  /** True in the soft-deleted ("Deleted") inventory view (ARGUS #149). */
  isDeleted?: boolean;
  variants: Array<{ stockQuantity: number; lowStockThreshold: number }>;
}

const BADGE_CLASS = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

export function ProductStatusBadge({ isArchived, isDeleted = false, variants }: ProductStatusBadgeProps) {
  const kind = resolveProductStatusBadge({ isDeleted, isArchived, variants });

  // Lifecycle states take precedence over stock: a deleted or archived row is
  // never described as Low Stock / Out of Stock (ARGUS #149).
  if (kind === 'DELETED') {
    return (
      <span className={`${BADGE_CLASS} bg-espresso/10 text-espresso`}>
        Deleted
      </span>
    );
  }

  if (kind === 'ARCHIVED') {
    return (
      <span className={`${BADGE_CLASS} bg-mist text-espresso`}>
        Archived
      </span>
    );
  }

  // One shared rule with the low/out-of-stock filters (ARGUS #142), so the
  // badge always agrees with the filter that produced the row.
  if (kind === 'OUT_OF_STOCK') {
    return (
      <span className={`${BADGE_CLASS} text-pearl`} style={{ backgroundColor: '#9B2226' }}>
        Out of Stock
      </span>
    );
  }

  if (kind === 'LOW_STOCK') {
    return (
      <span className={`${BADGE_CLASS} text-pearl`} style={{ backgroundColor: '#B7791F' }}>
        Low Stock
      </span>
    );
  }

  return (
    <span className={`${BADGE_CLASS} text-pearl`} style={{ backgroundColor: '#2D6A4F' }}>
      Active
    </span>
  );
}
