import { create } from 'zustand';

interface CartStore {
  items: unknown[];
  total: number;
  addItem: (item: unknown) => void;
  removeItem: (item: unknown) => void;
}

export const useCartStore = create<CartStore>(() => ({
  items: [],
  total: 0,
  addItem: () => {},
  removeItem: () => {},
}));
