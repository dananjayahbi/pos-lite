/**
 * Site-wide constants. These are not user-configurable — they live here
 * to keep magic strings out of components.
 */

export const SITE = {
  /** Human-readable name of the storefront project. */
  name: 'Ruhunuwedagedara Storefront',

  /** Default tenant slug used when a visitor hits the bare host. */
  defaultTenantSlug:
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG) ||
    'ruhunuwedagedara',

  /** Base URL of the ERP backend (used for fetch from server components). */
  apiBaseUrl:
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) || '',

  /** Public site URL — used for SEO metadata. */
  siteUrl:
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
    'http://ruhunuwedagedara.lk:3002',

  /** ISR revalidate interval (seconds). */
  revalidateSeconds: Number.parseInt(
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REVALIDATE_SECONDS) ||
      '60',
    10,
  ),
} as const;

export const ROUTES = {
  storefront: (tenantSlug: string) => `/${tenantSlug}`,
  shop: (tenantSlug: string) => `/${tenantSlug}/shop`,
  product: (tenantSlug: string, productId: string) =>
    `/${tenantSlug}/product/${productId}`,
  category: (tenantSlug: string, categoryId: string) =>
    `/${tenantSlug}/category/${categoryId}`,
  cart: (tenantSlug: string) => `/${tenantSlug}/cart`,
  checkout: (tenantSlug: string) => `/${tenantSlug}/checkout`,
  track: (tenantSlug: string) => `/${tenantSlug}/track`,
} as const;