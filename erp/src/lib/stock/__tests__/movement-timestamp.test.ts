import { describe, expect, it } from 'vitest';

import {
  formatStockMovementTimestamp,
  isValidTimeZone,
  stockMovementDisplayTimeZone,
} from '@/lib/stock/movement-timestamp';

/**
 * ARGUS #200 - the CSV must show the same local day/time as the Movement
 * History page instead of the raw UTC instant.
 */
describe('stock movement CSV timestamp', () => {
  const instant = '2026-11-15T17:37:00.000Z';

  it('formats the same local string as the page', () => {
    expect(formatStockMovementTimestamp(instant, 'Asia/Colombo')).toBe(
      '15 Nov 2026, 11:07 pm',
    );
  });

  it('can render UTC when the store zone is UTC', () => {
    expect(formatStockMovementTimestamp(instant, 'UTC')).toBe('15 Nov 2026, 5:37 pm');
  });

  it('keeps the local calendar day for a late-evening instant', () => {
    // 00:30 Colombo on 16 Nov is still 19:00 UTC on 15 Nov.
    const late = '2026-11-15T19:00:00.000Z';
    expect(formatStockMovementTimestamp(late, 'Asia/Colombo')).toContain('16 Nov 2026');
    expect(formatStockMovementTimestamp(late, 'UTC')).toContain('15 Nov 2026');
  });

  it('accepts a Date instance and rejects an invalid date', () => {
    expect(
      formatStockMovementTimestamp(new Date(instant), 'Asia/Colombo'),
    ).toBe('15 Nov 2026, 11:07 pm');
    expect(formatStockMovementTimestamp('not-a-date', 'UTC')).toBe('');
  });

  it('validates zones and falls back for an unknown configuration', () => {
    expect(isValidTimeZone('Asia/Colombo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(stockMovementDisplayTimeZone('Asia/Colombo')).toBe('Asia/Colombo');
    expect(stockMovementDisplayTimeZone('Mars/Olympus')).not.toBe('Mars/Olympus');
    expect(stockMovementDisplayTimeZone(null)).toBeTruthy();
  });
});
