// filepath: src/app/page.tsx
// Root entry point — renders the storefront directly for the configured
// default tenant. No client-side redirect, so the URL stays clean
// (e.g. http://ruhunuwedagedara.lk:3002/ is the actual home page).

import { Storefront } from '@/components/website/Storefront';
import { SITE } from '@/config/site';

export default function RootPage() {
  return <Storefront tenantSlug={SITE.defaultTenantSlug} />;
}

// Match the storefront's ISR cadence so the home page revalidates with the
// rest of the public content.
export const revalidate = 60;