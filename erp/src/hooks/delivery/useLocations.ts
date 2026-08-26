'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useLocations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await fetch('/api/store/delivery/locations');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch locations');
      return json.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/delivery/locations', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to sync locations');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Locations synced');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, sync };
}
