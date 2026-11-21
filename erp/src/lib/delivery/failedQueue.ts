/**
 * Failed-delivery recovery queue (ARGUS #515).
 *
 * The sidebar link "Failed Deliveries & Recovery" opened a staff performance
 * report with no queue. This helper merges the two recoverable delivery
 * populations (FAILED and RETURNED) into one deduplicated, deterministic list.
 */

export const FAILED_QUEUE_STATUSES = ['FAILED', 'RETURNED'] as const;

export type FailedQueueStatus = (typeof FAILED_QUEUE_STATUSES)[number];

export interface FailedQueueRowLike {
  id: string;
  status: string;
  orderRef: string;
  codAmount?: number | string | null;
}

export interface FailedQueueSummary {
  total: number;
  failed: number;
  returned: number;
  codTotal: number;
}

function amountOf(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isFailedQueueStatus(status: string): status is FailedQueueStatus {
  return (FAILED_QUEUE_STATUSES as readonly string[]).includes(status);
}

/** Merge both status queries, dedupe by id, filter to the queue and sort by ref. */
export function mergeFailedDeliveries<T extends FailedQueueRowLike>(
  ...lists: T[][]
): T[] {
  const byId = new Map<string, T>();
  for (const row of lists.flat()) {
    if (!isFailedQueueStatus(row.status)) continue;
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.orderRef.localeCompare(b.orderRef),
  );
}

export function summarizeFailedDeliveries(
  rows: FailedQueueRowLike[],
): FailedQueueSummary {
  let failed = 0;
  let returned = 0;
  let codTotal = 0;

  for (const row of rows) {
    if (row.status === 'FAILED') failed += 1;
    if (row.status === 'RETURNED') returned += 1;
    codTotal += amountOf(row.codAmount);
  }

  return {
    total: failed + returned,
    failed,
    returned,
    codTotal: Math.round((codTotal + Number.EPSILON) * 100) / 100,
  };
}
