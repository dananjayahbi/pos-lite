import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';

type CommissionPayoutUser = Parameters<typeof hasPermission>[0];

export const COMMISSION_PAYOUT_REQUIRES_OWNER =
  'Commission payouts require owner approval. Ask the owner to record this payout.';

/**
 * ARGUS #367: the payout endpoint used only `staff:manage`, so any manager
 * could move money out of a payment account. Paying commissions now needs the
 * owner-only `payroll:commission:payout` permission. Managers keep the read
 * surfaces but cannot create payouts unless the owner explicitly grants it.
 */
export function canPayCommissionPayouts(
  user: CommissionPayoutUser | null | undefined,
): boolean {
  return hasPermission(user, PERMISSIONS.PAYROLL.payCommission);
}
