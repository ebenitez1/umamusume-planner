import type { StateCreator } from 'zustand';
import type {
  AptitudeGrade,
  AptitudeSet,
  DistanceClass,
  RaceConfig,
  Strategy,
  Surface,
} from '../types';
import type { StoreState } from './index';

export interface RaceSlice {
  race: RaceConfig;
  aptitudes: AptitudeSet;
  /** Update a single field of the race config. */
  setRaceField: <K extends keyof RaceConfig>(key: K, value: RaceConfig[K]) => void;
  /** Set one aptitude grade, e.g. setAptitude('distance', 'mile', 'S'). */
  setAptitude: (
    group: keyof AptitudeSet,
    key: Surface | DistanceClass | Strategy,
    grade: AptitudeGrade,
  ) => void;
  /** Replace the whole aptitude set (used by loadBuild / share-url restore). */
  setAptitudes: (aptitudes: AptitudeSet) => void;
}

export const DEFAULT_RACE: RaceConfig = {
  surface: 'turf',
  distanceClass: 'medium',
  strategy: 'pace',
  fieldSize: 9,
};

export const DEFAULT_APTITUDES: AptitudeSet = {
  track: { turf: 'A', dirt: 'A' },
  distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
  strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' },
};

export const createRaceSlice: StateCreator<
  StoreState,
  [['zustand/persist', unknown]],
  [],
  RaceSlice
> = (set) => ({
  race: DEFAULT_RACE,
  aptitudes: DEFAULT_APTITUDES,
  setRaceField: (key, value) => set((state) => ({ race: { ...state.race, [key]: value } })),
  setAptitude: (group, key, grade) =>
    set((state) => ({
      aptitudes: {
        ...state.aptitudes,
        [group]: { ...state.aptitudes[group], [key]: grade },
      },
    })),
  setAptitudes: (aptitudes) => set({ aptitudes }),
});
