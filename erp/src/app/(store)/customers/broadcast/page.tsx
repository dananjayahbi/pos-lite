import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BroadcastPageClient } from './BroadcastPageClient';

export default async function BroadcastPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role;
  if (role === 'CASHIER' || role === 'STOCK_CLERK') {
    redirect('/dashboard');
  }

  return <BroadcastPageClient />;
}
