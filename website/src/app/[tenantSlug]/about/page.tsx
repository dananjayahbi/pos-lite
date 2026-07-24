import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { tenantHomePath } from '@/lib/tenant';
import { SITE } from '@/config/site';
import { StaticPageShell } from '@/components/website/static-pages/StaticPageShell';

interface AboutPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { tenantSlug } = await params;

  const [tenant, configResponse] = await Promise.all([
    getTenantInfo(tenantSlug),
    getPublicWebsiteConfig(tenantSlug),
  ]);

  if (!tenant) notFound();

  const config = configResponse?.config;
  const siteName = config?.siteName || tenant.name;
  const aboutText = config?.footerAbout;
  const socialLinks = config?.socialLinks ?? {};
  const socialEntries = Object.entries(socialLinks).filter(
    ([, value]) => value && typeof value === 'string' && value.length > 0,
  );

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={`About ${siteName}`}
      description="Learn more about our story and what drives us."
    >
      <div className="prose prose-gray max-w-none mx-auto">
        {aboutText ? (
          <p className="text-base leading-relaxed text-gray-700">
            {aboutText}
          </p>
        ) : (
          <p className="text-base leading-relaxed text-gray-700">
            {siteName} offers premium products crafted with care and
            dedication. We are committed to delivering the highest quality to
            our customers.
          </p>
        )}

        {/* Mission */}
        <div className="mt-10">
          <h2
            className="text-xl font-medium mb-3"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            Our Mission
          </h2>
          <p className="text-base leading-relaxed text-gray-700">
            Our mission is to provide exceptional products that enhance your
            daily life. Every item in our collection is thoughtfully selected
            to meet our rigorous standards for quality and value.
          </p>
        </div>

        {/* Values */}
        <div className="mt-10">
          <h2
            className="text-xl font-medium mb-3"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            What We Stand For
          </h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
              <span>
                <strong>Quality First</strong> — Every product meets our
                uncompromising standards.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
              <span>
                <strong>Customer Commitment</strong> — Your satisfaction is at
                the heart of everything we do.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
              <span>
                <strong>Authenticity</strong> — We stay true to our values and
                our promises.
              </span>
            </li>
          </ul>
        </div>

        {/* Social links */}
        {socialEntries.length > 0 && (
          <div className="mt-10">
            <h2
              className="text-xl font-medium mb-3"
              style={{ fontFamily: 'var(--font-dm-serif), serif' }}
            >
              Connect With Us
            </h2>
            <div className="flex flex-wrap gap-3">
              {socialEntries.map(([key, value]) => (
                <a
                  key={key}
                  href={value as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-black transition-colors capitalize"
                >
                  {key}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </StaticPageShell>
  );
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const siteName = configResponse?.config?.siteName || tenant.name;
    const title = `About — ${siteName}`;
    const description =
      configResponse?.config?.metaDescription ||
      `Learn more about ${siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'en_LK',
        siteName,
        url: `${SITE.siteUrl}/${tenantSlug}/about`,
      },
      alternates: { canonical: `/${tenantSlug}/about` },
    };
  } catch {
    return { title: 'About' };
  }
}

export const revalidate = 60;
