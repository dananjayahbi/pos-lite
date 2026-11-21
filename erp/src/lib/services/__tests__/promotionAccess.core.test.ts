import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { resolvePromotionPageAccess } from '@/lib/services/promotionAccess.core';

/** ARGUS #332: the page must mirror the API's permission requirements. */
describe('resolvePromotionPageAccess', () => {
  it('denies view when the user holds no promotion permission', () => {
    expect(resolvePromotionPageAccess([])).toEqual({
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManageCustomerPricing: false,
    });
  });

  it('allows view with create only, matching the list API OR-gate', () => {
    const access = resolvePromotionPageAccess([PERMISSIONS.PROMOTION.createPromotion]);
    expect(access.canView).toBe(true);
    expect(access.canCreate).toBe(true);
    expect(access.canEdit).toBe(false);
    expect(access.canManageCustomerPricing).toBe(false);
  });

  it('allows edit and customer-pricing management with edit only', () => {
    const access = resolvePromotionPageAccess([PERMISSIONS.PROMOTION.editPromotion]);
    expect(access.canView).toBe(true);
    expect(access.canCreate).toBe(false);
    expect(access.canEdit).toBe(true);
    expect(access.canManageCustomerPricing).toBe(true);
  });

  it('keeps delete separate from edit (owner-only deactivation)', () => {
    const manager = resolvePromotionPageAccess([
      PERMISSIONS.PROMOTION.createPromotion,
      PERMISSIONS.PROMOTION.editPromotion,
    ]);
    expect(manager.canDelete).toBe(false);

    const owner = resolvePromotionPageAccess([
      PERMISSIONS.PROMOTION.createPromotion,
      PERMISSIONS.PROMOTION.editPromotion,
      PERMISSIONS.PROMOTION.deletePromotion,
    ]);
    expect(owner.canDelete).toBe(true);
  });

  it('does not grant view from delete alone (the API list still 403s)', () => {
    const access = resolvePromotionPageAccess([PERMISSIONS.PROMOTION.deletePromotion]);
    expect(access.canView).toBe(false);
  });
});
