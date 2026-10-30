import { PurchaseOrderDetailClient } from '@/components/purchase-order/PurchaseOrderDetailClient';

/**
 * The detail view is a client component of its own so this route stays a thin
 * shell and every piece lives in `src/components/purchase-order/`.
 */
export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = await params;
  return <PurchaseOrderDetailClient poId={poId} />;
}
