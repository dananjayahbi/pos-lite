import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { ContactForm } from '../static-pages/ContactForm';
import { ContactInfoCards } from '../static-pages/ContactInfoCards';
import { MapEmbed } from '../static-pages/MapEmbed';

interface ContactPageContentProps {
  tenantSlug: string;
}

export async function ContactPageContent({ tenantSlug }: ContactPageContentProps) {
  let tenant = null;
  let configResponse = null;

  try {
    [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[contact] tenant/config fetch failed', err);
  }

  if (!tenant) notFound();

  const config = configResponse?.config;
  const contactTitle = config?.contactPageTitle || 'Contact Us';
  const contactSubtitle =
    config?.contactPageSubtitle || "We'd love to hear from you. Get in touch with us.";
  const contactHeroImageUrl = config?.contactHeroImageUrl;

  const heroProps = contactHeroImageUrl ? { heroImageUrl: contactHeroImageUrl } : {};

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={contactTitle}
      subtitle={contactSubtitle}
      {...heroProps}
    >
      <div className="space-y-0">
        <ContactInfoCards
          title={config?.contactInfoTitle ?? ''}
          address={config?.contactAddress ?? ''}
          phone={config?.contactPhoneDisplay ?? ''}
          email={config?.contactEmailDisplay ?? ''}
          businessHours={config?.contactBusinessHours ?? ''}
        />

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

        <MapEmbed
          embedUrl={config?.contactMapEmbedUrl ?? ''}
          address={config?.contactAddress ?? ''}
        />

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
