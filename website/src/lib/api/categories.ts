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
 * Fetch a single category by ID.
 *
 * The ERP doesn't expose a dedicated single-category endpoint, so we
 * fetch the full list and filter client-side. Results are cached by
 * Next.js ISR so repeated calls are cheap.
 */
export async function getPublicCategory(
  tenantSlug: string,
  categoryId: string,
): Promise<PublicCategory | null> {
  const categories = await getPublicCategories(tenantSlug, { limit: 200 });
  return categories.find((c) => c.id === categoryId) ?? null;
}