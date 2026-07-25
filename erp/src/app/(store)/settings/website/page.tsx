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
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-8 lg:p-10">
      <div>
        <h1 className="text-2xl font-bold text-espresso">
          Website Configuration
        </h1>
        <p className="mt-1 text-sm text-sand">
          Customize your customer-facing website. Changes are reflected immediately after saving.
        </p>
      </div>

      <WebsiteSettingsForm />
    </div>
  );
}
