import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { tenantHomePath } from '@/lib/tenant';
import { SITE } from '@/config/site';
import { StaticPageShell } from '@/components/website/static-pages/StaticPageShell';
import { ContactForm } from '@/components/website/static-pages/ContactForm';

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
  const socialLinks = config?.socialLinks ?? {};
  const socialEntries = Object.entries(socialLinks).filter(
    ([, value]) => value && typeof value === 'string' && value.length > 0,
  );

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title="Contact Us"
      description="We'd love to hear from you. Get in touch with us."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact info */}
        <div>
          <h2
            className="text-xl font-medium mb-4"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            Get In Touch
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            Have a question, feedback, or need assistance? Reach out to us
            through any of the channels below and we&apos;ll get back to you
            as soon as possible.
          </p>

          {/* Contact details from social links */}
          <div className="space-y-4">
            {socialLinks.email && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <a
                    href={`mailto:${socialLinks.email}`}
                    className="text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    {socialLinks.email}
                  </a>
                </div>
              </div>
            )}
            {socialLinks.phone && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Phone</p>
                  <a
                    href={`tel:${socialLinks.phone}`}
                    className="text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    {socialLinks.phone}
                  </a>
                </div>
              </div>
            )}
            {socialLinks.whatsapp && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                  <a
                    href={`https://wa.me/${socialLinks.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            )}
            {socialEntries
              .filter(
                ([key]) =>
                  !['email', 'phone', 'whatsapp'].includes(key),
              )
              .map(([key, value]) => (
                <div key={key} className="flex items-start gap-3">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {key}
                    </p>
                    <a
                      href={value as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-black transition-colors"
                    >
                      Visit our {key}
                    </a>
                  </div>
                </div>
              ))}
          </div>

          {/* No contact info fallback */}
          {socialEntries.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              Contact information is not yet available. Please check back
              later.
            </p>
          )}
        </div>

        {/* Contact form */}
        <div>
          <h2
            className="text-xl font-medium mb-4"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            Send a Message
          </h2>
          <ContactForm />
        </div>
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
    const title = `Contact — ${siteName}`;
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
