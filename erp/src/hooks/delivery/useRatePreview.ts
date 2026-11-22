'use client';

import { useQuery } from '@tanstack/react-query';

import type { RatePreviewRequest } from '@/lib/delivery/ratePreview.core';

export interface RatePreviewResponse {
  shippingFee: string;
  baseRate: string;
  extraKgRate: string;
  freeBaseWeightKg: string;
  /** False when the tenant has no active rate card (ARGUS #292). */
  configured?: boolean;
}

/**
 * ARGUS #291: the preview is a keyed query, not a floating mutation. A new
 * weight/location produces a new key (so the old amount cannot linger), and a
 * cleared input disables the query instead of showing stale data.
 */
export function useRatePreview(request: RatePreviewRequest | null) {
  return useQuery<RatePreviewResponse>({
    queryKey: ['rate-preview', request],
    queryFn: async () => {
      if (!request) throw new Error('Rate preview requires weight and destination');
      const res = await fetch('/api/store/delivery/rate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to preview rate');
      return json.data as RatePreviewResponse;
    },
    enabled: request !== null,
    staleTime: 60_000,
    retry: false,
  });
}
