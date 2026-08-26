'use client';

import { Badge } from '@/components/ui/badge';
import type { RawMaterialStockStatus } from '@/lib/services/rawMaterial.core';

const STYLES: Record<RawMaterialStockStatus, string> = {
  OUT: 'bg-red-100 text-red-700',
  LOW: 'bg-amber-100 text-amber-700',
  OK: 'bg-emerald-100 text-emerald-700',
};

const LABELS: Record<RawMaterialStockStatus, string> = {
  OUT: 'Out of stock',
  LOW: 'Low stock',
  OK: 'In stock',
};

export function RawMaterialStatusBadge({ status }: { status: RawMaterialStockStatus }) {
  return (
    <Badge variant="outline" className={`${STYLES[status]} hover:opacity-90`}>
      {LABELS[status]}
    </Badge>
  );
}
