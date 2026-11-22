import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { CreatePurchaseOrderClient } from '@/components/purchase-order/CreatePurchaseOrderClient';

/**
 * The create form is a client component of its own so this route stays a
 * one-line shell and every field lives in `src/components/purchase-order/`.
 *
 * Sending is an approval action, so the server passes the caller's permission
 * and the form hides "Create Purchase Order" for create-only roles
 * (ARGUS #224).
 */
export default async function NewPurchaseOrderPage() {
  const session = await auth();
  const canApprove =
    !!session?.user && hasPermission(session.user, PERMISSIONS.SUPPLIER.approvePurchaseOrder);

  return <CreatePurchaseOrderClient canApprove={canApprove} />;
}
