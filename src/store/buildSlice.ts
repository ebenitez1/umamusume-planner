import type { StateCreator } from 'zustand';
import type { Build } from '../types';
import type { StoreState } from './index';

export interface BuildSlice {
  builds: Build[];
  /** Id of the loaded/last-saved build, or null when working unsaved. */
  currentBuildId: string | null;

  /**
   * Snapshot the current uma/aptitudes/race/skills/budget into a NEW build,
   * append it, make it current, and return it.
   */
  saveBuild: (name: string) => Build;
  /**
   * Re-snapshot current state into an EXISTING build (keeps name/createdAt).
   * Returns the updated build, or null if the id is unknown.
   */
  updateBuild: (id: string) => Build | null;
  /** Write a saved build's snapshot back into the uma/race/skill slices. */
  loadBuild: (id: string) => void;
  deleteBuild: (id: string) => void;
  setCurrentBuild: (id: string | null) => void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Capture the cross-slice state that constitutes a build. */
function snapshot(state: StoreState): Omit<Build, 'id' | 'name' | 'createdAt'> {
  return {
    uma: structuredClone(state.uma),
    aptitudes: structuredClone(state.aptitudes),
    race: structuredClone(state.race),
    skillIds: [...state.selectedSkillIds],
    costOverrides: { ...state.costOverrides },
    spBudget: state.spBudget,
  };
}

export const createBuildSlice: StateCreator<
  StoreState,
  [['zustand/persist', unknown]],
  [],
  BuildSlice
> = (set, get) => ({
  builds: [],
  currentBuildId: null,

  saveBuild: (name) => {
    const build: Build = {
      id: makeId(),
      name: name.trim() || 'Untitled Build',
      createdAt: Date.now(),
      ...snapshot(get()),
    };
    set((state) => ({ builds: [...state.builds, build], currentBuildId: build.id }));
    return build;
  },

  updateBuild: (id) => {
    const existing = get().builds.find((b) => b.id === id);
    if (!existing) return null;
    const updated: Build = { ...existing, ...snapshot(get()) };
    set((state) => ({
      builds: state.builds.map((b) => (b.id === id ? updated : b)),
      currentBuildId: id,
    }));
    return updated;
  },

  loadBuild: (id) => {
    const build = get().builds.find((b) => b.id === id);
    if (!build) return;
    set({
      uma: structuredClone(build.uma),
      aptitudes: structuredClone(build.aptitudes),
      race: structuredClone(build.race),
      selectedSkillIds: [...build.skillIds],
      costOverrides: { ...build.costOverrides },
      spBudget: build.spBudget,
      optimizerResult: null,
      currentBuildId: build.id,
    });
  },

  deleteBuild: (id) =>
    set((state) => ({
      builds: state.builds.filter((b) => b.id !== id),
      currentBuildId: state.currentBuildId === id ? null : state.currentBuildId,
    })),

  setCurrentBuild: (currentBuildId) => set({ currentBuildId }),
});
