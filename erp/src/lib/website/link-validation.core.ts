/**
 * Link and colour validation for website CMS fields (ARGUS #503).
 *
 * Navigation, footer, CTA, announcement and ad-target fields were length-only,
 * so `javascript:...` (rendered directly by the storefront) and a bare `#`
 * were accepted. Colour text inputs accepted any 7 characters.
 *
 * Allowed link forms:
 * - an internal path beginning with a single `/` (`/shop`);
 * - a fragment with a name (`#contact`) - a bare `#` is a placeholder, not a
 *   destination;
 * - `mailto:` or `tel:`;
 * - an absolute `http://` or `https://` URL.
 *
 * Protocol-relative (`//host`), relative words (`shop`), all other schemes
 * (including `javascript:`, `data:`, `vbscript:`) and control characters are
 * rejected.
 */

const CONTROL_OR_SPACE = /[\s\u0000-\u001f\u007f]/;
const ABSOLUTE_HTTP = /^https?:\/\//i;

export function isSafeWebsiteHref(raw: string): boolean {
  const value = raw.trim();
  if (value === '') return false;
  if (CONTROL_OR_SPACE.test(value)) return false;

  if (value.startsWith('#')) return value.length > 1;
  if (value.startsWith('//')) return false;
  if (value.startsWith('/')) return !value.startsWith('/\\');

  if (/^mailto:[^\s]+@[^\s]+$/i.test(value)) return true;
  if (/^tel:[+0-9()\-\s]+$/i.test(value)) return true;

  if (!ABSOLUTE_HTTP.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Empty is meaningful for optional fields (clears the link). */
export function isSafeWebsiteHrefOrEmpty(raw: string): boolean {
  return raw.trim() === '' || isSafeWebsiteHref(raw);
}

/** `#rgb` or `#rrggbb`. */
export function isHexColor(raw: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.trim());
}

export function isHexColorOrEmpty(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  return raw.trim() === '' || isHexColor(raw);
}
