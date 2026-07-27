// Top-level About page at /about — renders for the default tenant
// with a clean URL (no tenant slug prefix).

import { AboutPageContent } from '@/components/website/shared-pages/AboutPageContent';
import { SITE } from '@/config/site';

export default function AboutRootPage() {
  return <AboutPageContent tenantSlug={SITE.defaultTenantSlug} />;
}

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
