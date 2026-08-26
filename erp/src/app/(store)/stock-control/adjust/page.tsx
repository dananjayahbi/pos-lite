import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StockAdjustmentForm } from '@/components/stock-control/StockAdjustmentForm';

export const metadata = {
  title: 'Stock Adjustment | AyurPOS',
};

interface StockAdjustmentPageProps {
  searchParams: Promise<{ variantId?: string }>;
}

export default async function StockAdjustmentPage({ searchParams }: StockAdjustmentPageProps) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const { variantId } = await searchParams;

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions
        .filter((p): p is string => typeof p === 'string')
    : [];

  return (
    <StockAdjustmentForm
      permissions={userPermissions}
      prefillVariantId={variantId ?? null}
    />
  );
}
