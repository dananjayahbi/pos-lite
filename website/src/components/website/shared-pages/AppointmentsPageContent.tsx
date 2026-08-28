import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig, getPublicAppointmentServices } from '@/lib/api/website';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { AppointmentBookingForm } from './AppointmentFormClient';

interface AppointmentsPageContentProps {
  tenantSlug: string;
}

/**
 * Customer-facing Appointments (channelling) booking page.
 *
 * Fetches the tenant, website config, and public appointment services, then
 * renders the booking form inside the shared static page shell. When the
 * owner has not enabled appointments, we render a friendly "not available"
 * state rather than a 404 so the route stays stable.
 */
export async function AppointmentsPageContent({ tenantSlug }: AppointmentsPageContentProps) {
  let tenant = null;
  let configResponse = null;
  let services: Awaited<ReturnType<typeof getPublicAppointmentServices>> = [];

  try {
    [tenant, configResponse, services] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
      getPublicAppointmentServices(tenantSlug),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[appointments] tenant/config/services fetch failed', err);
  }

  if (!tenant) notFound();

  const config = configResponse?.config;
  const appointmentsConfig = config?.appointments;

  const enabled = appointmentsConfig?.enabled ?? false;
  const title = appointmentsConfig?.title || 'Book a Channeling';
  const subtitle = appointmentsConfig?.subtitle || 'Reserve your appointment with our Ayurvedic doctor.';
  const intro = appointmentsConfig?.intro ?? null;
  const heroImageUrl = appointmentsConfig?.heroImageUrl;

  const heroProps = heroImageUrl ? { heroImageUrl } : {};

  // If the owner hasn't enabled bookings, show a gentle notice (not a 404).
  if (!enabled) {
    return (
      <StaticPageShell
        tenantName={tenant.name}
        tenantSlug={tenantSlug}
        config={config}
        title={title}
        subtitle={subtitle}
        {...heroProps}
      >
        <p className="text-center text-gray-500 text-sm py-12">
          Online appointment booking is not available right now. Please call us to
          schedule a channelling.
        </p>
      </StaticPageShell>
    );
  }

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={title}
      subtitle={subtitle}
      {...heroProps}
    >
      <AppointmentBookingForm
        tenantSlug={tenantSlug}
        services={services}
        intro={intro}
      />
    </StaticPageShell>
  );
}
