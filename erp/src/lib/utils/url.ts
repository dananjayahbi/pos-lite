/**
 * Returns the canonical base URL for the application.
 *
 * Resolution order:
 *   1. AUTH_URL / NEXTAUTH_URL env var (explicit override)
 *   2. VERCEL_URL (auto-set by Vercel on every deployment)
 *   3. http://localhost:3000 (local development fallback)
 */
export function getBaseUrl(): string {
  // Explicit override takes priority
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;

  // Vercel auto-sets VERCEL_URL (no protocol, e.g. "my-app-abc123.vercel.app")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Local development
  return 'http://localhost:3000';
}

/**
 * Returns the canonical base URL of the customer-facing storefront.
 *
 * This is a DIFFERENT origin from `getBaseUrl()` (which resolves the ERP/admin
 * app). The distinction matters for payment redirects: PayHere's `return_url`
 * and `cancel_url` send the customer's BROWSER there, so pointing them at the
 * ERP would drop the shopper into the back office.
 *
 * One env var, so a deployment cannot accidentally target the wrong storefront.
 */
export function getWebsiteBaseUrl(): string {
  const configured = process.env.WEBSITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return 'http://localhost:3002';
}
