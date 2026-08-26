'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';
import type { LabelTemplateInput } from '@/lib/validators/label.validators';

export function useLabelTemplate() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['label-template'],
    queryFn: async () => {
      const res = await fetch('/api/store/delivery/label');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch label template');
      return json.data as DeliveryLabelTemplate;
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (input: LabelTemplateInput) => {
      const res = await fetch('/api/store/delivery/label', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to save label template');
      return json.data as DeliveryLabelTemplate;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['label-template'], data);
      queryClient.invalidateQueries({ queryKey: ['label-template'] });
      toast.success('Label template saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/delivery/label', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to reset label template');
      return json.data as DeliveryLabelTemplate;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['label-template'], data);
      queryClient.invalidateQueries({ queryKey: ['label-template'] });
      toast.success('Label template reset to default');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, save, reset };
}
