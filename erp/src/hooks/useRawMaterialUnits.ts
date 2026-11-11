'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RawMaterialUnitItem {
  id: string;
  key: string;
  name: string;
  shortLabel: string;
  isActive: boolean;
  usageCount: number;
}

interface RawMaterialUnitListResponse {
  success: boolean;
  data: RawMaterialUnitItem[];
}

async function parseJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? 'Request failed');
  }
  return json;
}

export function useRawMaterialUnits() {
  return useQuery<RawMaterialUnitListResponse>({
    queryKey: ['raw-material-units'],
    queryFn: async () => {
      const res = await fetch('/api/store/units');
      return parseJson(res);
    },
    staleTime: 30_000,
  });
}

export function useCreateRawMaterialUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; shortLabel?: string }) => {
      const res = await fetch('/api/store/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return parseJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-units'] });
    },
  });
}

export function useUpdateRawMaterialUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      shortLabel?: string;
      isActive?: boolean;
    }) => {
      const res = await fetch(`/api/store/units/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return parseJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-units'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
    },
  });
}

export function useDeleteRawMaterialUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/units/${id}`, {
        method: 'DELETE',
      });
      return parseJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-units'] });
    },
  });
}
