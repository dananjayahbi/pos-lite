'use client';

import { useQuery } from '@tanstack/react-query';

export interface StockTakeItemVariant {
  sku: string;
  barcode: string | null;
  size: string | null;
  colour: string | null;
  product: {
    name: string;
    category: { name: string };
  };
}

export interface StockTakeItemDetail {
  id: string;
  sessionId: string;
  variantId: string;
  systemQuantity: number;
  countedQuantity: number | null;
  discrepancy: number | null;
  isRecounted: boolean;
  createdAt: string;
  updatedAt: string;
  variant: StockTakeItemVariant;
}

export interface StockTakeSessionDetail {
  id: string;
  tenantId: string;
  categoryId: string | null;
  status: string;
  initiatedById: string;
  initiatedBy: { email: string };
  approvedById: string | null;
  approvedBy: { email: string } | null;
  startedAt: string;
  completedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  items: StockTakeItemDetail[];
}

export function useStockTakeSession(sessionId: string) {
  return useQuery<{ success: boolean; data: StockTakeSessionDetail }>({
    queryKey: ['stock-take-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/store/stock-control/stock-takes/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch stock take session');
      return res.json();
    },
    staleTime: 15_000,
  });
}
