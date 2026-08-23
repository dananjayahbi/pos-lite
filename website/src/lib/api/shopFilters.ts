/**
 * Shop filters API — public, read-only.
 *
 * Wraps the ERP `/api/public/site/[tenantSlug]/shop-filters` endpoint which
 * returns the curated health-concern taxonomy and the distinct product forms
 * present in the catalog (used to render the storefront filter controls).
 */

import { apiGet } from '@/lib/api/client';
import type { PublicShopFilters } from '@/types/website.types';

const EMPTY: PublicShopFilters = { concerns: [], forms: [] };

export async function getPublicShopFilters(
  tenantSlug: string,
): Promise<PublicShopFilters> {
  return apiGet<PublicShopFilters>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/shop-filters`,
    {
      tags: [`shop-filters:${tenantSlug}`, `tenant:${tenantSlug}`],
    },
  ).catch(() => EMPTY);
}
