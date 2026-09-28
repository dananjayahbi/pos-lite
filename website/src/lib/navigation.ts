/**
 * Header navigation helpers for the storefront.
 *
 * Centralises the logic that turns raw tenant/website config into the final
 * list of nav links rendered by `WebsiteHeader`. Keeping this in a pure
 * module (rather than inside the component) makes it easy to unit test and
 * keeps the header component focused on presentation only.
 */

import type { WebsiteConfigData, WebsiteNavItem } from '@/types/website.types';
import { SITE, ROUTES } from '@/config/site';
import { tenantHomePath } from '@/lib/tenant';

/** A single resolved navigation link. */
export interface HeaderNavLink {
  label: string;
  href: string;
}

/**
 * Fallback nav order, matching the reference design:
 * HOME / ABOUT / SHOP / CONTACT.
 *
 * Used only when the owner has not configured any `navItems`.
 */
const DEFAULT_NAV: HeaderNavLink[] = [
  { label: 'ABOUT', href: '/about' },
  { label: 'SHOP', href: '/shop' },
  { label: 'CONTACT', href: '/contact' },
];

/**
 * Resolve a possibly-relative nav href against the current tenant slug.
 *
 * For the default tenant (which renders at `/`), relative hrefs like `/about`
 * stay as-is. For any other tenant, hrefs are prefixed with the slug so links
 * target the tenant's own pages. Absolute URLs and already-prefixed hrefs are
 * returned untouched.
 */
export function resolveNavHref(href: string, tenantSlug: string): string {
  if (!href || href === '#') return href;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith(`/${tenantSlug}`) || href.startsWith(`/${tenantSlug}/`)) return href;
  if (tenantSlug === SITE.defaultTenantSlug) return href;
  if (href.startsWith('/')) return `/${tenantSlug}${href}`;
  return href;
}

/**
 * Test whether a resolved nav href is the active route.
 */
export function isNavActive(href: string, pathname: string, tenantSlug: string): boolean {
  if (href === '/' ) return pathname === '/';
  const resolved = resolveNavHref(href, tenantSlug).replace(/\/$/, '');
  return pathname === resolved || pathname.startsWith(`${resolved}/`);
}

/** The nav structure rendered by the header. */
export interface HeaderNav {
  /** Primary nav links (HOME first, then configured/fallback items). */
  items: HeaderNavLink[];
  /** The Appointments pill link — always present, matching the reference. */
  appointments: HeaderNavLink;
}

/**
 * Build the full header navigation from the tenant's website config.
 */
export function buildHeaderNav(
  config: WebsiteConfigData,
  tenantSlug: string,
): HeaderNav {
  const configured = (config.navItems ?? []) as WebsiteNavItem[];
  const baseNav: HeaderNavLink[] =
    configured.length > 0
      ? configured.map((item) => ({ label: item.label, href: item.href }))
      : DEFAULT_NAV;

  const homeHref = tenantHomePath(tenantSlug);

  const items: HeaderNavLink[] = [{ label: 'HOME', href: homeHref }, ...baseNav];

  const appointments: HeaderNavLink = {
    label: config.appointments?.navLabel || 'Appointments',
    href: ROUTES.appointments(tenantSlug),
  };

  return { items, appointments };
}

/**
 * Resolve the fallback nav order for a tenant with no configured items.
 * Exposed for tests / reuse.
 */
export function getDefaultNav(): HeaderNavLink[] {
  return DEFAULT_NAV;
}
