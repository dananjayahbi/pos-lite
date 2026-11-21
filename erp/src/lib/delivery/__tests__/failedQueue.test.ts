import { describe, expect, it } from 'vitest';

import {
  isFailedQueueStatus,
  mergeFailedDeliveries,
  summarizeFailedDeliveries,
} from '@/lib/delivery/failedQueue';

/** ARGUS #515: failed-delivery queue must be its own operational list. */
describe('failed delivery queue', () => {
  it('merges FAILED and RETURNED, dedupes and sorts by order ref', () => {
    const rows = mergeFailedDeliveries(
      [
        { id: '2', status: 'FAILED', orderRef: 'DEL-2', codAmount: '100.00' },
        { id: '3', status: 'DELIVERED', orderRef: 'DEL-3', codAmount: '50.00' },
      ],
      [
        { id: '1', status: 'RETURNED', orderRef: 'DEL-1', codAmount: 25 },
        { id: '2', status: 'FAILED', orderRef: 'DEL-2', codAmount: '100.00' },
      ],
    );

    expect(rows.map((row) => row.id)).toEqual(['1', '2']);
  });

  it('summarises counts and COD value', () => {
    const summary = summarizeFailedDeliveries([
      { id: '1', status: 'FAILED', orderRef: 'DEL-1', codAmount: '100.50' },
      { id: '2', status: 'RETURNED', orderRef: 'DEL-2', codAmount: 25 },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.returned).toBe(1);
    expect(summary.codTotal).toBe(125.5);
  });

  it('recognises only the recoverable failed statuses', () => {
    expect(isFailedQueueStatus('FAILED')).toBe(true);
    expect(isFailedQueueStatus('RETURNED')).toBe(true);
    expect(isFailedQueueStatus('DELIVERED')).toBe(false);
    expect(isFailedQueueStatus('CANCELED')).toBe(false);
  });
});
