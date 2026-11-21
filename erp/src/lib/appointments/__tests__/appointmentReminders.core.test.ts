import { describe, expect, it } from 'vitest';

import {
  reminderStatusBuckets,
  reminderStatusLabel,
  summarizeReminderStatusCounts,
  summarizeReminderStatuses,
} from '@/lib/appointments/appointmentReminders.core';

describe('reminder status summary', () => {
  it('counts each status and ignores unknown values', () => {
    expect(
      summarizeReminderStatuses([
        { status: 'PENDING' },
        { status: 'pending' },
        { status: 'SENT' },
        { status: 'FAILED' },
        { status: 'UNKNOWN' },
      ]),
    ).toEqual({ pending: 2, sent: 1, failed: 1, total: 4 });
  });

  it('handles an empty list', () => {
    expect(summarizeReminderStatuses([])).toEqual({ pending: 0, sent: 0, failed: 0, total: 0 });
  });

  it('aggregates API group-by buckets', () => {
    expect(
      summarizeReminderStatusCounts([
        { status: 'PENDING', count: 70 },
        { status: 'SENT', count: 3 },
        { status: 'FAILED', count: 2 },
      ]),
    ).toEqual({ pending: 70, sent: 3, failed: 2, total: 75 });
  });

  it('builds uppercase buckets from rows', () => {
    expect(reminderStatusBuckets([{ status: 'sent' }, { status: 'SENT' }])).toEqual([
      { status: 'SENT', count: 2 },
    ]);
  });

  it('labels the three delivery states', () => {
    expect(reminderStatusLabel('PENDING')).toBe('Pending');
    expect(reminderStatusLabel('sent')).toBe('Sent');
    expect(reminderStatusLabel('FAILED')).toBe('Failed');
    expect(reminderStatusLabel('OTHER')).toBe('OTHER');
  });
});
