/**
 * Server-side PayHere availability for the storefront.
 *
 * PayHere's merchant secret lives ONLY in the ERP (the checkout `hash` is
 * computed there), so the website cannot tell from its own env whether a card
 * payment can actually complete. It asks the ERP instead.
 *
 * The ERP's `GET /api/health` reports `integrations.payhere.checkoutReady`
 * (presence-only booleans, never a secret). Reading it here means a storefront
 * pointed at an under-configured ERP does not advertise a payment method that
 * would send the customer to a dead end.
 *
 * `NEXT_PUBLIC_PAYHERE_ENABLED` acts as a manual override for deployments where
 * the ERP health endpoint is unreachable: set it to "false" to hide the card
 * option outright. It defaults to ON, so a health-probe failure does not remove
 * the option for a customer who could otherwise pay.
 */

import { buildApiUrl } from '@/lib/utils';
import { SITE } from '@/config/site';

interface HealthResponse {
  integrations?: {
    payhere?: {
      checkoutReady?: boolean;
    };
  };
}

/**
 * Whether the storefront should offer "Pay by Card".
 *
 * Server-only (it performs a fetch). Call it from a server component and pass
 * the result to the client form as a prop so the decision is made once, not on
 * every render.
 */
export async function isCardPaymentAvailable(): Promise<boolean> {
  const envFlag = process.env.NEXT_PUBLIC_PAYHERE_ENABLED;
  if (envFlag === 'false') return false;

  const url = buildApiUrl(SITE.apiBaseUrl, '/api/health');
  if (!url) return envFlag !== 'false';

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Availability can change with a config fix; cache briefly rather than
      // probing the ERP on every checkout render.
      next: { revalidate: 60 },
    });
    if (!response.ok) return true;
    const body = (await response.json()) as HealthResponse;
    const ready = body.integrations?.payhere?.checkoutReady;
    // An ERP that reports nothing about PayHere (older build) must not silently
    // disable payments — fall through to available.
    return ready === undefined ? true : ready;
  } catch {
    // A health-probe failure is not evidence that payments are broken.
    return true;
  }
}
