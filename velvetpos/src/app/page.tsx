import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultRouteForRole } from '@/lib/utils/default-route';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  redirect(getDefaultRouteForRole(session.user.role));
}
