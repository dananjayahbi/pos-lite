'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-linen text-amber-800 hover:bg-linen',
  PENDING_DISPATCH: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  HOLD: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  PENDING_PICKUP: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
  DISPATCHED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  IN_TRANSIT: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  DELIVERED: 'bg-green-100 text-green-800 hover:bg-green-100',
  FAILED: 'bg-red-100 text-red-800 hover:bg-red-100',
  RETURNED: 'bg-red-100 text-red-800 hover:bg-red-100',
  CANCELED: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const STATUS_LABELS: Record<string, string> = {
  PLACED: 'Placed',
  PENDING_DISPATCH: 'Pending Dispatch',
  HOLD: 'On Hold',
  PENDING_PICKUP: 'Pending Pickup',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  RETURNED: 'Returned',
  CANCELED: 'Cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700 hover:bg-gray-100'}
      variant="outline"
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
