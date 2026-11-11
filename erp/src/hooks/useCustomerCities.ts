'use client';

import { useQuery } from '@tanstack/react-query';
import type { CustomerCityOption, CustomerCitySource } from '@/lib/utils/customer-cities';

export interface CustomerCitiesResponse {
  cities: CustomerCityOption[];
  source: CustomerCitySource;
  syncedAt: string | null;
}

/**
 * Load city options for the customer form. Cached by react-query for an hour —
 * Trans Express locations change infrequently and the server already caches
 * them on the tenant settings.
 */
export function useCustomerCities(enabled = true) {
  return useQuery<CustomerCitiesResponse>({
    queryKey: ['customer-cities'],
    queryFn: async () => {
      const res = await fetch('/api/store/customers/cities');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to load cities');
      }
      return json.data as CustomerCitiesResponse;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}
