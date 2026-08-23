/**
 * Shared shop query-state model.
 *
 * All shop filters (category, sort, price range, concern, form, search term)
 * are expressed as URL query params on `/shop`. This module centralises the
 * shape of that state and how it is serialised to a shop URL, so every filter
 * control composes and resets consistently.
 */

import { tenantHomePath } from '@/lib/tenant';
import type { PublicProduct } from '@/types/website.types';

export interface ShopFilterState {
  category?: string | undefined;
  sort?: string | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  concern?: string | undefined;
  form?: string | undefined;
  q?: string | undefined;
}

/**
 * Build a shop page URL for a tenant, preserving any explicitly-provided
 * filter values. Pass a partial state to "apply" just that filter while
 * dropping it when the value is empty.
 */
export function buildShopUrl(
  tenantSlug: string,
  state: ShopFilterState,
): string {
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.sort && state.sort !== 'latest') params.set('sort', state.sort);
  if (state.priceMin !== undefined) params.set('priceMin', String(state.priceMin));
  if (state.priceMax !== undefined) params.set('priceMax', String(state.priceMax));
  if (state.concern) params.set('concern', state.concern);
  if (state.form) params.set('form', state.form);
  if (state.q) params.set('q', state.q);

  const query = params.toString();
  return `${tenantHomePath(tenantSlug)}/shop${query ? `?${query}` : ''}`;
}

/**
 * Compute the observed minimum/maximum retail price across a loaded catalog.
 * Used to seed the price-range control bounds so it stays in sync with what
 * the API can actually return. Falls back to [0, 0] for an empty catalog.
 */
export function priceBounds(products: PublicProduct[]): {
  min: number;
  max: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.retailPrice < min) min = variant.retailPrice;
      if (variant.retailPrice > max) max = variant.retailPrice;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  return { min, max };
}
