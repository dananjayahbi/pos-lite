import { PERMISSIONS } from '@/lib/constants/permissions';

/**
 * ARGUS #332 — one permission decision shared by the promotions server page
 * and its client controls.
 *
 * The list API requires `promotion:create` OR `promotion:edit`; the create
 * route requires create, edit/status requires edit, DELETE requires delete,
 * and the customer-pricing list requires edit. Deriving all of them here keeps
 * the page from offering a control that would immediately 403.
 */
export interface PromotionPageAccess {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Customer pricing GET/list requires promotion:edit. */
  canManageCustomerPricing: boolean;
}

export function resolvePromotionPageAccess(
  permissions: readonly string[],
): PromotionPageAccess {
  const set = new Set(permissions);
  const canCreate = set.has(PERMISSIONS.PROMOTION.createPromotion);
  const canEdit = set.has(PERMISSIONS.PROMOTION.editPromotion);
  const canDelete = set.has(PERMISSIONS.PROMOTION.deletePromotion);

  return {
    canView: canCreate || canEdit,
    canCreate,
    canEdit,
    canDelete,
    canManageCustomerPricing: canEdit,
  };
}
