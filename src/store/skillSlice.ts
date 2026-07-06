import type { StateCreator } from 'zustand';
import type { OptimizerResult } from '../types';
import type { StoreState } from './index';

export interface SkillWeights {
  /** Percent 0..100. consistency + costEfficiency always sums to 100. */
  consistency: number;
  costEfficiency: number;
}

export interface SkillSlice {
  /** Total SP available to spend. */
  spBudget: number;
  /** Fast Learner unique support effect: −10% on all SP costs. */
  fastLearner: boolean;
  /** Restrict the pool to skills released in the Global (EN) client. */
  officialOnly: boolean;
  weights: SkillWeights;
  /** Skills the user has added to the working build (SkillEntry ids). */
  selectedSkillIds: number[];
  /** Per-skill SP cost overrides (hint discounts etc). Key = skill id. */
  costOverrides: Record<number, number>;
  /** Last optimizer run output. NOT persisted — recomputed on demand. */
  optimizerResult: OptimizerResult | null;

  setSpBudget: (value: number) => void;
  setFastLearner: (value: boolean) => void;
  setOfficialOnly: (value: boolean) => void;
  /**
   * Set the consistency weight (0..100); costEfficiency is derived as
   * 100 − consistency so the pair always sums to 100.
   */
  setWeights: (consistency: number) => void;
  addSkill: (id: number) => void;
  removeSkill: (id: number) => void;
  /** Replace the selection wholesale (loadBuild / share-url / Add All). */
  setSelectedSkillIds: (ids: number[]) => void;
  /** Override a skill's SP cost; pass null to clear the override. */
  setCostOverride: (id: number, cost: number | null) => void;
  /** Replace all overrides (loadBuild / share-url restore). */
  setCostOverrides: (overrides: Record<number, number>) => void;
  setOptimizerResult: (result: OptimizerResult | null) => void;
}

export const createSkillSlice: StateCreator<
  StoreState,
  [['zustand/persist', unknown]],
  [],
  SkillSlice
> = (set) => ({
  spBudget: 600,
  fastLearner: false,
  officialOnly: false,
  weights: { consistency: 60, costEfficiency: 40 },
  selectedSkillIds: [],
  costOverrides: {},
  optimizerResult: null,

  setSpBudget: (spBudget) => set({ spBudget }),
  setFastLearner: (fastLearner) => set({ fastLearner }),
  setOfficialOnly: (officialOnly) => set({ officialOnly }),
  setWeights: (consistency) => {
    const c = Math.max(0, Math.min(100, Math.round(consistency)));
    set({ weights: { consistency: c, costEfficiency: 100 - c } });
  },
  addSkill: (id) =>
    set((state) =>
      state.selectedSkillIds.includes(id)
        ? state
        : { selectedSkillIds: [...state.selectedSkillIds, id] },
    ),
  removeSkill: (id) =>
    set((state) => ({
      selectedSkillIds: state.selectedSkillIds.filter((s) => s !== id),
    })),
  setSelectedSkillIds: (selectedSkillIds) => set({ selectedSkillIds }),
  setCostOverride: (id, cost) =>
    set((state) => {
      const costOverrides = { ...state.costOverrides };
      if (cost === null) delete costOverrides[id];
      else costOverrides[id] = cost;
      return { costOverrides };
    }),
  setCostOverrides: (costOverrides) => set({ costOverrides }),
  setOptimizerResult: (optimizerResult) => set({ optimizerResult }),
});
