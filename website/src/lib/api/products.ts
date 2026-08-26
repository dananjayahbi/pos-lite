/**
 * Product API — public, read-only.
 *
 * Wraps the ERP `/api/public/site/[tenantSlug]/products*` endpoints.
 */

import { apiGet } from '@/lib/api/client';
import type { PublicProduct } from '@/types/website.types';

export interface ProductListOptions {
  limit?: number;
  /** Filter by category. */
  categoryId?: string;
  /** Filter by brand. */
  brandId?: string;
  /** Filter by minimum retail price (inclusive). */
  priceMin?: number | undefined;
  /** Filter by maximum retail price (inclusive). */
  priceMax?: number | undefined;
  /** Filter by variant form, e.g. Powder, Capsule. */
  form?: string;
  /** Filter by health concern (HealthConcern enum value). */
  concern?: string;
  /** Keyword search term. */
  q?: string;
  /** Sort mode. */
  sort?: 'latest' | 'best-selling' | 'price-asc' | 'price-desc';
}

export interface ProductListResponse {
  products: PublicProduct[];
  total: number;
}

/**
 * Fetch a list of products for the storefront.
 */
export async function getPublicProducts(
  tenantSlug: string,
  options: ProductListOptions = {},
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.categoryId) params.set('categoryId', options.categoryId);
  if (options.brandId) params.set('brandId', options.brandId);
  if (options.priceMin !== undefined) params.set('priceMin', String(options.priceMin));
  if (options.priceMax !== undefined) params.set('priceMax', String(options.priceMax));
  if (options.form) params.set('form', options.form);
  if (options.concern) params.set('concern', options.concern);
  if (options.q) params.set('q', options.q);
  if (options.sort) params.set('sort', options.sort);

  const query = params.toString();
  const path = `/api/public/site/${encodeURIComponent(tenantSlug)}/products${
    query ? `?${query}` : ''
  }`;

  return apiGet<ProductListResponse>(path, {
    tags: [`products:${tenantSlug}`, `tenant:${tenantSlug}`],
  });
}

/**
 * Fetch a single product by id (or slug).
 *
 * The ERP wraps the resource in an envelope (`{ product: ... }`) for
 * forward-compatibility (lets the API add sibling fields like metadata
 * without breaking clients). We unwrap it here so callers receive a
 * `PublicProduct` directly.
 */
export async function getPublicProduct(
  tenantSlug: string,
  productId: string,
): Promise<PublicProduct | null> {
  const res = await apiGet<{ product: PublicProduct | null }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/products/${encodeURIComponent(productId)}`,
    {
      tags: [`product:${productId}`, `products:${tenantSlug}`],
    },
  );
  return res?.product ?? null;
}

/** Convenience — best-selling products for a tenant. */
export async function getBestSellingProducts(
  tenantSlug: string,
  limit = 10,
): Promise<PublicProduct[]> {
  const res = await getPublicProducts(tenantSlug, { sort: 'best-selling', limit });
  return res.products;
}

/** Convenience — latest products for a tenant. */
export async function getLatestProducts(
  tenantSlug: string,
  limit = 10,
): Promise<PublicProduct[]> {
  const res = await getPublicProducts(tenantSlug, { sort: 'latest', limit });
  return res.products;
}