import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
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

  return (
    <div className="w-full">
      <WebsiteSettingsForm />
    </div>
  );
}
