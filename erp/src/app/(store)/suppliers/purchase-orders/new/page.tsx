import { CreatePurchaseOrderClient } from '@/components/purchase-order/CreatePurchaseOrderClient';

/**
 * The create form is a client component of its own so this route stays a
 * one-line shell and every field lives in `src/components/purchase-order/`.
 */
export default function NewPurchaseOrderPage() {
  return <CreatePurchaseOrderClient />;
}
