'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRateCard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ratecard'],
    queryFn: async () => {
      const res = await fetch('/api/store/delivery/ratecard');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch rate card');
      return json.data;
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/store/delivery/ratecard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to save rate card');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratecard'] });
      toast.success('Rate card saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const saveEntries = useMutation({
    mutationFn: async (entries: unknown[]) => {
      const res = await fetch('/api/store/delivery/ratecard/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to save rate entries');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratecard'] });
      toast.success('Rate entries saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, save, saveEntries };
}
