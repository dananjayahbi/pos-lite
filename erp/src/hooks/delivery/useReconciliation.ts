'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useReconciliation() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['reconciliation'],
    queryFn: async () => {
      const res = await fetch('/api/store/reconciliation');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch reconciliation');
      return json.data;
    },
    staleTime: 30_000,
  });

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/store/reconciliation/import', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to import statement');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      toast.success('Remittance statement imported');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, importCsv };
}
