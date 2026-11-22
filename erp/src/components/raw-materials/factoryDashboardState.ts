/**
 * ARGUS #244 — factory dashboard feed state.
 *
 * The dashboard used to derive every panel from `data?.data ?? []`, so a failed
 * alerts/stats/production request looked exactly like a genuine empty response:
 * a green "all raw materials are above their thresholds" all-clear, a dash KPI
 * with no explanation, or "No production runs recorded yet". The states are
 * resolved explicitly here (error first) so a failed fetch can never render an
 * empty/healthy panel, and the UI no longer shows last-known data as current.
 */
export type FactoryFeedViewState = 'error' | 'loading' | 'empty' | 'data';

export interface FactoryFeedStateInput {
  /** The query failed (non-2xx, network error or rejected envelope). */
  isError: boolean;
  /** First load in flight. */
  isLoading: boolean;
  /** Rows in the successful response. */
  itemCount: number;
}

export function resolveFactoryFeedState(input: FactoryFeedStateInput): FactoryFeedViewState {
  // Error outranks loading and every data-dependent state: a refetch failure
  // must not fall back to the healthy empty copy.
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  if (input.itemCount === 0) return 'empty';
  return 'data';
}

/**
 * KPI figure for the summary cards. While the stats feed is loading or failed
 * the value is a neutral dash (never 0, which would read as "none"), and only a
 * successful response may show a number.
 */
export function factoryKpiValue(
  state: FactoryFeedViewState,
  value: number | null | undefined,
): string {
  if (state !== 'data' || value == null || !Number.isFinite(value)) return '-';
  return String(value);
}

/** Human message for an error card; never empty, never leaks a stack. */
export function factoryFeedErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

/** The minimum alert shape the dashboard population needs. */
export interface FactoryStockAlertLike {
  rawMaterialId: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
  severity: 'LOW' | 'CRITICAL';
}

export interface FactoryStockPopulation<T extends FactoryStockAlertLike> {
  /** Every flagged material once, critical/out-of-stock first. */
  items: T[];
  /** Materials at or below a positive threshold but still above zero. */
  lowCount: number;
  /** Materials at zero (or below) regardless of the configured threshold. */
  outOfStockCount: number;
  /** The single population size shared by the KPIs, list and alert summary. */
  flaggedCount: number;
}

/**
 * ARGUS #258 - one low-stock population for the whole dashboard.
 *
 * The KPI counted LOW rows from `raw-material-stats`, the alerts panel counted
 * LOW + CRITICAL from `raw-material-alerts`, and the list asked a third endpoint
 * for `stockStatus=LOW&limit=5`. The three surfaces could therefore disagree
 * (an out-of-stock row was critical in one place and absent from the list in
 * another; a sixth low row never reached the list at all). The dashboard now
 * derives the KPI figures and the list from the alert feed, so every surface
 * describes the same rows in the same order.
 *
 * Severity is normalised from quantity: zero or negative stock is always
 * CRITICAL, which also keeps this helper consistent with ARGUS #260's alert
 * rule even if an older API response carried a stale severity.
 */
export function buildFactoryStockPopulation<T extends FactoryStockAlertLike>(
  alerts: readonly T[],
): FactoryStockPopulation<T> {
  const byId = new Map<string, T & { severity: 'LOW' | 'CRITICAL' }>();
  for (const alert of alerts) {
    const severity = alert.quantity <= 0 ? 'CRITICAL' : 'LOW';
    const normalised = { ...alert, severity } as T & { severity: 'LOW' | 'CRITICAL' };
    if (!byId.has(alert.rawMaterialId)) byId.set(alert.rawMaterialId, normalised);
  }

  const items = [...byId.values()].sort(
    (a, b) =>
      (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1) ||
      a.quantity - b.quantity ||
      a.name.localeCompare(b.name),
  ) as T[];

  let lowCount = 0;
  let outOfStockCount = 0;
  for (const item of items) {
    if (item.severity === 'CRITICAL') outOfStockCount += 1;
    else lowCount += 1;
  }

  return {
    items,
    lowCount,
    outOfStockCount,
    flaggedCount: items.length,
  };
}

/** The status badge vocabulary the list rows use. */
export function factoryAlertStockStatus(severity: 'LOW' | 'CRITICAL'): 'LOW' | 'OUT' {
  return severity === 'CRITICAL' ? 'OUT' : 'LOW';
}
