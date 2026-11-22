import { describe, expect, it } from 'vitest';
import { punchDayChanged } from '@/lib/attendance/punchDay.core';

describe('punchDayChanged', () => {
  it('keeps a punch on its own day even when the time changes', () => {
    expect(
      punchDayChanged(
        new Date(2026, 10, 14, 9, 0),
        new Date(2026, 10, 14, 17, 30),
      ),
    ).toBe(false);
  });

  it('detects a move to another calendar day', () => {
    expect(
      punchDayChanged(
        new Date(2026, 10, 14, 9, 0),
        new Date(2026, 10, 15, 9, 0),
      ),
    ).toBe(true);
  });

  it('compares local days, so a late-night edit stays on the same day', () => {
    expect(
      punchDayChanged(
        new Date(2026, 10, 14, 0, 5),
        new Date(2026, 10, 14, 23, 55),
      ),
    ).toBe(false);
  });

  it('treats invalid dates as unchanged so time validation reports them', () => {
    expect(punchDayChanged(new Date(Number.NaN), new Date(2026, 10, 14))).toBe(false);
  });
});
