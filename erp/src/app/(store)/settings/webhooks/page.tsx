import { auth } from '@/lib/auth';
import { denialRouteFor, requirePagePermission } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { PERMISSIONS } from '@/lib/constants/permissions';
import WebhooksPageClient from '@/components/settings/WebhooksPageClient';

export const metadata = { title: 'Webhooks | AyurPOS' };

export default async function WebhooksPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  // XC-03: the previous `DENIED_ROLES = new Set(['CASHIER','STOCK_CLERK'])` was
  // a denylist — DISPATCH_STAFF and FACTORY_MANAGER were NOT listed and so
  // reached a webhook-management surface. The shared page guard expresses the
  // allowlist as one permission key, matching the API guard on the same surface.
  requirePagePermission(session.user, PERMISSIONS.SETTINGS.viewWebhookEndpoints);

  return <WebhooksPageClient />;
}
