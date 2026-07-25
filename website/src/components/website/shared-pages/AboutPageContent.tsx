import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { AboutStorySection } from '../static-pages/AboutStorySection';
import { AboutMissionSection } from '../static-pages/AboutMissionSection';
import { AboutValuesSection } from '../static-pages/AboutValuesSection';

interface AboutPageContentProps {
  tenantSlug: string;
}

export async function AboutPageContent({ tenantSlug }: AboutPageContentProps) {
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

  const socialLinks = config?.socialLinks ?? {};
  const socialEntries = Object.entries(socialLinks).filter(
    ([, value]) => value && typeof value === 'string' && value.length > 0,
  );

  const heroProps = aboutHeroImageUrl ? { heroImageUrl: aboutHeroImageUrl } : {};

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={aboutTitle}
      subtitle={aboutSubtitle}
      {...heroProps}
    >
      <div className="space-y-0">
        <AboutStorySection
          title={config?.aboutStoryTitle ?? ''}
          content={config?.aboutStoryContent ?? ''}
          imageUrl={config?.aboutStoryImageUrl ?? ''}
          imagePosition="right"
        />

        <div className="my-4 flex justify-center">
          <div className="w-16 h-px bg-[var(--site-accent,#b4946e)]" />
        </div>

        <AboutMissionSection
          title={config?.aboutMissionTitle ?? ''}
          content={config?.aboutMissionContent ?? ''}
        />

        <AboutValuesSection
          title={config?.aboutValuesSectionTitle ?? ''}
          values={config?.aboutValues ?? []}
        />

        {(!config?.aboutValues || config.aboutValues.length === 0) && !config?.aboutMissionContent && !config?.aboutStoryContent && (
          <AboutValuesSection
            title="What We Stand For"
            values={[
              {
                title: 'Quality First',
                description: 'Every product meets our uncompromising standards for purity and excellence.',
              },
              {
                title: 'Customer Commitment',
                description: 'Your satisfaction is at the heart of everything we do.',
              },
              {
                title: 'Authenticity',
                description: 'We stay true to our values, our heritage, and our promises.',
              },
            ]}
          />
        )}

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
