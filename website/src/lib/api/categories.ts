/**
 * Category API — public, read-only.
 */

import { apiGet } from '@/lib/api/client';
import type { PublicCategory } from '@/types/website.types';

export async function getPublicCategories(
  tenantSlug: string,
  options: { limit?: number } = {},
): Promise<PublicCategory[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();

  const res = await apiGet<{ categories: PublicCategory[] }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/categories${
      query ? `?${query}` : ''
    }`,
    {
      tags: [`categories:${tenantSlug}`],
    },
  );
  return res.categories;
}

/**
 * Fetch a single category by ID from the dedicated public endpoint.
 * Cached under the tenant's category tag so it purges with the list.
 */
export async function getPublicCategory(
  tenantSlug: string,
  categoryId: string,
): Promise<PublicCategory | null> {
  const res = await apiGet<{ category: PublicCategory }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/categories/${encodeURIComponent(categoryId)}`,
    {
      tags: [`categories:${tenantSlug}`],
    },
  );
  return res.category ?? null;
}