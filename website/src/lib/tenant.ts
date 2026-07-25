/**
 * Tenant resolution helpers.
 *
 * The storefront accepts the tenant slug from the URL path
 * (`/[tenantSlug]`). When a visitor hits the bare host we redirect
 * them to the configured default tenant slug.
 */

import { SITE } from '@/config/site';

export interface ResolvedTenant {
  slug: string;
  isDefault: boolean;
}

/**
 * Return the default tenant slug to use when the URL has no slug segment.
 */
export function getDefaultTenantSlug(): string {
  return SITE.defaultTenantSlug;
}

/**
 * Determine if a slug matches the default tenant.
 */
export function isDefaultTenant(slug: string): boolean {
  return slug === getDefaultTenantSlug();
}

/**
 * Build the storefront path for a given tenant slug.
 * For the default tenant the root `/` is the canonical home.
 * For any other tenant returns `/<slug>`.
 */
export function tenantHomePath(slug: string): string {
  const trimmed = slug.replace(/^\/+|\/+$/g, '');
  if (trimmed === getDefaultTenantSlug()) return '/';
  return `/${trimmed}`;
}