import { create } from 'zustand';

interface OfflineStore {
  queue: unknown[];
  isOnline: boolean;
  enqueue: (item: unknown) => void;
  processQueue: () => void;
}

export const useOfflineStore = create<OfflineStore>(() => ({
  queue: [],
  isOnline: true,
  enqueue: () => {},
  processQueue: () => {},
}));
