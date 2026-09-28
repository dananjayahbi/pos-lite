import { notFound } from 'next/navigation';
import {
  getTenantInfo,
  getPublicWebsiteConfig,
  getPublicAppointmentServices,
  getPublicAppointmentDoctors,
} from '@/lib/api/website';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { BookingTerminal } from '../appointments/BookingTerminal';

interface AppointmentsPageContentProps {
  tenantSlug: string;
}

/**
 * Customer-facing Appointments (channelling) booking page.
 *
 * Fetches the tenant, website config, public appointment services and the
 * bookable physicians, then renders the glassmorphic booking terminal inside
 * the shared static page shell. When the owner has not enabled appointments,
 * we render a friendly "not available" state rather than a 404 so the route
 * stays stable.
 */
export async function AppointmentsPageContent({ tenantSlug }: AppointmentsPageContentProps) {
  let tenant = null;
  let configResponse = null;
  let services: Awaited<ReturnType<typeof getPublicAppointmentServices>> = [];
  let doctors: Awaited<ReturnType<typeof getPublicAppointmentDoctors>> = [];

  try {
    [tenant, configResponse, services, doctors] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
      getPublicAppointmentServices(tenantSlug),
      getPublicAppointmentDoctors(tenantSlug),
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
  const intro = appointmentsConfig?.intro ?? 'Select your preferred doctor, treatment service, and consultation time slot below.';
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
      <section id="appointments-booking-section" className="relative w-full py-16 sm:py-24 lg:py-32 overflow-hidden">
        <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="booking-form-box">
            <BookingTerminal
              tenantSlug={tenantSlug}
              services={services}
              doctors={doctors}
              intro={intro}
            />
          </div>
        </div>
      </section>
    </StaticPageShell>
  );
}
