'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface DispatchShortfallItem {
  name: string;
  requiredUnits: number;
  availableUnits: number;
}

/** Typed dispatch failure so the sheet can offer the shortfall override. */
export class DispatchRequestError extends Error {
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'DispatchRequestError';
    this.code = code;
    this.details = details;
  }
}

export interface DispatchDeliveryPayload {
  waybillMode: string;
  manualWaybillId?: string | undefined;
  allowPackagingShortfall?: boolean | undefined;
  /** ARGUS #283: explicit packaging selection; `[]` consumes none. */
  packagingItemIds?: string[] | undefined;
}

export function useDispatchDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DispatchDeliveryPayload }) => {
      const res = await fetch(`/api/store/deliveries/${id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        throw new DispatchRequestError(
          json.error?.message ?? 'Failed to dispatch delivery',
          json.error?.code,
          json.error?.details,
        );
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      // A dispatch writes packaging consumption rows too (ARGUS #281 history).
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
      queryClient.invalidateQueries({ queryKey: ['packaging-history'] });
      toast.success('Delivery dispatched');
    },
    onError: (error: Error) => {
      // The shortfall prompt is rendered inline by the sheet (ARGUS #282).
      if (error instanceof DispatchRequestError && error.code === 'PACKAGING_SHORTFALL') {
        return;
      }
      toast.error(error.message);
    },
  });
}
