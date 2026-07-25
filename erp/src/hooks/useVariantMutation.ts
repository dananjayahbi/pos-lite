'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UpdateVariantPayload {
  productId: string;
  variantId: string;
  data: Record<string, unknown>;
}

export function useVariantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, variantId, data }: UpdateVariantPayload) => {
      const res = await fetch(
        `/api/store/products/${productId}/variants/${variantId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || 'Failed to update variant');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast.success('Variant updated successfully');
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
