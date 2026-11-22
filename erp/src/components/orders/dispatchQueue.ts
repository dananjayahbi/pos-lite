import type { DeliveryStatus } from '@/generated/prisma/client';

/**
 * ARGUS #269 - the Dispatch Orders page opened on "All statuses" over every
 * delivery (including finished and cancelled work) with no workload summary.
 *
 * The default is the pre-dispatch queue: newly placed orders plus those waiting
 * for dispatch. Per-status counts keep the rest one click away.
 */
export const DISPATCH_QUEUE_STATUSES: DeliveryStatus[] = ['PLACED', 'PENDING_DISPATCH'];

/** `'queue'` is the dispatch-focused default; `null` means all statuses. */
export type DispatchStatusSelection = DeliveryStatus | 'queue' | null;

export const DEFAULT_DISPATCH_STATUS_SELECTION: DispatchStatusSelection = 'queue';

/** Statuses to send to the API for a selection. */
export function resolveDispatchStatuses(
  selection: DispatchStatusSelection,
): DeliveryStatus[] | null {
  if (selection === 'queue') return [...DISPATCH_QUEUE_STATUSES];
  if (selection === null) return null;
  return [selection];
}

/** Chip label for the queue, used beside the per-status counts. */
export function dispatchQueueLabel(count: number | undefined): string {
  const value = count ?? 0;
  return `Dispatch queue (${value})`;
}
