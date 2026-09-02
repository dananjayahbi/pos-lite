// Top-level Appointments page at /appointments — renders for the default tenant
// with a clean URL (no tenant slug prefix).

import { AppointmentsPageContent } from '@/components/website/shared-pages/AppointmentsPageContent';
import { SITE } from '@/config/site';

export default function AppointmentsRootPage() {
  return <AppointmentsPageContent tenantSlug={SITE.defaultTenantSlug} />;
}

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
