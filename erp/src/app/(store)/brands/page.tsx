import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { BrandsPageClient } from '@/components/brands/BrandsPageClient';

export const metadata = { title: 'Brands | AyurPOS' };

export default async function BrandsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const perms = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  if (!perms.includes('product:create')) redirect('/inventory');

  return <BrandsPageClient permissions={perms} />;
}
