'use client';

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

  const hasOutOfStock = variants.some((v) => v.stockQuantity === 0);
  if (hasOutOfStock) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-pearl" style={{ backgroundColor: '#9B2226' }}>
        Out of Stock
      </span>
    );
  }

  const hasLowStock = variants.some((v) => v.stockQuantity <= v.lowStockThreshold);
  if (hasLowStock) {
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
