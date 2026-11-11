'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface PackagingCategoryItem {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  usageCount: number;
}

async function readJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!json?.success) {
    throw new Error(json?.error?.message ?? 'Request failed');
  }
  return json.data;
}

export function usePackaging() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['packaging'],
    queryFn: async () => {
      const res = await fetch('/api/store/packaging');
      return readJson(res);
    },
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/store/packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      queryClient.invalidateQueries({ queryKey: ['packaging-categories'] });
      toast.success('Packaging item created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/store/packaging/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      queryClient.invalidateQueries({ queryKey: ['packaging-categories'] });
      toast.success('Packaging item updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/packaging/${id}`, { method: 'DELETE' });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      queryClient.invalidateQueries({ queryKey: ['packaging-categories'] });
      toast.success('Packaging item deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ id, delta, note }: { id: string; delta: number; note?: string }) => {
      const res = await fetch(`/api/store/packaging/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, ...(note ? { note } : {}) }),
      });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      toast.success('Stock adjusted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    data: query.data as PackagingItemRow[] | undefined,
    isLoading: query.isLoading,
    create,
    update,
    remove,
    adjust,
  };
}

export interface PackagingItemRow {
  id: string;
  name: string;
  category: string;
  categoryName?: string;
  sku?: string | null;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  autoDeduct: boolean;
  consumptionPerParcel?: number | string | null;
}

export function usePackagingCategories() {
  return useQuery<PackagingCategoryItem[]>({
    queryKey: ['packaging-categories'],
    queryFn: async () => {
      const res = await fetch('/api/store/packaging-categories');
      return readJson(res);
    },
    staleTime: 30_000,
  });
}

export function useCreatePackagingCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/store/packaging-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-categories'] });
    },
  });
}

export function useUpdatePackagingCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; isActive?: boolean }) => {
      const res = await fetch(`/api/store/packaging-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-categories'] });
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
    },
  });
}

export function useDeletePackagingCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/packaging-categories/${id}`, { method: 'DELETE' });
      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-categories'] });
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
    },
  });
}
