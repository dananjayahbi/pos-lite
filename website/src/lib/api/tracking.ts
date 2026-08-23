/**
 * Tracking API — public, read-only.
 *
 * Wraps the ERP `/api/public/site/[tenantSlug]/track` endpoint. Returns a
 * customer-safe summary of website orders with their delivery timeline.
 */

import { apiGet } from '@/lib/api/client';
import type { PublicTrackingResponse } from '@/types/website.types';

export interface TrackingLookup {
  ref?: string;
  phone?: string;
  waybill?: string;
}

export async function getPublicTracking(
  tenantSlug: string,
  lookup: TrackingLookup,
): Promise<PublicTrackingResponse> {
  const params = new URLSearchParams();
  if (lookup.ref) params.set('ref', lookup.ref);
  if (lookup.phone) params.set('phone', lookup.phone);
  if (lookup.waybill) params.set('waybill', lookup.waybill);
  const query = params.toString();

  return apiGet<PublicTrackingResponse>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/track${query ? `?${query}` : ''}`,
    { noStore: true },
  );
}
