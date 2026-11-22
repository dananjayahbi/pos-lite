/**
 * ARGUS #325 — promotion activation state transitions.
 *
 * Deactivate must always mean `isActive = false` (idempotent), never a blind
 * toggle; Activate is the explicit opposite. Only a real transition writes an
 * audit row, and the action differs by direction.
 */
export type PromotionStatusAuditAction =
  | 'PROMOTION_ACTIVATED'
  | 'PROMOTION_ARCHIVED';

export interface PromotionStatusPlan {
  isActive: boolean;
  changed: boolean;
  auditAction: PromotionStatusAuditAction | null;
}

export function planPromotionStatusChange(
  current: boolean,
  next: boolean,
): PromotionStatusPlan {
  if (current === next) {
    return { isActive: next, changed: false, auditAction: null };
  }
  return {
    isActive: next,
    changed: true,
    auditAction: next ? 'PROMOTION_ACTIVATED' : 'PROMOTION_ARCHIVED',
  };
}
