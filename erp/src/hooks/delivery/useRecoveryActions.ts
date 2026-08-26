'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type LoggedAction = 'FOLLOW_UP_CALL' | 'RESCHEDULED';

/** Log a non-destructive recovery action (follow-up call / reschedule). */
export function useLogRecoveryAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      notes,
    }: {
      id: string;
      action: LoggedAction;
      notes?: string | undefined;
    }) => {
      const res = await fetch(`/api/store/deliveries/${id}/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to log recovery action');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      toast.success('Recovery action logged');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/** Redeliver a failed delivery (re-push to courier). */
export function useRedeliverDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { waybillMode: string; manualWaybillId?: string | undefined; notes?: string | undefined };
    }) => {
      const res = await fetch(`/api/store/deliveries/${id}/recovery/redeliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to redeliver delivery');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      toast.success('Delivery redelivered');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/** Permanently cancel a failed delivery (with stock + packaging reversal). */
export function usePermanentCancelDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { reason?: string | undefined; notes?: string | undefined };
    }) => {
      const res = await fetch(`/api/store/deliveries/${id}/recovery/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to cancel delivery');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      toast.success('Delivery permanently cancelled and stock reversed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
