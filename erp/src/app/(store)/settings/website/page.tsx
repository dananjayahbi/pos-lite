import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import WebsiteSettingsForm from '@/components/settings/WebsiteSettingsForm';

export const metadata = {
  title: 'Website Configuration | AyurPOS',
};

export default async function WebsiteSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  return (
    <div className="w-full">
      <WebsiteSettingsForm />
    </div>
  );
}
