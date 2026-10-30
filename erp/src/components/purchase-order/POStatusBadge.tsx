'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Status pill for a purchase order.
 *
 * The styles are centralised here because the list, the detail page and the
 * receiving worksheet each used to carry their own copy and drifted apart.
 */

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-sand/30 text-espresso',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700',
  RECEIVED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700 line-through',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export function POStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(STATUS_STYLES[status] ?? 'bg-linen text-espresso/60', className)}
    >
      {STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  );
}
