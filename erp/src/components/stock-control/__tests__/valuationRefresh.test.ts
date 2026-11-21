import { describe, expect, it } from 'vitest';

import { valuationRefreshOutcome } from '@/components/stock-control/valuationRefresh';

describe('valuationRefreshOutcome (ARGUS #221)', () => {
  it('confirms success only when the refetch returned a snapshot', () => {
    expect(valuationRefreshOutcome(null)).toEqual({
      ok: true,
      message: 'Valuation refreshed',
    });
    expect(valuationRefreshOutcome(undefined)).toEqual({
      ok: true,
      message: 'Valuation refreshed',
    });
  });

  it('reports the server message when the recalculation fails', () => {
    expect(
      valuationRefreshOutcome({ message: 'Failed to calculate stock valuation' }),
    ).toEqual({
      ok: false,
      message: 'Refresh failed: Failed to calculate stock valuation',
    });
  });

  it('does not confirm success for an error without a message', () => {
    const outcome = valuationRefreshOutcome({});
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('may be out of date');
  });
});
