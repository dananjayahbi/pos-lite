import { notFound } from 'next/navigation';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { ContactInfoSection } from '../static-pages/ContactInfoSection';

interface ContactPageContentProps {
  tenantSlug: string;
}

// Reference defaults (mirror contact.html) used when the ERP has no saved
// value for a given field, so the page still looks intentional.
const DEFAULT_CONTACT_INFO = {
  title: 'Get in Touch',
  address: 'No. 42, Horton Place, Colombo 07, Western Province, Sri Lanka (00700)',
  phone: '+94 (0) 11 234 5678',
  email: 'care@wedagedara.lk',
  businessHours: 'Monday – Sunday: 8:00 AM – 7:00 PM',
};

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
  const contactSubtitle = config?.contactPageSubtitle || "We'd love to hear from you";
  const contactHeroImageUrl = config?.contactHeroImageUrl;

  // Fall back to socialLinks when dedicated contact fields are empty, then to
  // the reference defaults so the section always renders intentionally.
  const address = config?.contactAddress || DEFAULT_CONTACT_INFO.address;
  const phone =
    config?.contactPhoneDisplay ||
    config?.socialLinks?.phone ||
    DEFAULT_CONTACT_INFO.phone;
  const email =
    config?.contactEmailDisplay ||
    config?.socialLinks?.email ||
    DEFAULT_CONTACT_INFO.email;
  const businessHours =
    config?.contactBusinessHours || DEFAULT_CONTACT_INFO.businessHours;

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
      <ContactInfoSection
        {...(config?.contactInfoTitle
          ? { title: config.contactInfoTitle }
          : { title: DEFAULT_CONTACT_INFO.title })}
        {...(address ? { address } : {})}
        {...(phone ? { phone } : {})}
        {...(email ? { email } : {})}
        {...(businessHours ? { businessHours } : {})}
        {...(config?.contactMapEmbedUrl
          ? { mapEmbedUrl: config.contactMapEmbedUrl }
          : {})}
      />
    </StaticPageShell>
  );
}
