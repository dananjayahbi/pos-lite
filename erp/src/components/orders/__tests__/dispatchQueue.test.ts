import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DISPATCH_STATUS_SELECTION,
  dispatchQueueLabel,
  resolveDispatchStatuses,
} from '@/components/orders/dispatchQueue';

describe('resolveDispatchStatuses (ARGUS #269)', () => {
  it('defaults to the pre-dispatch queue', () => {
    expect(DEFAULT_DISPATCH_STATUS_SELECTION).toBe('queue');
    expect(resolveDispatchStatuses('queue')).toEqual(['PLACED', 'PENDING_DISPATCH']);
  });

  it('supports a single status and all statuses', () => {
    expect(resolveDispatchStatuses('DELIVERED')).toEqual(['DELIVERED']);
    expect(resolveDispatchStatuses(null)).toBeNull();
  });
});

describe('dispatchQueueLabel', () => {
  it('shows the queue count', () => {
    expect(dispatchQueueLabel(12)).toBe('Dispatch queue (12)');
    expect(dispatchQueueLabel(0)).toBe('Dispatch queue (0)');
    expect(dispatchQueueLabel(undefined)).toBe('Dispatch queue (0)');
  });
});
