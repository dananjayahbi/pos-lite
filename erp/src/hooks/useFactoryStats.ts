'use client';

import { useQuery } from '@tanstack/react-query';

export interface FactoryOutputStatsResponse {
  productionRunCount: number;
  totalProduced: number;
  totalMaterialCost: number;
  averageUnitsPerRun: number;
  finishedGoodsUnits: number;
  finishedGoodsValue: number;
  lastProductionAt: string | null;
}

export const FACTORY_STATS_QUERY_KEY = ['factory-output-stats'] as const;

/** Factory output KPIs (ARGUS #261). */
export function useFactoryStats() {
  return useQuery<{ success: boolean; data: FactoryOutputStatsResponse }>({
    queryKey: FACTORY_STATS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/store/factory/stats');
      if (!res.ok) throw new Error('Failed to fetch factory output stats');
      return res.json();
    },
    staleTime: 30_000,
  });
}
