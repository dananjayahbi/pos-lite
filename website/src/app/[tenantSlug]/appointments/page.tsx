import type { Metadata } from 'next';
import { AppointmentsPageContent } from '@/components/website/shared-pages/AppointmentsPageContent';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';

interface AppointmentsPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { tenantSlug } = await params;
  return <AppointmentsPageContent tenantSlug={tenantSlug} />;
}

export async function generateMetadata({
  params,
}: AppointmentsPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const siteName = configResponse?.config?.siteName || tenant.name;
    const appointmentsConfig = configResponse?.config?.appointments;
    const title =
      appointmentsConfig?.title ||
      'Book a Channeling';
    const description =
      appointmentsConfig?.subtitle ||
      `Reserve an appointment with ${siteName}.`;

    return {
      title: `${title} — ${siteName}`,
      description,
      openGraph: {
        title: `${title} — ${siteName}`,
        description,
      },
    };
  } catch {
    return { title: 'Appointments' };
  }
}

export const dynamic = 'force-dynamic';
