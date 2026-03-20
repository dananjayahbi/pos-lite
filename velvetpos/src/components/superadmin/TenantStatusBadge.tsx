'use client';

import { Badge } from '@/components/ui/badge';
import type { TenantStatus } from '@/generated/prisma/client';

const statusStyles: Record<TenantStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  GRACE_PERIOD: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-mist text-espresso/60',
};

const statusLabels: Record<TenantStatus, string> = {
  ACTIVE: 'Active',
  GRACE_PERIOD: 'Grace Period',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
};

export default function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <Badge className={statusStyles[status]}>
      {statusLabels[status]}
    </Badge>
  );
}
