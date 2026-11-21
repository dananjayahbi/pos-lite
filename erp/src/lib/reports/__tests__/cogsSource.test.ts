import { describe, expect, it } from 'vitest';

import { summarizeCogsSource } from '@/lib/reports/cogsSource';

/** ARGUS #436: fallback COGS must be visible, not silently mixed with snapshots. */
describe('summarizeCogsSource', () => {
  it('reports no fallback when every line has a cost snapshot', () => {
    const result = summarizeCogsSource({
      snapshotCogs: '1200.00',
      fallbackCogs: 0,
      snapshotLines: 72,
      fallbackLines: 0,
    });

    expect(result.total).toBe(1200);
    expect(result.usesFallback).toBe(false);
    expect(result.fallbackPercent).toBe(0);
    expect(result.caveat).toBeNull();
  });

  it('surfaces the fallback count, value and share', () => {
    const result = summarizeCogsSource({
      snapshotCogs: '867.50',
      fallbackCogs: '132.50',
      snapshotLines: 13,
      fallbackLines: 59,
    });

    expect(result.total).toBe(1000);
    expect(result.snapshotLines).toBe(13);
    expect(result.fallbackLines).toBe(59);
    expect(result.totalLines).toBe(72);
    expect(result.usesFallback).toBe(true);
    expect(result.fallbackPercent).toBe(13.25);
    expect(result.caveat).toContain('59 sale line(s)');
    expect(result.caveat).toContain('132.50');
  });

  it('handles an empty period', () => {
    const result = summarizeCogsSource({
      snapshotCogs: 0,
      fallbackCogs: 0,
      snapshotLines: 0,
      fallbackLines: 0,
    });

    expect(result.total).toBe(0);
    expect(result.usesFallback).toBe(false);
    expect(result.caveat).toBeNull();
  });
});
