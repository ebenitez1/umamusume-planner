/**
 * Shared type contract for Uma Planner v2.
 * This file is FROZEN — module agents consume these names/shapes as-is.
 * Any additions must be documented in ARCHITECTURE.md.
 */

/** Aptitude letter grades, best to worst. */
export type AptitudeGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type Surface = 'turf' | 'dirt';

export type DistanceClass = 'sprint' | 'mile' | 'medium' | 'long';

/** Running style: Front Runner / Pace Chaser / Late Surger / End Closer. */
export type Strategy = 'front' | 'pace' | 'late' | 'end';

/** Race phases (opening 0–1/6, middle 1/6–2/3, final 2/3–5/6, spurt 5/6–1). */
export type RacePhase = 'opening' | 'middle' | 'final' | 'spurt';

/** Terrain features referenced by skill activation conditions. */
export type TerrainTag = 'corner' | 'straight' | 'slope';

/** The five core stats. */
export interface UmaStats {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
}

export type StatKey = keyof UmaStats;

/** The trained uma being planned: stats + rarity + unique skill level. */
export interface UmaConfig {
  stats: UmaStats;
  starLevel: 1 | 2 | 3 | 4 | 5;
  uniqueLevel: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Aptitude grades for track surface, distance class, and strategy. */
export interface AptitudeSet {
  track: Record<Surface, AptitudeGrade>;
  distance: Record<DistanceClass, AptitudeGrade>;
  strategy: Record<Strategy, AptitudeGrade>;
}

/** The race being planned/simulated. */
export interface RaceConfig {
  surface: Surface;
  distanceClass: DistanceClass;
  strategy: Strategy;
  /** Number of runners in the field (including the player's uma). */
  fieldSize: number;
}

/** Skill rarity color as shown in-game. */
export type SkillColor = 'white' | 'gold' | 'pink' | 'green' | 'blue' | 'red';

export type SkillType =
  | 'speed'
  | 'stamina'
  | 'power'
  | 'guts'
  | 'wisdom'
  | 'recovery'
  | 'passive'
  | 'debuff'
  | 'unique';

/** Aptitude/condition tags decoded from the skill database's type tags. */
export interface SkillAptitudeTags {
  surface?: Surface[];
  distance?: DistanceClass[];
  strategy?: Strategy[];
  phase?: RacePhase[];
  terrain?: TerrainTag[];
}

/** One skill in the static database (src/data/skills.ts, generated). */
export interface SkillEntry {
  id: number;
  name: string;
  description?: string;
  /** Base SP cost (hint level 0). UI/state may override per-skill. */
  spCost: number;
  type: SkillType;
  color: SkillColor;
  /** Base skill value — activation worth used by the optimizer. */
  sv: number;
  /** Heuristic expected activations per race (0..1 for once-per-race skills). */
  expectedActivations: number;
  /** Raw activation condition string from the game data, if known. */
  conditionRaw?: string;
  aptitudeTags: SkillAptitudeTags;
  /** False for inherent uniques (rarity 6) that cannot be bought with SP. */
  purchasable: boolean;
  /**
   * True when the skill exists in the Global (EN) client — i.e. the source
   * data carries official Global text. Drives the "Official EN Skills Only"
   * toggle. (Documented addition to the frozen contract; see ARCHITECTURE.md.)
   */
  official: boolean;
}

/** A skill after optimizer scoring. */
export interface RankedSkill {
  skill: SkillEntry;
  /** Final composite score (weighted consistency + cost efficiency). */
  score: number;
  /** 0..1 — how reliably the skill activates given the race config. */
  consistency: number;
  /** 0..1 normalized SV-per-SP measure. */
  costEfficiency: number;
  /** Raw sv / effectiveCost. */
  svPerSp: number;
  /** SP cost after overrides and Fast Learner discount. */
  effectiveCost: number;
}

/** Aggregate numbers shown in the optimizer's Summary panel. */
export interface OptimizerSummary {
  bestScore: number;
  usedPoints: number;
  totalPoints: number;
  remaining: number;
  consistencyPct: number;
  expectedValue: number;
  totalSv: number;
  expectedActivations: number;
  svPerSp: number;
  skillDensity: number;
  estActivationScore: number;
  aptitudeTestScore: number;
}

export interface OptimizerResult {
  /** Every candidate skill, ranked best-first. */
  ranked: RankedSkill[];
  /** The chosen subset that fits the SP budget. */
  picked: RankedSkill[];
  summary: OptimizerSummary;
  explain: {
    strengths: string[];
    risks: string[];
    warnings: string[];
  };
}

/** A saved build snapshot (persisted to localStorage; shareable via URL). */
export interface Build {
  id: string;
  name: string;
  createdAt: number;
  uma: UmaConfig;
  aptitudes: AptitudeSet;
  race: RaceConfig;
  skillIds: number[];
  costOverrides: Record<number, number>;
  spBudget: number;
}

/** Output of the rating calculator. */
export interface RatingResult {
  total: number;
  tier: string;
  toNextTier: number;
  nextTier: string;
  breakdown: {
    stats: number;
    skills: number;
    unique: number;
  };
}

/** Output of one Monte Carlo simulation batch. */
export interface SimulationOutcome {
  winPct: number;
  top3Pct: number;
  meanFinishS: number;
  /** Index i = probability (0..1) of finishing in place i+1; length = fieldSize. */
  placementDistribution: number[];
  /** HP remaining at the finish line as a % of the pool (negative = gassed out). */
  staminaMarginPct: number;
  warnings: string[];
  recommendations: string[];
}

/** Toast notification (uiSlice). */
export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export type TabId = 'simulator' | 'optimizer' | 'builds';
