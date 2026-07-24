import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';
import { StaticPageShell } from '@/components/website/static-pages/StaticPageShell';
import { ContactForm } from '@/components/website/static-pages/ContactForm';
import { ContactInfoCards } from '@/components/website/static-pages/ContactInfoCards';
import { MapEmbed } from '@/components/website/static-pages/MapEmbed';

interface ContactPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { tenantSlug } = await params;

  const [tenant, configResponse] = await Promise.all([
    getTenantInfo(tenantSlug),
    getPublicWebsiteConfig(tenantSlug),
  ]);

  if (!tenant) notFound();

  const config = configResponse?.config;
  const siteName = config?.siteName || tenant.name;
  const contactTitle = config?.contactPageTitle || 'Contact Us';
  const contactSubtitle =
    config?.contactPageSubtitle || "We'd love to hear from you. Get in touch with us.";
  const contactHeroImageUrl = config?.contactHeroImageUrl;

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={contactTitle}
      subtitle={contactSubtitle}
    >
      <div className="space-y-0">
        {/* Hero image if configured */}
        {contactHeroImageUrl && (
          <div className="mb-12 -mt-4 rounded-xl overflow-hidden shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={contactHeroImageUrl}
              alt={contactTitle}
              className="w-full h-auto max-h-[300px] object-cover"
            />
          </div>
        )}

        {/* Contact info cards */}
        <ContactInfoCards
          title={config?.contactInfoTitle ?? ''}
          address={config?.contactAddress ?? ''}
          phone={config?.contactPhoneDisplay ?? ''}
          email={config?.contactEmailDisplay ?? ''}
          businessHours={config?.contactBusinessHours ?? ''}
        />

        {/* Default contact info fallback when none configured */}
        {!config?.contactAddress &&
          !config?.contactPhoneDisplay &&
          !config?.contactEmailDisplay &&
          !config?.contactBusinessHours && (
            <ContactInfoCards
              title="Get In Touch"
              address=""
              phone={config?.socialLinks?.phone ?? ''}
              email={config?.socialLinks?.email ?? ''}
              businessHours={
                config?.socialLinks?.whatsapp
                  ? `WhatsApp: ${config.socialLinks.whatsapp}`
                  : ''
              }
            />
          )}

        {/* Map */}
        <MapEmbed
          embedUrl={config?.contactMapEmbedUrl ?? ''}
          address={config?.contactAddress ?? ''}
        />

        {/* Contact form section */}
        <section className="py-8">
          <div className="bg-[var(--site-light-gray,#f5f5f5)] rounded-xl p-6 md:p-10">
            <h2
              className="text-xl md:text-2xl font-medium mb-2 text-center text-[var(--site-primary,#0a0a0a)]"
              style={{ fontFamily: 'var(--font-dm-serif), serif' }}
            >
              Send a Message
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Fill out the form below and we&apos;ll get back to you as soon as possible.
            </p>
            <div className="max-w-lg mx-auto">
              <ContactForm />
            </div>
          </div>
        </section>
      </div>
    </StaticPageShell>
  );
}

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const siteName = configResponse?.config?.siteName || tenant.name;
    const title =
      configResponse?.config?.contactPageTitle ||
      `Contact — ${siteName}`;
    const description = `Get in touch with ${siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'en_LK',
        siteName,
        url: `${SITE.siteUrl}/${tenantSlug}/contact`,
      },
      alternates: { canonical: `/${tenantSlug}/contact` },
    };
  } catch {
    return { title: 'Contact' };
  }
}

export const revalidate = 60;
