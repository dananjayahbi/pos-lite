import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { InventoryListClient } from '@/components/inventory/InventoryListClient';

export const metadata = {
  title: 'Inventory | VelvetPOS',
};

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const totalProducts = await prisma.product.count({
    where: { tenantId: session.user.tenantId, deletedAt: null },
  });

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return (
    <InventoryListClient
      initialCount={totalProducts}
      permissions={userPermissions}
    />
  );
}
