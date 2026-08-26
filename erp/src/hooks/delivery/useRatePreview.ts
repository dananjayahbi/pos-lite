'use client';

import { useMutation } from '@tanstack/react-query';

export function useRatePreview() {
  return useMutation({
    mutationFn: async (data: {
      weightKg?: number;
      destinationDistrictId?: number;
      destinationCityId?: number;
    }) => {
      const res = await fetch('/api/store/delivery/rate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to preview rate');
      return json.data;
    },
  });
}
