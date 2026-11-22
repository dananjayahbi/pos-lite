import { describe, expect, it } from 'vitest';

import { planPromotionStatusChange } from '@/lib/services/promotionStatus.core';

/**
 * ARGUS #325 — deactivate is idempotent; activate is explicit.
 */
describe('planPromotionStatusChange', () => {
  it('keeps an already-inactive promotion off without a spurious audit', () => {
    expect(planPromotionStatusChange(false, false)).toEqual({
      isActive: false,
      changed: false,
      auditAction: null,
    });
  });

  it('archives on active -> inactive', () => {
    expect(planPromotionStatusChange(true, false)).toEqual({
      isActive: false,
      changed: true,
      auditAction: 'PROMOTION_ARCHIVED',
    });
  });

  it('activates on inactive -> active', () => {
    expect(planPromotionStatusChange(false, true)).toEqual({
      isActive: true,
      changed: true,
      auditAction: 'PROMOTION_ACTIVATED',
    });
  });

  it('supports the full active -> inactive -> active round trip', () => {
    const off = planPromotionStatusChange(true, false);
    const on = planPromotionStatusChange(off.isActive, true);

    expect(off.auditAction).toBe('PROMOTION_ARCHIVED');
    expect(on.isActive).toBe(true);
    expect(on.auditAction).toBe('PROMOTION_ACTIVATED');
    expect(on.auditAction).not.toBe(off.auditAction);
  });
});
