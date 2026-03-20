import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BrandsPageClient } from '@/components/brands/BrandsPageClient';

export const metadata = { title: 'Brands | VelvetPOS' };

export default async function BrandsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const perms = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  if (!perms.includes('product:create')) redirect('/inventory');

  return <BrandsPageClient permissions={perms} />;
}
