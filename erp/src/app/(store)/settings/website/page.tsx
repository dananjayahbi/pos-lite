import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import WebsiteSettingsForm from '@/components/settings/WebsiteSettingsForm';

export const metadata = {
  title: 'Website Configuration | AyurPOS',
};

export default async function WebsiteSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  return (
    <div className="w-full">
      <WebsiteSettingsForm />
    </div>
  );
}
