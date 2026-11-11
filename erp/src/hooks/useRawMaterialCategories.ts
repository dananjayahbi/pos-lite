'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RawMaterialCategoryItem {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  usageCount: number;
}

interface RawMaterialCategoryListResponse {
  success: boolean;
  data: RawMaterialCategoryItem[];
}

async function parseJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? 'Request failed');
  }
  return json;
}

export function useRawMaterialCategories() {
  return useQuery<RawMaterialCategoryListResponse>({
    queryKey: ['raw-material-categories'],
    queryFn: async () => {
      const res = await fetch('/api/store/raw-material-categories');
      return parseJson(res);
    },
    staleTime: 30_000,
  });
}

export function useCreateRawMaterialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/store/raw-material-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      return parseJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-categories'] });
    },
  });
}

export function useUpdateRawMaterialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      isActive?: boolean;
    }) => {
      const res = await fetch(`/api/store/raw-material-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return parseJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-categories'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
    },
  });
}

export function useDeleteRawMaterialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/raw-material-categories/${id}`, {
        method: 'DELETE',
      });
      return parseJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-categories'] });
    },
  });
}
