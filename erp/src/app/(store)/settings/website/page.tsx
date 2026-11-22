import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import WebsiteSettingsForm from '@/components/settings/WebsiteSettingsForm';

export const metadata = {
  title: 'Website Configuration | AyurPOS',
};

export default async function WebsiteSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  // M29-03 (OBS-41): mirrors /settings/users — the website CMS is owner/manager
  // work, so a CASHIER is bounced to the dashboard (403 on the API too).
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageWebsite)) redirect('/dashboard');

  // ARGUS #500: storefront preview links are scoped by tenant slug. Resolve it
  // server-side so the client never has to guess the public URL.
  const tenant = await prisma.tenant
    .findUnique({
      where: { id: session.user.tenantId },
      select: { slug: true },
    })
    .catch(() => null);

  return (
    <div className="w-full">
      <WebsiteSettingsForm tenantSlug={tenant?.slug ?? ''} />
    </div>
  );
}
