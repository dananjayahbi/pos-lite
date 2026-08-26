'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  CONFIRMED: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
  CHECKED_IN: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  IN_PROGRESS: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  COMPLETED: 'bg-green-100 text-green-800 hover:bg-green-100',
  NO_SHOW: 'bg-red-100 text-red-800 hover:bg-red-100',
  CANCELLED: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  NO_SHOW: 'No Show',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'} variant="outline">
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
