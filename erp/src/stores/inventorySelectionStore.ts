import { create } from 'zustand';

interface InventorySelectionState {
  selectedProductIds: Set<string>;
  toggleProduct: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useInventorySelectionStore = create<InventorySelectionState>((set, get) => ({
  selectedProductIds: new Set(),
  toggleProduct: (id) =>
    set((state) => {
      const next = new Set(state.selectedProductIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedProductIds: next };
    }),
  selectAll: (ids) =>
    set((state) => {
      const allSelected = ids.every((id) => state.selectedProductIds.has(id));
      if (allSelected) return { selectedProductIds: new Set() };
      return { selectedProductIds: new Set(ids) };
    }),
  clearSelection: () => set({ selectedProductIds: new Set() }),
  isSelected: (id) => get().selectedProductIds.has(id),
}));
