import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { CategoriesPageClient } from '@/components/categories/CategoriesPageClient';

export const metadata = { title: 'Categories | AyurPOS' };

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const perms = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  if (!perms.includes('product:create')) redirect('/inventory');

  return <CategoriesPageClient permissions={perms} />;
}
