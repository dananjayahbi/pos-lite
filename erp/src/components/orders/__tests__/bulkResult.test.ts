import { describe, expect, it } from 'vitest';

import {
  bulkResultToast,
  retainFailedSelection,
  summarizeBulkResults,
} from '@/components/orders/bulkResult';

const ok = (id: string) => ({ id, ok: true });
const failed = (id: string, message: string) => ({ id, ok: false, message });

/**
 * ARGUS #265 - "Invalid status transition", "Already ready for delivery" and
 * "Dispatch the delivery first" must reach the operator, not just the OK count.
 */
describe('summarizeBulkResults', () => {
  it('reports an all-success batch', () => {
    const summary = summarizeBulkResults([ok('a'), ok('b')]);
    expect(summary.okCount).toBe(2);
    expect(summary.failedCount).toBe(0);
    expect(summary.allSucceeded).toBe(true);
    expect(summary.allFailed).toBe(false);
    expect(summary.partial).toBe(false);
  });

  it('reports an all-failure batch with reasons', () => {
    const summary = summarizeBulkResults([
      failed('a', 'Invalid status transition'),
      failed('b', 'Already ready for delivery'),
    ]);
    expect(summary.okCount).toBe(0);
    expect(summary.allFailed).toBe(true);
    expect(summary.partial).toBe(false);
    expect(summary.failures.map((failure) => failure.message)).toEqual([
      'Invalid status transition',
      'Already ready for delivery',
    ]);
  });

  it('reports a partial batch', () => {
    const summary = summarizeBulkResults([
      ok('a'),
      failed('b', 'Dispatch the delivery first'),
    ]);
    expect(summary.okCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.partial).toBe(true);
    expect(summary.allFailed).toBe(false);
  });

  it('treats a missing message as an unknown error', () => {
    const summary = summarizeBulkResults([{ id: 'a', ok: false }]);
    expect(summary.failures[0]?.message).toBe('Unknown error');
  });

  it('treats an empty result list as a failure, not a success', () => {
    const summary = summarizeBulkResults([]);
    expect(summary.total).toBe(0);
    expect(summary.allSucceeded).toBe(false);
    expect(summary.allFailed).toBe(true);
  });
});

describe('bulkResultToast', () => {
  it('uses a success toast only when every row succeeded', () => {
    expect(bulkResultToast([ok('a'), ok('b')], 'Updated')).toEqual({
      level: 'success',
      message: 'Updated 2 order(s)',
    });
  });

  it('does not claim success when every row failed', () => {
    const toast = bulkResultToast(
      [failed('a', 'Invalid status transition'), failed('b', 'Invalid status transition')],
      'Updated',
    );
    expect(toast.level).toBe('error');
    expect(toast.message).toBe(
      'No orders were updated - 2 failed: Invalid status transition',
    );
  });

  it('reports successes and failures for a partial batch', () => {
    const toast = bulkResultToast(
      [ok('a'), failed('b', 'Dispatch the delivery first')],
      'Prepared for delivery',
    );
    expect(toast.level).toBe('warning');
    expect(toast.message).toBe(
      'Prepared for delivery 1 of 2 order(s); 1 failed: Dispatch the delivery first',
    );
  });

  it('de-duplicates shared failure reasons', () => {
    const toast = bulkResultToast(
      [
        failed('a', 'Cannot prepare order in DELIVERED'),
        failed('b', 'Cannot prepare order in DELIVERED'),
        failed('c', 'Cannot prepare order in RETURNED'),
      ],
      'Prepared for delivery',
    );
    expect(toast.message).toContain('3 failed');
    expect(toast.message).toContain(
      'Cannot prepare order in DELIVERED; Cannot prepare order in RETURNED',
    );
  });

  it('reports an empty server result as an error', () => {
    expect(bulkResultToast([], 'Prepared for delivery').level).toBe('error');
  });
});

describe('retainFailedSelection', () => {
  it('drops successful ids and keeps failures selected', () => {
    expect(
      Array.from(retainFailedSelection(new Set(['a', 'b', 'c']), [ok('a'), failed('b', 'x')])),
    ).toEqual(['b', 'c']);
  });

  it('keeps the whole selection when everything failed', () => {
    const selected = new Set(['a', 'b']);
    expect(Array.from(retainFailedSelection(selected, [failed('a', 'x'), failed('b', 'y')]))).toEqual(
      ['a', 'b'],
    );
  });
});
