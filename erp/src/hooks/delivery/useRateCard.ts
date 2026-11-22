'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  EMPTY_RATE_CARD_META,
  type RateCardMeta,
} from '@/lib/delivery/rateCardMeta.core';

interface RateCardResponse {
  success?: boolean;
  data?: unknown;
  error?: { message?: string };
  meta?: { rateCardMeta?: RateCardMeta };
}

export function useRateCard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ratecard'],
    queryFn: async () => {
      const res = await fetch('/api/store/delivery/ratecard');
      const json = (await res.json().catch(() => null)) as RateCardResponse | null;

      // ARGUS #289: the API intentionally returns `200 { data: null }` when a
      // tenant has no card. A 404 therefore means the route/deployment is
      // broken, not "create your first card" — surface it as a load error.
      if (res.status === 404) {
        throw new Error('Rate card service was not found. Retry or contact support.');
      }
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to fetch rate card');
      }
      return {
        card: json.data ?? null,
        meta: json.meta?.rateCardMeta ?? EMPTY_RATE_CARD_META,
      };
    },
    // One retry smooths a transient blip without hiding a hard failure behind
    // a long retry backoff; the page also offers an explicit Retry.
    retry: 1,
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
      toast.success('Zone overrides saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    data: query.data?.card ?? null,
    meta: query.data?.meta ?? EMPTY_RATE_CARD_META,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
    save,
    saveEntries,
  };
}
