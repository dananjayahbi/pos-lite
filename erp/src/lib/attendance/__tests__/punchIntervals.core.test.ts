/**
 * ARGUS #356 — a day's displayed interval must be explainable by its punches.
 */
import { describe, expect, it } from 'vitest';
import { summarizePunchIntervals } from '@/lib/attendance/punchIntervals.core';

function punch(
  id: string,
  startIso: string,
  endIso: string | null,
  durationMinutes: number,
) {
  return { id, clockedInAt: startIso, clockedOutAt: endIso, durationMinutes };
}

describe('summarizePunchIntervals', () => {
  it('keeps every interval instead of collapsing them to first-in/last-out', () => {
    const summary = summarizePunchIntervals([
      punch('a', '2026-11-06T03:30:00.000Z', '2026-11-06T03:32:00.000Z', 2),
      punch('b', '2026-11-06T03:35:00.000Z', '2026-11-06T03:36:00.000Z', 1),
      punch('c', '2026-11-06T03:38:00.000Z', '2026-11-06T03:39:00.000Z', 1),
    ]);

    expect(summary.count).toBe(3);
    expect(summary.intervals.map((interval) => interval.id)).toEqual(['a', 'b', 'c']);
    expect(summary.workedMinutes).toBe(4);
    expect(summary.spanMinutes).toBe(9); // 03:30 -> 03:39
    expect(summary.gapMinutes).toBe(5);
    expect(summary.hasMultiple).toBe(true);
  });

  it('reconciles a six-minute first-to-last span with four worked minutes', () => {
    const summary = summarizePunchIntervals([
      punch('a', '2026-11-06T09:00:00.000Z', '2026-11-06T09:02:00.000Z', 2),
      punch('b', '2026-11-06T09:04:00.000Z', '2026-11-06T09:06:00.000Z', 2),
    ]);

    expect(summary.spanMinutes).toBe(6);
    expect(summary.workedMinutes).toBe(4);
    expect(summary.gapMinutes).toBe(2);
    expect(summary.spanMinutes).toBe(summary.workedMinutes + summary.gapMinutes);
  });

  it('returns a single interval unchanged', () => {
    const summary = summarizePunchIntervals([
      punch('a', '2026-11-06T08:00:00.000Z', '2026-11-06T16:00:00.000Z', 480),
    ]);

    expect(summary.count).toBe(1);
    expect(summary.workedMinutes).toBe(480);
    expect(summary.spanMinutes).toBe(480);
    expect(summary.gapMinutes).toBe(0);
    expect(summary.hasMultiple).toBe(false);
  });

  it('derives an open punch end from the capped duration', () => {
    const summary = summarizePunchIntervals([
      punch('a', '2026-11-06T08:00:00.000Z', null, 240),
    ]);

    expect(summary.intervals[0]!.isOpen).toBe(true);
    expect(summary.intervals[0]!.endAt).toBe('2026-11-06T12:00:00.000Z');
    expect(summary.workedMinutes).toBe(240);
  });

  it('ignores malformed rows and empty days', () => {
    const summary = summarizePunchIntervals([
      punch('bad', 'not-a-date', null, 0),
    ]);
    expect(summary.count).toBe(0);
    expect(summary.spanMinutes).toBe(0);
    expect(summary.gapMinutes).toBe(0);

    expect(summarizePunchIntervals([])).toEqual({
      count: 0,
      intervals: [],
      workedMinutes: 0,
      spanMinutes: 0,
      gapMinutes: 0,
      hasMultiple: false,
    });
  });
});
