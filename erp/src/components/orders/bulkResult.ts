/**
 * ARGUS #265 - bulk status/prepare results are per-id, so the UI must report
 * partial failures instead of toasting only the successful count.
 */
import type { BulkResultItem } from '@/lib/validators/order.validators';

export interface BulkFailure {
  id: string;
  message: string;
}

export interface BulkResultSummary {
  total: number;
  okCount: number;
  failedCount: number;
  succeededIds: string[];
  failures: BulkFailure[];
  /** Every requested row failed, or the server returned no rows at all. */
  allFailed: boolean;
  /** At least one row succeeded and at least one failed. */
  partial: boolean;
  allSucceeded: boolean;
}

export type BulkResultLevel = 'success' | 'warning' | 'error';

export interface BulkResultToast {
  level: BulkResultLevel;
  message: string;
}

function uniqueFailureReasons(failures: readonly BulkFailure[], limit = 3): string {
  const reasons: string[] = [];
  for (const failure of failures) {
    const reason = failure.message.trim() || 'Unknown error';
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  if (reasons.length <= limit) return reasons.join('; ');
  return `${reasons.slice(0, limit).join('; ')}; +${reasons.length - limit} more`;
}

export function summarizeBulkResults(
  results: readonly BulkResultItem[],
): BulkResultSummary {
  const succeededIds: string[] = [];
  const failures: BulkFailure[] = [];

  for (const result of results) {
    if (result.ok) {
      succeededIds.push(result.id);
    } else {
      failures.push({
        id: result.id,
        message: result.message?.trim() || 'Unknown error',
      });
    }
  }

  const total = results.length;
  const okCount = succeededIds.length;
  const failedCount = failures.length;

  return {
    total,
    okCount,
    failedCount,
    succeededIds,
    failures,
    allFailed: total === 0 || okCount === 0,
    partial: okCount > 0 && failedCount > 0,
    allSucceeded: total > 0 && failedCount === 0,
  };
}

/**
 * Build a toast that never hides rejected rows.
 *
 * `action` is the past-tense verb shown to the operator ("Updated", "Prepared
 * for delivery"). Failure reasons are de-duplicated so a shared rejection does
 * not repeat once per row.
 */
export function bulkResultToast(
  results: readonly BulkResultItem[],
  action: string,
): BulkResultToast {
  const summary = summarizeBulkResults(results);

  if (summary.total === 0) {
    return {
      level: 'error',
      message: `No orders were ${action.toLowerCase()} - no matching orders were found`,
    };
  }

  if (summary.allSucceeded) {
    return { level: 'success', message: `${action} ${summary.okCount} order(s)` };
  }

  const reasons = uniqueFailureReasons(summary.failures);

  if (summary.allFailed) {
    return {
      level: 'error',
      message: `No orders were ${action.toLowerCase()} - ${summary.failedCount} failed: ${reasons}`,
    };
  }

  return {
    level: 'warning',
    message: `${action} ${summary.okCount} of ${summary.total} order(s); ${summary.failedCount} failed: ${reasons}`,
  };
}

/**
 * Keep only rows that still need attention after a bulk action: successes drop
 * out of the selection, failures stay selected so they can be retried.
 */
export function retainFailedSelection(
  selectedIds: ReadonlySet<string>,
  results: readonly BulkResultItem[],
): Set<string> {
  const succeeded = new Set(
    results.filter((result) => result.ok).map((result) => result.id),
  );
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (!succeeded.has(id)) next.add(id);
  }
  return next;
}
