import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { PurchaseOrdersListClient } from '@/components/purchase-order/PurchaseOrdersListClient';

/** Thin shell: the list is a client component in `src/components/purchase-order/`. */
export default async function PurchaseOrdersPage() {
  const session = await auth();
  const canApprove =
    !!session?.user && hasPermission(session.user, PERMISSIONS.SUPPLIER.approvePurchaseOrder);

  return <PurchaseOrdersListClient canApprove={canApprove} />;
}
