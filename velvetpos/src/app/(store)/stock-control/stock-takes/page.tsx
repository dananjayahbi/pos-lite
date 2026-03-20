import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StockTakeList } from '@/components/stock-control/StockTakeList';

export const metadata = {
  title: 'Stock Takes | VelvetPOS',
};

export default async function StockTakesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <StockTakeList permissions={userPermissions} />
    </div>
  );
}
