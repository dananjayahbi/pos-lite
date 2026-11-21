/**
 * Refresh feedback for the Stock Valuation page (ARGUS #221).
 *
 * `invalidateQueries()` resolves even when the refetch fails, so the page
 * toasted "Valuation refreshed" while showing stale figures. The refresh now
 * inspects the refetch result and only confirms success when a new snapshot
 * actually arrived.
 */

export interface ValuationRefreshOutcome {
  ok: boolean;
  message: string;
}

export function valuationRefreshOutcome(
  error: { message?: string } | null | undefined,
): ValuationRefreshOutcome {
  if (!error) {
    return { ok: true, message: 'Valuation refreshed' };
  }

  const typed = error.message?.trim();
  return {
    ok: false,
    message: typed
      ? `Refresh failed: ${typed}`
      : 'Refresh failed. The figures on screen may be out of date.',
  };
}
