/**
 * XC-04 — canonical HTML escaping for SERVER-RENDERED sinks (email templates,
 * PDF/CSV/print HTML generators, any non-React `text/html` response).
 *
 * The React UI does not need this (React escapes interpolated values itself);
 * this helper exists for the places where we build HTML strings manually.
 * Policy: "escape on render, never trust on server-render" — see
 * docs/input-policy.md. Escaping happens at the sink, NOT at store time
 * (HTML-encoding on store would corrupt Unicode round-trips).
 */

/**
 * Escape the five HTML-significant characters (`& < > " '`). Safe for both
 * text-node and double-quoted-attribute interpolation contexts.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape helper for values that may be null/undefined (renders empty string). */
export function escapeHtmlOrNull(value: string | null | undefined): string {
  return value == null ? '' : escapeHtml(value);
}
