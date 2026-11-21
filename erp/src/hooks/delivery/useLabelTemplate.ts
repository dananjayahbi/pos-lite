'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  DeliveryLabelTemplate,
  LabelBranding,
} from '@/types/delivery-label';
import type { LabelTemplateInput } from '@/lib/validators/label.validators';

interface LabelTemplatePayload {
  template: DeliveryLabelTemplate;
  branding: LabelBranding;
  saved: boolean;
}

/**
 * Waybill template + tenant branding (ARGUS #298).
 *
 * The GET response carries both so a print surface can wait for one load and
 * then merge `template` with `branding` when the saved sender fields are empty.
 * A failed read stays an explicit `isError` instead of silently looking like an
 * empty default template.
 */
export function useLabelTemplate() {
  const queryClient = useQueryClient();

  const query = useQuery<LabelTemplatePayload>({
    queryKey: ['label-template'],
    queryFn: async () => {
      const res = await fetch('/api/store/delivery/label');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch label template');
      return {
        template: json.data as DeliveryLabelTemplate,
        branding: (json.meta?.branding ?? {
          name: '',
          address: '',
          phoneNumber: '',
        }) as LabelBranding,
        saved: Boolean(json.meta?.saved),
      };
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
    onSuccess: (template) => {
      queryClient.setQueryData<LabelTemplatePayload>(['label-template'], (old) =>
        old ? { ...old, template, saved: true } : old,
      );
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
    onSuccess: (template) => {
      queryClient.setQueryData<LabelTemplatePayload>(['label-template'], (old) =>
        old ? { ...old, template, saved: false } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['label-template'] });
      toast.success('Label template reset to default');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    data: query.data?.template,
    branding: query.data?.branding ?? null,
    saved: query.data?.saved ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
    save,
    reset,
  };
}
