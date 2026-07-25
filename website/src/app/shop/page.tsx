// Top-level Shop page at /shop — renders for the default tenant
// with a clean URL (no tenant slug prefix).

import { ShopPageContent } from '@/components/website/shared-pages/ShopPageContent';
import { SITE } from '@/config/site';

interface ShopPageProps {
  searchParams: Promise<{ category?: string; sort?: string }>;
}

export default async function ShopRootPage({ searchParams }: ShopPageProps) {
  return (
    <ShopPageContent
      tenantSlug={SITE.defaultTenantSlug}
      category={await searchParams.then((s) => s.category)}
      sort={await searchParams.then((s) => s.sort)}
    />
  );
}

export const revalidate = 60;
