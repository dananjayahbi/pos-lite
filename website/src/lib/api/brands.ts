/**
 * Brand API — public, read-only.
 */

import { apiGet } from '@/lib/api/client';
import type { PublicBrand } from '@/types/website.types';

export async function getPublicBrands(
  tenantSlug: string,
  options: { limit?: number } = {},
): Promise<PublicBrand[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();

  const res = await apiGet<{ brands: PublicBrand[] }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/brands${query ? `?${query}` : ''}`,
    {
      tags: [`brands:${tenantSlug}`],
    },
  );
  return res.brands;
}