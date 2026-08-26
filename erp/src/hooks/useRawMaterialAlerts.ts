'use client';

import { useQuery } from '@tanstack/react-query';

export type RawMaterialAlertSeverity = 'LOW' | 'CRITICAL';

export interface RawMaterialAlert {
  rawMaterialId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  severity: RawMaterialAlertSeverity;
}

export function useRawMaterialAlerts() {
  return useQuery<{ success: boolean; data: RawMaterialAlert[] }>({
    queryKey: ['raw-material-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/store/raw-materials/alerts');
      if (!res.ok) throw new Error('Failed to fetch raw material alerts');
      return res.json();
    },
    staleTime: 20_000,
  });
}
