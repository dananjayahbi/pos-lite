/**
 * ARGUS #135 — reminder rows carry a delivery status (PENDING/SENT/FAILED) and
 * a channel. This pure module normalises the labels and counts so the detail
 * panel and the Settings reminder card never disagree with the API.
 */
export type AppointmentReminderStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface ReminderStatusCounts {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export interface ReminderStatusBucket {
  status: string;
  count: number;
}

export const REMINDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  FAILED: 'Failed',
};

export function reminderStatusLabel(status: string): string {
  return REMINDER_STATUS_LABELS[status.toUpperCase()] ?? status;
}

export function summarizeReminderStatusCounts(
  buckets: readonly ReminderStatusBucket[],
): ReminderStatusCounts {
  let pending = 0;
  let sent = 0;
  let failed = 0;

  for (const bucket of buckets) {
    const status = bucket.status.toUpperCase();
    if (status === 'PENDING') pending += bucket.count;
    else if (status === 'SENT') sent += bucket.count;
    else if (status === 'FAILED') failed += bucket.count;
  }

  return { pending, sent, failed, total: pending + sent + failed };
}

export function reminderStatusBuckets(
  rows: readonly { status: string }[],
): ReminderStatusBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const status = row.status.toUpperCase();
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return Array.from(counts, ([status, count]) => ({ status, count }));
}

export function summarizeReminderStatuses(
  rows: readonly { status: string }[],
): ReminderStatusCounts {
  return summarizeReminderStatusCounts(reminderStatusBuckets(rows));
}
