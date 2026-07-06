/**
 * Race/course constants — hand-authored from FORMULAS.md.
 * Everything here is shared by the optimizer, rating panel, and simulator.
 */
import type {
  AptitudeGrade,
  DistanceClass,
  RacePhase,
  Strategy,
  Surface,
  UmaStats,
} from '../types';

// ---------------------------------------------------------------------------
// Distance classes
// ---------------------------------------------------------------------------

export interface DistanceClassInfo {
  class: DistanceClass;
  label: string;
  /** Inclusive meter range for the class (game rule). */
  minMeters: number;
  maxMeters: number;
  /** Representative distance used when only a class (not a course) is chosen. */
  typicalMeters: number;
  /**
   * Recommended stat targets for competitive (Champion's Meeting-grade) play.
   * HEURISTIC meta values, not game constants — tune freely.
   */
  recommendedStats: UmaStats;
}

export const DISTANCE_CLASSES: Record<DistanceClass, DistanceClassInfo> = {
  sprint: {
    class: 'sprint',
    label: 'Sprint',
    minMeters: 1000,
    maxMeters: 1399,
    typicalMeters: 1200,
    recommendedStats: { speed: 1100, stamina: 400, power: 900, guts: 400, wisdom: 600 },
  },
  mile: {
    class: 'mile',
    label: 'Mile',
    minMeters: 1400,
    maxMeters: 1799,
    typicalMeters: 1600,
    recommendedStats: { speed: 1100, stamina: 600, power: 900, guts: 400, wisdom: 600 },
  },
  medium: {
    class: 'medium',
    label: 'Medium',
    minMeters: 1800,
    maxMeters: 2400,
    typicalMeters: 2000,
    recommendedStats: { speed: 1050, stamina: 750, power: 850, guts: 450, wisdom: 600 },
  },
  long: {
    class: 'long',
    label: 'Long',
    minMeters: 2401,
    maxMeters: 3600,
    typicalMeters: 3000,
    recommendedStats: { speed: 1000, stamina: 900, power: 800, guts: 500, wisdom: 600 },
  },
};

export const DISTANCE_CLASS_ORDER: DistanceClass[] = ['sprint', 'mile', 'medium', 'long'];

/** Classify a course distance in meters (sprint <1400, mile <1800, medium ≤2400, long >2400). */
export function distanceClassFor(meters: number): DistanceClass {
  if (meters < 1400) return 'sprint';
  if (meters < 1800) return 'mile';
  if (meters <= 2400) return 'medium';
  return 'long';
}

// ---------------------------------------------------------------------------
// Strategies (running styles)
// ---------------------------------------------------------------------------

export interface StrategyInfo {
  strategy: Strategy;
  label: string;
  /**
   * Target-velocity multiplier per phase [opening, middle, final]
   * (RaceSolver style coefficients; last-spurt uses the final value).
   */
  velocityByPhase: [number, number, number];
  /** HP-pool multiplier for the style. */
  hpCoefficient: number;
}

export const STRATEGIES: Record<Strategy, StrategyInfo> = {
  front: {
    strategy: 'front',
    label: 'Front Runner',
    velocityByPhase: [1.0, 0.98, 0.962],
    hpCoefficient: 0.95,
  },
  pace: {
    strategy: 'pace',
    label: 'Pace Chaser',
    velocityByPhase: [0.978, 0.991, 0.975],
    hpCoefficient: 0.89,
  },
  late: {
    strategy: 'late',
    label: 'Late Surger',
    velocityByPhase: [0.938, 0.998, 0.994],
    hpCoefficient: 1.0,
  },
  end: {
    strategy: 'end',
    label: 'End Closer',
    velocityByPhase: [0.931, 1.0, 1.0],
    hpCoefficient: 0.995,
  },
};

export const STRATEGY_ORDER: Strategy[] = ['front', 'pace', 'late', 'end'];

export const SURFACE_LABELS: Record<Surface, string> = { turf: 'Turf', dirt: 'Dirt' };

// ---------------------------------------------------------------------------
// Speed / phase math (FORMULAS.md "Race/course constants")
// ---------------------------------------------------------------------------

/** Course reference speed in m/s: 20 − (distance − 2000)/1000. */
export function baseSpeed(distanceMeters: number): number {
  return 20 - (distanceMeters - 2000) / 1000;
}

