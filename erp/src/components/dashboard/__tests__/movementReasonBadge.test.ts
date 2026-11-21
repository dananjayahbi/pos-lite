import { describe, expect, it } from 'vitest';

import { STOCK_MOVEMENT_REASONS } from '@/lib/constants/stock-movement';
import { movementReasonBadge } from '@/components/dashboard/movementReasonBadge';

/** ARGUS #45 - Recent Stock Movements must never show a raw enum token. */
describe('movementReasonBadge', () => {
  it('labels SALE and VOID_REVERSAL with normal words', () => {
    expect(movementReasonBadge('SALE').label).toBe('Sale');
    expect(movementReasonBadge('VOID_REVERSAL').label).toBe('Void reversal');
  });

  it('labels every stock movement reason', () => {
    for (const reason of STOCK_MOVEMENT_REASONS) {
      const badge = movementReasonBadge(reason);
      expect(badge.label, reason).not.toBe(reason);
      expect(badge.label, reason).not.toMatch(/^[A-Z_]+$/);
      expect(badge.className, reason).toMatch(/^bg-/);
    }
  });

  it('falls back safely for a missing or unknown reason', () => {
    expect(movementReasonBadge(null).label).toBe('-');
    expect(movementReasonBadge('FUTURE_REASON').label).toBe('FUTURE_REASON');
  });
});
