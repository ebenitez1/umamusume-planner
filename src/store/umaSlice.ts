import type { StateCreator } from 'zustand';
import type { UmaConfig, StatKey } from '../types';
import type { StoreState } from './index';

export interface UmaSlice {
  /** The shared uma being planned — synced across all tabs. */
  uma: UmaConfig;
  /** Set one of the five stats (clamped to 0..2500 by consumers as needed). */
  setStat: (key: StatKey, value: number) => void;
  setStarLevel: (star: UmaConfig['starLevel']) => void;
  setUniqueLevel: (level: UmaConfig['uniqueLevel']) => void;
  /** Replace the whole uma config (used by loadBuild / share-url restore). */
  setUma: (uma: UmaConfig) => void;
}

export const DEFAULT_UMA: UmaConfig = {
  stats: { speed: 600, stamina: 600, power: 600, guts: 600, wisdom: 600 },
  starLevel: 3,
  uniqueLevel: 2,
};

export const createUmaSlice: StateCreator<
  StoreState,
  [['zustand/persist', unknown]],
  [],
  UmaSlice
> = (set) => ({
  uma: DEFAULT_UMA,
  setStat: (key, value) =>
    set((state) => ({
      uma: { ...state.uma, stats: { ...state.uma.stats, [key]: value } },
    })),
  setStarLevel: (starLevel) => set((state) => ({ uma: { ...state.uma, starLevel } })),
  setUniqueLevel: (uniqueLevel) => set((state) => ({ uma: { ...state.uma, uniqueLevel } })),
  setUma: (uma) => set({ uma }),
});
