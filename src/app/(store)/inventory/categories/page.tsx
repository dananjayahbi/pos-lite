import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CategoriesPageClient } from '@/components/categories/CategoriesPageClient';

export const metadata = { title: 'Categories | VelvetPOS' };

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const perms = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  if (!perms.includes('product:create')) redirect('/inventory');

  return <CategoriesPageClient permissions={perms} />;
}
