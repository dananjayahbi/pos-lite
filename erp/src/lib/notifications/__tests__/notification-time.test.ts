import { describe, expect, it } from 'vitest';

import { formatDisplayDate } from '@/lib/format';
import { formatNotificationTime } from '@/lib/notifications/notification-time';

/** ARGUS #56: old notification rows must use day-first dates, not US style. */
describe('formatNotificationTime', () => {
  const now = new Date(2026, 10, 22, 12, 0, 0).getTime();

  it('keeps the short relative labels for recent rows', () => {
    expect(formatNotificationTime(new Date(2026, 10, 22, 11, 59, 30).toISOString(), now)).toBe(
      'Just now',
    );
    expect(formatNotificationTime(new Date(2026, 10, 22, 11, 45).toISOString(), now)).toBe(
      '15m ago',
    );
    expect(formatNotificationTime(new Date(2026, 10, 22, 9, 0).toISOString(), now)).toBe('3h ago');
    expect(formatNotificationTime(new Date(2026, 10, 21, 9, 0).toISOString(), now)).toBe(
      'Yesterday',
    );
    expect(formatNotificationTime(new Date(2026, 10, 19, 12, 0).toISOString(), now)).toBe(
      '3d ago',
    );
  });

  it('renders rows older than a week as a day-first date', () => {
    const old = new Date(2026, 9, 28, 12, 0, 0).toISOString();
    expect(formatNotificationTime(old, now)).toBe('28 Oct 2026');
    expect(formatNotificationTime(old, now)).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('handles an unparseable date without rendering Invalid Date', () => {
    expect(formatNotificationTime('not-a-date', now)).toBe('');
  });
});

describe('formatDisplayDate', () => {
  it('formats day-first with a short month', () => {
    expect(formatDisplayDate(new Date(2026, 0, 5, 10, 30))).toBe('05 Jan 2026');
  });

  it('returns an empty string for an invalid value', () => {
    expect(formatDisplayDate('nope')).toBe('');
  });
});
