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

export const revalidate = 60;
