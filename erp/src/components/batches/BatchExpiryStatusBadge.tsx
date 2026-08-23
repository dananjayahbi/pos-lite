'use client';

import { Badge } from '@/components/ui/badge';
import type { BatchExpiryStatus } from '@/lib/services/batchTracking.core';

const STYLES: Record<BatchExpiryStatus, string> = {
  EXPIRED: 'bg-red-100 text-red-700',
  EXPIRING_SOON: 'bg-amber-100 text-amber-700',
  OK: 'bg-emerald-100 text-emerald-700',
};

const LABELS: Record<BatchExpiryStatus, string> = {
  EXPIRED: 'Expired',
  EXPIRING_SOON: 'Expiring soon',
  OK: 'Okay',
};

export function BatchExpiryStatusBadge({ status }: { status: BatchExpiryStatus }) {
  return (
    <Badge variant="outline" className={`${STYLES[status]} hover:opacity-90`}>
      {LABELS[status]}
    </Badge>
  );
}