/** Minimum velocity floor: 0.85 × baseSpeed + √(200 × guts) × 0.001. */
export function minSpeed(distanceMeters: number, guts: number): number {
  return 0.85 * baseSpeed(distanceMeters) + Math.sqrt(200 * guts) * 0.001;
}

/**
 * Race phases as distance fractions:
 * opening 0–1/6, middle 1/6–2/3, final 2/3–5/6, last spurt 5/6–1.
 * (The game internally models races in 12 sections; opening = sections 1–2,
 * middle = 3–8, final = 9–10, spurt = 11–12.)
 */
export const PHASE_BOUNDS: Record<RacePhase, { start: number; end: number }> = {
  opening: { start: 0, end: 1 / 6 },
  middle: { start: 1 / 6, end: 2 / 3 },
  final: { start: 2 / 3, end: 5 / 6 },
  spurt: { start: 5 / 6, end: 1 },
};

export function phaseAt(distanceFraction: number): RacePhase {
  if (distanceFraction < 1 / 6) return 'opening';
  if (distanceFraction < 2 / 3) return 'middle';
  if (distanceFraction < 5 / 6) return 'final';
  return 'spurt';
}

// ---------------------------------------------------------------------------
// Aptitude grade buckets (affect skill consistency, NOT rating totals)
// ---------------------------------------------------------------------------

/** good S/A ×1.1, average B/C ×0.9, bad D/E/F ×0.8, terrible G ×0.7. */
export const APTITUDE_CONSISTENCY_MULT: Record<AptitudeGrade, number> = {
  S: 1.1,
  A: 1.1,
  B: 0.9,
  C: 0.9,
  D: 0.8,
  E: 0.8,
  F: 0.8,
  G: 0.7,
};

export const APTITUDE_GRADES: AptitudeGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

/** Left-handed venues; all other JP venues are right-handed (rotation==1). */
export const LEFT_HANDED_VENUES = ['Tokyo', 'Niigata', 'Chukyo', 'Longchamp'] as const;

// ---------------------------------------------------------------------------
// Field size
// ---------------------------------------------------------------------------

export const FIELD_SIZE_MIN = 2;
export const FIELD_SIZE_MAX = 18;
export const FIELD_SIZE_DEFAULT = 9;

// ---------------------------------------------------------------------------
// Champion Meeting history (Global) — user-supplied
// ---------------------------------------------------------------------------

export interface ChampionMeeting {
  cm: number;
  race: string;
  surface: Surface;
  distanceMeters: number;
  distanceClass: DistanceClass;
}

export const CM_HISTORY: ChampionMeeting[] = [
  { cm: 1, race: 'Japanese Oaks', surface: 'turf', distanceMeters: 2400, distanceClass: 'medium' },
  { cm: 2, race: 'Tenno Sho (Spring)', surface: 'turf', distanceMeters: 3200, distanceClass: 'long' },
  { cm: 3, race: 'NHK Mile Cup', surface: 'turf', distanceMeters: 1600, distanceClass: 'mile' },
  { cm: 4, race: 'Takarazuka Kinen', surface: 'turf', distanceMeters: 2200, distanceClass: 'medium' },
  { cm: 5, race: 'Oka Sho', surface: 'turf', distanceMeters: 1600, distanceClass: 'mile' },
  { cm: 6, race: 'Kikuka Sho', surface: 'turf', distanceMeters: 3000, distanceClass: 'long' },
  { cm: 7, race: 'Tenno Sho (Autumn)', surface: 'turf', distanceMeters: 2000, distanceClass: 'medium' },
  { cm: 8, race: 'Arima Kinen', surface: 'turf', distanceMeters: 2500, distanceClass: 'long' },
  { cm: 9, race: 'Takamatsunomiya Kinen', surface: 'turf', distanceMeters: 1200, distanceClass: 'sprint' },
  { cm: 10, race: 'February Stakes', surface: 'dirt', distanceMeters: 1600, distanceClass: 'mile' },
  { cm: 11, race: 'Tenno Sho (Spring)', surface: 'turf', distanceMeters: 3200, distanceClass: 'long' },
  { cm: 12, race: 'Satsuki Sho', surface: 'turf', distanceMeters: 2000, distanceClass: 'medium' },
  { cm: 13, race: 'Japanese Oaks', surface: 'turf', distanceMeters: 2400, distanceClass: 'medium' },
  { cm: 14, race: 'NHK Mile Cup', surface: 'turf', distanceMeters: 1600, distanceClass: 'mile' },
];
