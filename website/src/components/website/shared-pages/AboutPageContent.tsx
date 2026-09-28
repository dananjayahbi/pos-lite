import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { AboutStorySection } from '../static-pages/AboutStorySection';
import { AboutMissionSection } from '../static-pages/AboutMissionSection';
import { AboutValuesSection } from '../static-pages/AboutValuesSection';
import { ConnectWithUsSection } from '../static-pages/ConnectWithUsSection';

interface AboutPageContentProps {
  tenantSlug: string;
}

export async function AboutPageContent({ tenantSlug }: AboutPageContentProps) {
  let tenant = null;
  let configResponse = null;

  try {
    [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[about] tenant/config fetch failed', err);
  }

  if (!tenant) notFound();

  const config = configResponse?.config;
  const siteName = config?.siteName || tenant.name;

  const aboutTitle = config?.aboutPageTitle || `About ${siteName}`;
  const aboutSubtitle = config?.aboutPageSubtitle || 'Learn more about our story and what drives us.';
  const aboutHeroImageUrl = config?.aboutHeroImageUrl;

  const socialLinks = config?.socialLinks ?? {};
  // `phone` is excluded here because it is rendered as a dedicated phone CTA
  // button below (via aboutPhoneLabel/aboutPhoneNumber) instead of a pill.
  const socialEntries = Object.entries(socialLinks).filter(
    ([key, value]) =>
      key !== 'phone' && value && typeof value === 'string' && value.length > 0,
  );

  const heroProps = aboutHeroImageUrl ? { heroImageUrl: aboutHeroImageUrl } : {};

  // Reference defaults (mirror about.html) used when the ERP has no saved
  // values for a given field. These keep the page looking intentional even if
  // the admin hasn't configured every section yet.
  const storyContent =
    config?.aboutStoryContent ??
    'It all started when our founders, direct descendants of royal Ceylon Ayurvedic physicians, recognized that modern wellness had lost touch with the pure botanical alchemy of ancestral medicine.\nRooted in centuries-old Ola Leaf manuscripts preserved through family generations, Wedagedara was born to revive authentic Ayurvedic remedies. We combine ethical forest harvesting with slow-fire earthen decoction methods to extract the unadulterated healing essence of nature.';

  const missionContent =
    config?.aboutMissionContent ??
    'We believe in the timeless balance of mind, body, and spirit. Our sacred mission is to restore cellular vitality and holistic longevity by delivering purest, non-commercialized Ceylon Ayurvedic elixirs crafted with unwavering reverence for nature.';

  const defaultValues = [
    {
      title: 'Ancestral Ola Leaf Purity',
      description:
        'Every formula adheres strictly to classical texts and ancestral decoction techniques without synthetic dilution.',
    },
    {
      title: 'Ethical Forest Sanctuaries',
      description:
        'We sustainably wild-harvest herbs from certified organic Ceylon forest reserves, honoring the natural regeneration cycles of the earth.',
    },
    {
      title: 'Tridosha Equilibrium',
      description:
        'Our remedies are carefully crafted to balance Vata, Pitta, and Kapha bio-energies for deep, holistic restoration.',
    },
    {
      title: 'Sacred Sustainability',
      description:
        'From earthen brewing vessels to zero-waste glass bottling, every touchpoint reflects our deep reverence for mother earth.',
    },
  ];

  const values = config?.aboutValues?.length
    ? config.aboutValues
    : defaultValues;

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
          title={config?.aboutStoryTitle ?? 'Our Story'}
          content={storyContent}
          imageUrl={config?.aboutStoryImageUrl ?? ''}
          imagePosition="left"
        />

        <AboutMissionSection
          title={config?.aboutMissionTitle ?? 'Our Mission'}
          content={missionContent}
        />

        <AboutValuesSection
          title={config?.aboutValuesSectionTitle ?? 'Our Values'}
          values={values}
        />

        <ConnectWithUsSection
          title="Connect With Us"
          phoneLabel={config?.aboutPhoneLabel ?? 'Call Us'}
          phoneNumber={config?.aboutPhoneNumber ?? ''}
          socialEntries={socialEntries.map(([key, value]) => ({
            key,
            value: value as string,
          }))}
        />
      </div>
    </StaticPageShell>
  );
}
