// Top-level About page at /about — renders for the default tenant
// with a clean URL (no tenant slug prefix).

import { AboutPageContent } from '@/components/website/shared-pages/AboutPageContent';
import { SITE } from '@/config/site';

export default function AboutRootPage() {
  return <AboutPageContent tenantSlug={SITE.defaultTenantSlug} />;
}

export const revalidate = 60;
