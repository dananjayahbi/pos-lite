'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useCourierSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['courier-settings'],
    queryFn: async () => {
      const res = await fetch('/api/store/delivery/settings');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch courier settings');
      return json.data;
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/store/delivery/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to save courier settings');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-settings'] });
      toast.success('Courier settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, save };
}
