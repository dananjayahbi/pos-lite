// Top-level Shop page at /shop — renders for the default tenant
// with a clean URL (no tenant slug prefix).

import { ShopPageContent } from '@/components/website/shared-pages/ShopPageContent';
import { SITE } from '@/config/site';

interface ShopPageProps {
  searchParams: Promise<{ category?: string; sort?: string }>;
}

export default async function ShopRootPage({ searchParams }: ShopPageProps) {
  const sp = await searchParams;
  return (
    <ShopPageContent
      tenantSlug={SITE.defaultTenantSlug}
      category={sp.category ?? ''}
      sort={sp.sort ?? ''}
    />
  );
}

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
