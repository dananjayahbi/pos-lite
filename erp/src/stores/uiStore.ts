import { create } from 'zustand';

interface UIStore {
  isSidebarOpen: boolean;
  activeModal: string | null;
  setSidebarOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSidebarOpen: true,
  activeModal: null,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
}));
