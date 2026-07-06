import type { StateCreator } from 'zustand';
import type { TabId, Toast, ToastKind } from '../types';
import type { StoreState } from './index';

export interface UiSlice {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  /** Transient notifications; Toaster auto-dismisses after ~3s. */
  toasts: Toast[];
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
  /** Shared "Save Build" modal open state (Ctrl+S targets this). */
  saveModalOpen: boolean;
  setSaveModalOpen: (open: boolean) => void;
}

let nextToastId = 1;

export const createUiSlice: StateCreator<
  StoreState,
  [['zustand/persist', unknown]],
  [],
  UiSlice
> = (set) => ({
  activeTab: 'optimizer',
  setActiveTab: (activeTab) => set({ activeTab }),
  toasts: [],
  pushToast: (message, kind = 'info') =>
    set((state) => ({
      toasts: [...state.toasts, { id: nextToastId++, message, kind }],
    })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  saveModalOpen: false,
  setSaveModalOpen: (saveModalOpen) => set({ saveModalOpen }),
});
