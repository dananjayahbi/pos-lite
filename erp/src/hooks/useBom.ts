'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BomIngredientView {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: string;
  quantityPerUnit: number;
  available: number;
}

export interface BomDetailView {
  id: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  name: string;
  isActive: boolean;
  notes: string | null;
  ingredients: BomIngredientView[];
  createdAt: string;
  updatedAt: string;
}

export interface BomItemView {
  id: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  name: string;
  isActive: boolean;
  notes: string | null;
  rawMaterialCount: number;
  ingredients: { rawMaterialId: string; name: string; quantityPerUnit: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionLine {
  rawMaterialId: string;
  rawMaterialName: string;
  quantityPerUnit: number;
  required: number;
  available: number;
  unit: string;
  insufficient: boolean;
}

export interface ProductionPlanView {
  bomId: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  quantity: number;
  consumption: ConsumptionLine[];
  sufficient: boolean;
}

export interface ProductionHistoryItem {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  actorName: string;
  variantSku: string;
  variantName: string;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ── List BOMs ────────────────────────────────────────────────────────────────

export function useBoms(filters: { variantId?: string; search?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.variantId) params.set('variantId', filters.variantId);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery<ListResponse<BomItemView>>({
    queryKey: ['boms', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/store/bom?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch bills of materials');
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

// ── BOM detail ───────────────────────────────────────────────────────────────

export function useBom(id: string | null) {
  return useQuery<{ success: boolean; data: BomDetailView }>({
    queryKey: ['bom', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/bom/${id}`);
      if (!res.ok) throw new Error('Failed to fetch BOM');
      return res.json();
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export interface BomIngredientInput {
  rawMaterialId: string;
  quantityPerUnit: string;
}

export interface CreateBomPayload {
  variantId: string;
  name: string;
  notes?: string;
  ingredients: BomIngredientInput[];
}

export function useCreateBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBomPayload) => {
      const res = await fetch('/api/store/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to create BOM');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }),
  });
}

export interface UpdateBomPayload {
  id: string;
  name?: string;
  notes?: string;
  isActive?: boolean;
  ingredients?: BomIngredientInput[];
}

export function useUpdateBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateBomPayload) => {
      const res = await fetch(`/api/store/bom/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to update BOM');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }),
  });
}

export function useDeleteBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/bom/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to delete BOM');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boms'] }),
  });
}

// ── Production planning & logging ────────────────────────────────────────────

export function useProductionPlan(bomId: string | null, quantity: number) {
  return useQuery<{ success: boolean; data: ProductionPlanView }>({
    queryKey: ['bom-plan', bomId, quantity],
    queryFn: async () => {
      const res = await fetch(
        `/api/store/bom/produce?bomId=${bomId}&quantity=${quantity}`,
      );
      if (!res.ok) throw new Error('Failed to fetch production plan');
      return res.json();
    },
    enabled: !!bomId && quantity > 0,
    staleTime: 15_000,
  });
}

export function useProduceGoods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { bomId: string; quantity: number; note?: string }) => {
      const res = await fetch('/api/store/bom/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed to log production');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom-plan'] });
      qc.invalidateQueries({ queryKey: ['production-logs'] });
      qc.invalidateQueries({ queryKey: ['raw-material-alerts'] });
    },
  });
}

// ── Production history ───────────────────────────────────────────────────────

export function useProductionLogs(filters: { bomId?: string; variantId?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.bomId) params.set('bomId', filters.bomId);
  if (filters.variantId) params.set('variantId', filters.variantId);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery<ListResponse<ProductionHistoryItem>>({
    queryKey: ['production-logs', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/store/bom/production?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch production logs');
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
