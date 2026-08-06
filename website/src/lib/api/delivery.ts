/**
 * Client-side order-placement API for the website checkout.
 * Uses `NEXT_PUBLIC_API_BASE_URL` directly (client-safe, unlike the server-side
 * `apiFetch` in `@/lib/api/client.ts`).
 */

import { buildApiUrl } from '@/lib/utils';
import { SITE } from '@/config/site';
import type { CheckoutAddressInput } from '@/lib/validators/address';
import type { CartLine } from '@/stores/cartStore';

export interface PlaceOrderResult {
  deliveryId: string;
  orderRef: string;
}

export interface PlaceOrderError {
  message: string;
  details?: { path: string; message: string }[];
}

/**
 * Place a website order for a tenant. Returns the generated order reference.
 * Throws on failure with a parsed error message.
 */
export async function placeOrder(
  tenantSlug: string,
  address: CheckoutAddressInput,
  lines: CartLine[],
  totals: { codAmount: number; itemCount: number },
): Promise<PlaceOrderResult> {
  const url = buildApiUrl(SITE.apiBaseUrl, `/api/public/site/${tenantSlug}/orders`);
  if (!url) {
    throw new Error('Order placement is not configured (missing API base URL)');
  }

  const linePayload = lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    productName: l.productName,
    sku: l.variantSku,
    price: l.price,
    quantity: l.quantity,
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...address, lines: linePayload, ...totals }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: PlaceOrderResult;
    error?: string;
    details?: { path: string; message: string }[];
  };

  if (!response.ok || !json.success || !json.data) {
    const error: PlaceOrderError = { message: json.error ?? 'Failed to place your order' };
    if (json.details) error.details = json.details;
    const first = error.details?.[0];
    throw new Error(first ? `${first.path}: ${first.message}` : error.message);
  }

  return json.data;
}
