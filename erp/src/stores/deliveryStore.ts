'use client';

import { create } from 'zustand';

interface DeliveryStore {
  // Filter UI state
  statusFilter: string | null;
  sourceFilter: string | null;
  search: string;
  setStatusFilter: (status: string | null) => void;
  setSourceFilter: (source: string | null) => void;
  setSearch: (search: string) => void;
  resetFilters: () => void;

  // Dialog state
  isCreateOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
}

export const useDeliveryStore = create<DeliveryStore>((set) => ({
  statusFilter: null,
  sourceFilter: null,
  search: '',
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSourceFilter: (source) => set({ sourceFilter: source }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ statusFilter: null, sourceFilter: null, search: '' }),

  isCreateOpen: false,
  openCreate: () => set({ isCreateOpen: true }),
  closeCreate: () => set({ isCreateOpen: false }),
}));
