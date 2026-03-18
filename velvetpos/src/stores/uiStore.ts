import { create } from 'zustand';

interface UIStore {
  isSidebarOpen: boolean;
  activeModal: string | null;
  isScreenLocked: boolean;
  setSidebarOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  lockScreen: () => void;
  unlockScreen: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSidebarOpen: true,
  activeModal: null,
  isScreenLocked: false,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  lockScreen: () => set({ isScreenLocked: true }),
  unlockScreen: () => set({ isScreenLocked: false }),
}));
