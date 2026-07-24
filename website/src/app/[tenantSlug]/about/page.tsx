import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';
import { StaticPageShell } from '@/components/website/static-pages/StaticPageShell';
import { AboutStorySection } from '@/components/website/static-pages/AboutStorySection';
import { AboutMissionSection } from '@/components/website/static-pages/AboutMissionSection';
import { AboutValuesSection } from '@/components/website/static-pages/AboutValuesSection';

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

  const aboutTitle = config?.aboutPageTitle || `About ${siteName}`;
  const aboutSubtitle = config?.aboutPageSubtitle || 'Learn more about our story and what drives us.';
  const aboutHeroImageUrl = config?.aboutHeroImageUrl;

  // Social links for connect section
  const socialLinks = config?.socialLinks ?? {};
  const socialEntries = Object.entries(socialLinks).filter(
    ([, value]) => value && typeof value === 'string' && value.length > 0,
  );

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={aboutTitle}
      subtitle={aboutSubtitle}
    >
      <div className="space-y-0">
        {/* Hero image if configured */}
        {aboutHeroImageUrl && (
          <div className="mb-12 -mt-4 rounded-xl overflow-hidden shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aboutHeroImageUrl}
              alt={aboutTitle}
              className="w-full h-auto max-h-[400px] object-cover"
            />
          </div>
        )}

        {/* Story section */}
        <AboutStorySection
          title={config?.aboutStoryTitle ?? ''}
          content={config?.aboutStoryContent ?? ''}
          imageUrl={config?.aboutStoryImageUrl ?? ''}
          imagePosition="right"
        />

        {/* Divider */}
        <div className="my-4 flex justify-center">
          <div className="w-16 h-px bg-[var(--site-accent,#b4946e)]" />
        </div>

        {/* Mission section */}
        <AboutMissionSection
          title={config?.aboutMissionTitle ?? ''}
          content={config?.aboutMissionContent ?? ''}
        />

        {/* Values section */}
        <AboutValuesSection
          title={config?.aboutValuesSectionTitle ?? ''}
          values={config?.aboutValues ?? []}
        />

        {/* Default values as fallback */}
        {(!config?.aboutValues || config.aboutValues.length === 0) && !config?.aboutMissionContent && !config?.aboutStoryContent && (
          <AboutValuesSection
            title="What We Stand For"
            values={[
              {
                title: 'Quality First',
                description:
                  'Every product meets our uncompromising standards for purity and excellence.',
              },
              {
                title: 'Customer Commitment',
                description:
                  'Your satisfaction is at the heart of everything we do.',
              },
              {
                title: 'Authenticity',
                description:
                  'We stay true to our values, our heritage, and our promises.',
              },
            ]}
          />
        )}

        {/* Connect section */}
        {socialEntries.length > 0 && (
          <section className="py-12">
            <h2
              className="text-2xl font-medium mb-6 text-center text-[var(--site-primary,#0a0a0a)]"
              style={{ fontFamily: 'var(--font-dm-serif), serif' }}
            >
              Connect With Us
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {socialEntries.map(([key, value]) => (
                <a
                  key={key}
                  href={value as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:border-[var(--site-accent,#b4946e)] hover:text-[var(--site-primary,#0a0a0a)] transition-all duration-300 capitalize bg-white hover:shadow-sm"
                >
                  {key}
                </a>
              ))}
            </div>
          </section>
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
    const title =
      configResponse?.config?.aboutPageTitle ||
      `About — ${siteName}`;
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
