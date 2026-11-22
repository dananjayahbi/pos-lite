/**
 * Storefront preview URLs for the website CMS (ARGUS #500).
 *
 * The ERP and storefront are separate apps/hosts. In local development the ERP
 * runs on :3003 and the storefront on :3002; in production the ERP is served
 * from `admin.<host>` while the storefront lives on the bare host. Storefront
 * pages are scoped by tenant slug, so a preview link without the slug 404s.
 *
 * This helper is deliberately pure so the host/port/slug rules can be tested
 * without a browser.
 */

export interface StorefrontPreviewInput {
  protocol: string;
  host: string;
  tenantSlug: string;
  /** Path on the storefront, e.g. `/appointments`. */
  path: string;
}

export function normalizeStorefrontHost(host: string): string {
  let next = host.trim();
  next = next.replace(/^admin\./i, '');
  next = next.replace(/:3003$/, ':3002');
  return next;
}

export function buildStorefrontPreviewUrl(input: StorefrontPreviewInput): string {
  const slug = input.tenantSlug.trim().replace(/^\/+|\/+$/g, '');
  if (!slug) return '';
  const shortHost = normalizeStorefrontHost(input.host);
  if (!shortHost) return '';
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  return `${input.protocol}//${shortHost}/${encodeURIComponent(slug)}${path}`;
}
