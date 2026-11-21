'use client';

import { Badge } from '@/components/ui/badge';
import { reminderStatusLabel } from '@/lib/appointments/appointmentReminders.core';

const REMINDER_STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

/** ARGUS #135 — delivery status for an appointment reminder row. */
export function ReminderStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${REMINDER_STATUS_CLASSES[status.toUpperCase()] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {reminderStatusLabel(status)}
    </Badge>
  );
}
