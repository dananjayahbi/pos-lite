// Top-level Contact page at /contact — renders for the default tenant
// with a clean URL (no tenant slug prefix).

import { ContactPageContent } from '@/components/website/shared-pages/ContactPageContent';
import { SITE } from '@/config/site';

export default function ContactRootPage() {
  return <ContactPageContent tenantSlug={SITE.defaultTenantSlug} />;
}

export const revalidate = 60;
