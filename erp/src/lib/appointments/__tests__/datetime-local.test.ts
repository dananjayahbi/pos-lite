import { describe, expect, it } from 'vitest';

import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/appointments/datetime-local';

/**
 * ARGUS #118: the appointment form sliced the UTC ISO string into the
 * datetime-local control, so 10:00 local rendered as 04:30 and every keystroke
 * shifted the stored instant. The helpers below convert through the browser's
 * local wall clock.
 */
describe('appointment datetime-local helpers', () => {
  it('displays a UTC instant as the same local wall-clock time', () => {
    const localTenAm = new Date(2026, 11, 1, 10, 0, 0, 0);

    expect(toDatetimeLocalValue(localTenAm.toISOString())).toBe('2026-12-01T10:00');
  });

  it('converts a local input value back to the matching UTC instant', () => {
    const iso = fromDatetimeLocalValue('2026-12-01T10:00');

    expect(iso).toBe(new Date(2026, 11, 1, 10, 0, 0, 0).toISOString());
  });

  it('round-trips local time without drifting by the zone offset', () => {
    for (const local of ['2026-01-15T09:05', '2026-06-30T23:45', '2026-12-01T00:00']) {
      expect(toDatetimeLocalValue(fromDatetimeLocalValue(local))).toBe(local);
    }
  });

  it('drops seconds to match the minute-precision control', () => {
    const withSeconds = new Date(2026, 11, 1, 10, 0, 45, 0).toISOString();

    expect(toDatetimeLocalValue(withSeconds)).toBe('2026-12-01T10:00');
  });

  it('returns an empty value for empty or unparseable input', () => {
    expect(toDatetimeLocalValue('')).toBe('');
    expect(toDatetimeLocalValue(null)).toBe('');
    expect(toDatetimeLocalValue('not-a-date')).toBe('');
    expect(fromDatetimeLocalValue('')).toBe('');
    expect(fromDatetimeLocalValue('not-a-date')).toBe('');
  });
});
