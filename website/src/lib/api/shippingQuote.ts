/**
 * Client-side delivery-fee quote API for the website checkout.
 * Calls the ERP public shipping-quote endpoint to estimate the delivery fee for
 * a given destination + weight before the customer places the order.
 */

import { buildApiUrl } from '@/lib/utils';
import { SITE } from '@/config/site';

export interface ShippingQuoteRequest {
  cityName?: string | undefined;
  districtName?: string | undefined;
  totalWeightKg?: number | undefined;
}

export interface ShippingQuoteResult {
  shippingFee: string;
}

/**
 * Request a delivery-fee estimate for a tenant. Returns the fee as a 2dp string,
 * or null when the quote could not be obtained (caller decides whether to show
 * "Calculated on delivery").
 */
export async function getShippingQuote(
  tenantSlug: string,
  input: ShippingQuoteRequest,
): Promise<ShippingQuoteResult | null> {
  const url = buildApiUrl(SITE.apiBaseUrl, `/api/public/site/${tenantSlug}/shipping-quote`);
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });

    const json = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      data?: ShippingQuoteResult;
    };

    if (!response.ok || !json.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}
