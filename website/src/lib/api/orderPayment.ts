/**
 * Client-side order-payment API for the website.
 *
 * Wraps the ERP public endpoint `GET /api/public/site/[tenantSlug]/orders/
 * [orderRef]/payment`. Used by the checkout confirmation page after PayHere
 * sends the customer's browser back: PayHere's `return_url` carries **no**
 * payment status, so the authoritative state is read from here.
 */

import { buildApiUrl } from '@/lib/utils';
import { SITE } from '@/config/site';

export type OrderPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface PublicOrderPayment {
  orderRef: string;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: string;
  /** Friendly wording computed by the ERP so both apps cannot drift apart. */
  paymentLabel: string;
  /** Payable total (goods + delivery fee), 2dp string. */
  total: string;
  currency: string;
  orderStatus: string;
  placedAt: string;
  /** The card method used (VISA/GENIE/EZCASH/…), when the gateway reported it. */
  cardMethod: string | null;
}

/**
 * Fetch one order's payment status by reference. Returns `null` when the ERP is
 * unreachable or the order is unknown, so the caller can show a neutral
 * "still confirming" message rather than an error.
 */
export async function getOrderPayment(
  tenantSlug: string,
  orderRef: string,
): Promise<PublicOrderPayment | null> {
  const url = buildApiUrl(
    SITE.apiBaseUrl,
    `/api/public/site/${encodeURIComponent(tenantSlug)}/orders/${encodeURIComponent(orderRef)}/payment`,
  );
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { order?: PublicOrderPayment };
    return json.order ?? null;
  } catch {
    return null;
  }
}
