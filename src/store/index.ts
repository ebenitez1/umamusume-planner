import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUmaSlice, type UmaSlice } from './umaSlice';
import { createRaceSlice, type RaceSlice } from './raceSlice';
import { createSkillSlice, type SkillSlice } from './skillSlice';
import { createBuildSlice, type BuildSlice } from './buildSlice';
import { createUiSlice, type UiSlice } from './uiSlice';

/** The full combined store — one Zustand store, slice pattern. */
export type StoreState = UmaSlice & RaceSlice & SkillSlice & BuildSlice & UiSlice;

/**
 * Persisted subset. Excludes:
 *  - optimizerResult (derived; recomputed on demand)
 *  - all uiSlice state (activeTab, toasts, saveModalOpen)
 */
const PERSISTED_KEYS = [
  'uma',
  'race',
  'aptitudes',
  'spBudget',
  'fastLearner',
  'officialOnly',
  'weights',
  'selectedSkillIds',
  'costOverrides',
  'builds',
  'currentBuildId',
] as const;

type PersistedKey = (typeof PERSISTED_KEYS)[number];
type PersistedState = Pick<StoreState, PersistedKey>;

export const useStore = create<StoreState>()(
  persist(
    (...args) => ({
      ...createUmaSlice(...args),
      ...createRaceSlice(...args),
      ...createSkillSlice(...args),
      ...createBuildSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: 'uma-planner-v2',
      partialize: (state): PersistedState =>
        Object.fromEntries(
          PERSISTED_KEYS.map((key) => [key, state[key]]),
        ) as unknown as PersistedState,
    },
  ),
);

// Re-export slice interfaces for consumers.
export type { UmaSlice, RaceSlice, SkillSlice, BuildSlice, UiSlice };
