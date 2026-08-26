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
  /** Server-computed delivery fee (2dp string) stored on the ERP Delivery. */
  shippingFee?: string;
  /** Present for CARD orders — PayHere redirect target + hidden fields. */
  payment?: {
    payhereUrl: string;
    payload: Record<string, string>;
  };
}

export interface PlaceOrderError {
  message: string;
  details?: { path: string; message: string }[];
}

export interface PlaceOrderOptions {
  codAmount: number;
  itemCount: number;
  /** Optional total parcel weight (kg) used to price delivery. */
  totalWeightKg?: number;
  /** 'COD' (default) or 'CARD'. CARD returns a PayHere redirect payload. */
  paymentMethod?: 'COD' | 'CARD';
}

/**
 * Place a website order for a tenant. Returns the generated order reference, the
 * server-computed delivery fee, plus (for card orders) the PayHere redirect
 * payload. Throws on failure with a parsed error message.
 */
export async function placeOrder(
  tenantSlug: string,
  address: CheckoutAddressInput,
  lines: CartLine[],
  totals: PlaceOrderOptions,
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
    body: JSON.stringify({
      ...address,
      lines: linePayload,
      codAmount: totals.codAmount,
      itemCount: totals.itemCount,
      ...(totals.totalWeightKg !== undefined ? { totalWeightKg: totals.totalWeightKg } : {}),
      paymentMethod: totals.paymentMethod ?? 'COD',
    }),
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
