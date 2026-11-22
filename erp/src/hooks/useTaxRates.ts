'use client';

import { useQuery } from '@tanstack/react-query';

import type { TaxRateSnapshot } from '@/lib/constants/product-options';

/**
 * Tenant VAT/SSCL rates used by the product tax-rule labels and POS cart.
 *
 * The GET endpoint is readable by any authenticated tenant user (cashiers need
 * it to preview tax), so product screens can use the same cached query key.
 */
export function useTaxRates() {
  return useQuery<TaxRateSnapshot | null>({
    queryKey: ['tax-rates'],
    queryFn: async () => {
      const res = await fetch('/api/settings/taxes');
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: TaxRateSnapshot | null };
      return json.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
