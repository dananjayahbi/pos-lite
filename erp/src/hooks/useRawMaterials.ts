'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { RawMaterialCategory, Unit } from '@/generated/prisma/client';
import type { RawMaterialStockStatus } from '@/lib/services/rawMaterial.core';

export interface RawMaterialFilters {
  search?: string | undefined;
  category?: RawMaterialCategory | undefined;
  stockStatus?: RawMaterialStockStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface RawMaterialItem {
  id: string;
  name: string;
  category: RawMaterialCategory;
  unit: Unit;
  quantity: number;
  lowStockThreshold: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockStatus: RawMaterialStockStatus;
}

interface RawMaterialListResponse {
  success: boolean;
  data: RawMaterialItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useRawMaterials(filters: RawMaterialFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.stockStatus) params.set('stockStatus', filters.stockStatus);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  const queryString = params.toString();

  return useQuery<RawMaterialListResponse>({
    queryKey: ['raw-materials', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/store/raw-materials?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch raw materials');
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export interface RawMaterialStats {
  totalMaterials: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export function useRawMaterialStats() {
  return useQuery<{ success: boolean; data: RawMaterialStats }>({
    queryKey: ['raw-material-stats'],
    queryFn: async () => {
      const res = await fetch('/api/store/raw-materials/stats');
      if (!res.ok) throw new Error('Failed to fetch raw material stats');
      return res.json();
    },
    staleTime: 30_000,
  });
}
