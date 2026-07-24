import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getWebsiteConfig } from '@/lib/services/website.service';
import { WebsiteSettingsForm } from '@/components/settings/WebsiteSettingsForm';
import type { WebsiteConfigData } from '@/types/website.types';

export const metadata = {
  title: 'Website Configuration | AyurPOS',
};

export default async function WebsiteSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const rawConfig = await getWebsiteConfig(session.user.tenantId);
  const config: WebsiteConfigData | null = rawConfig
    ? (JSON.parse(JSON.stringify(rawConfig)) as WebsiteConfigData)
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">
          Website Configuration
        </h1>
        <p className="mt-1 text-sm text-sand">
          Customize your customer-facing website. Changes are reflected immediately.
        </p>
      </div>

      <WebsiteSettingsForm
        tenantId={session.user.tenantId}
        initialConfig={config}
      />
    </div>
  );
}
