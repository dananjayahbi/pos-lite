'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function usePackaging() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['packaging'],
    queryFn: async () => {
      const res = await fetch('/api/store/packaging');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch packaging');
      return json.data;
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
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to create packaging item');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      toast.success('Packaging item created');
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
        body: JSON.stringify({ delta, note }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to adjust stock');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      toast.success('Stock adjusted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, create, adjust };
}
