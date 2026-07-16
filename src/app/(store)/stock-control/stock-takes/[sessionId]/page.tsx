import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StockTakeSession } from '@/components/stock-control/StockTakeSession';

export const metadata = {
  title: 'Stock Take Session | VelvetPOS',
};

export default async function StockTakeSessionPage(props: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  const { sessionId } = await props.params;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <StockTakeSession sessionId={sessionId} permissions={userPermissions} />
    </div>
  );
}
