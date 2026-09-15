import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import WebhooksPageClient from '@/components/settings/WebhooksPageClient';

export const metadata = { title: 'Webhooks | AyurPOS' };

const DENIED_ROLES = new Set(['CASHIER', 'STOCK_CLERK']);

export default async function WebhooksPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (DENIED_ROLES.has(session.user.role)) redirect('/pos');

  return <WebhooksPageClient />;
}
