// Race simulator data model + tuning constants.
//
// Formulas and constants are derived from FORMULAS.md (extracted from
// reading uma-skill-tools GPLv3; values are facts about how the game works
// and are independently implemented here).

import type { AptitudeGrade, ChampionMeeting, Skill, Stats, Style } from "../../types";

// ---------------------------------------------------------------------------
// In-game enum mappings (decoded from condition variable values)
// ---------------------------------------------------------------------------

// running_style — condition vars use 1-4
export const STYLE_NUM: Record<Style, number> = {
  runner: 1,
  early: 2,
  late: 3,
  end: 4,
};

// phase — opening / middle / final / last_spurt
export type PhaseNum = 0 | 1 | 2 | 3;
export const PHASE_BOUNDS = [0, 1 / 6, 2 / 3, 5 / 6] as const;

// distance_type — sprint/mile/medium/long
export const DISTANCE_TYPE_NUM: Record<"sprint" | "mile" | "medium" | "long", number> = {
  sprint: 1,
  mile: 2,
  medium: 3,
  long: 4,
};

export const GROUND_TYPE_NUM: Record<"turf" | "dirt", number> = {
  turf: 1,
  dirt: 2,
};

// Aptitude grade → multiplier. Matches in-game table for surface/distance
// (style uses the same numeric scale). G is severely punishing (0.1×).
export const APTITUDE_MULT: Record<AptitudeGrade, number> = {
  S: 1.05,
  A: 1.00,
  B: 0.90,
  C: 0.80,
  D: 0.60,
  E: 0.40,
  F: 0.20,
  G: 0.10,
};

// Per-style velocity multiplier per phase (0/1/2). Phase 3 (last spurt) is
// handled separately by the spurt calculator.
export const STRAT_VEL_COEF: Record<Style, [number, number, number]> = {
  runner: [1.000, 0.980, 0.962],   // Nige
  early:  [0.978, 0.991, 0.975],   // Senkou
  late:   [0.938, 0.998, 0.994],   // Sasi
  end:    [0.931, 1.000, 1.000],   // Oikomi
};

// Per-style acceleration multiplier per phase (0/1/2).
export const STRAT_ACCEL_COEF: Record<Style, [number, number, number]> = {
  runner: [1.000, 1.000, 0.996],
  early:  [0.985, 1.000, 0.996],
  late:   [0.975, 1.000, 1.000],
  end:    [0.945, 1.000, 0.997],
};

// HP pool strategy coefficient. Pace chasers (Sasi/late) get the full 1.0;
// runners burn HP harder (0.95 × stamina pool); Oonige (escape) lowest at 0.86
// — we don't model Oonige separately, treat it as runner.
export const HP_STRAT_COEF: Record<Style, number> = {
  runner: 0.95,
  early:  0.89,
  late:   1.00,
  end:    0.995,
};

// Deceleration per phase (used when current velocity > target). Pace-down
// state uses -0.5 instead — we don't model pace-down in single-uma mode.
export const DECEL_PER_PHASE: [number, number, number, number] = [-1.2, -0.8, -1.0, -1.0];

// ---------------------------------------------------------------------------
// Per-uma state
// ---------------------------------------------------------------------------

export interface UmaSimState {
  id: string;
  name: string;
  isPlayer: boolean;

  stats: Stats;
  style: Style;
  styleNum: number;
  aptitudes: {
    surface: AptitudeGrade;
    distance: AptitudeGrade;
    style: AptitudeGrade;
  };
  skills: Skill[];

  // mutable state — advanced each tick
  position: number;             // meters from start
  velocity: number;             // m/s
  hp: number;
  hpMax: number;
  order: number;
  finished: boolean;
  finishTime?: number;
  startDashActive: boolean;     // +24 accel bonus until v > 0.85*baseSpeed

  // skill bookkeeping
  cooldowns: Map<string, number>;
  activeEffects: ActiveEffect[];
  activatedSkillIds: Set<string>;
  activationLog: ActivationLog[];

  // race-state tracking for condition vars
  prevOrder: number;
  overtakeTickRemaining: number;
  changeOrderCount: number;

  // per-skill activation diagnostics
  skillDiagnostics: Map<string, SkillDiagnostic>;

  // random rolls captured once per (phase / corner / etc.) bucket
  randomRolls: {
    phase: Record<number, number>;
    phaseFirstHalf: Record<number, number>;
    phaseLaterHalf: Record<number, number>;
    phaseFirstQuarter: Record<number, number>;
    corner: Record<number, number>;
    allCorner: number;
    straight: number;
  };
}

export interface SkillDiagnostic {
  preconditionTrueTicks: number;
  activations: number;
  firstTrueAtS?: number;
}

export interface ActiveEffect {
  source: string;
  // 27 = target speed bump, 31 = accel bump, 9 = heal, others mapped from
  // effect type codes in FORMULAS.md.
  kind: "speed" | "accel" | "heal" | "buff" | "debuff" | "current_speed";
  value: number;
  remainingS: number;
}

export interface ActivationLog {
  tick: number;
  timeS: number;
  positionM: number;            // uma's position (meters) when the skill fired
  skillId: string;
  skillName: string;
  effectKind?: ActiveEffect["kind"];
  effectValue?: number;
}

// ---------------------------------------------------------------------------
// Per-race state
// ---------------------------------------------------------------------------

export interface RaceSimState {
  tick: number;
  timeS: number;
  meeting: ChampionMeeting;
  umas: UmaSimState[];
  course: {
    distance: number;
    surface: "turf" | "dirt";
    finalCornerStart: number;
    finalStraightStart: number;
    baseSpeed: number;          // baked once at race start: 20 - (d-2000)/1000
    // Real corner + slope geometry from kachi-dev course_data.json when
    // available. Empty arrays = fall back to heuristic detection.
    corners: Array<{ start: number; length: number }>;
    slopes: Array<{ start: number; length: number; slope: number }>;
  };
  finished: boolean;
}

// ---------------------------------------------------------------------------
// Physics tuning constants
// ---------------------------------------------------------------------------

export const TICK_S = 1 / 15;             // 15 ticks/sec — matches the game engine

// Base acceleration coefficient. 0.0004 on uphill (slope > 1), 0.0006 normal.
export const BASE_ACCEL = 0.0006;
export const BASE_ACCEL_UPHILL = 0.0004;

// Phase 2+ speed-stat contribution: sqrt(500 * speed) * APT[aptitude] * 0.002
export const SPEED_STAT_CONSTANT = 500;
export const SPEED_STAT_SCALE = 0.002;
// Accel: sqrt(500 * power) * STRAT_ACCEL[style][phase] * APT[surface] * APT[distance]
export const POWER_STAT_CONSTANT = 500;

// HP pool: 0.8 * HP_STRAT[style] * stamina + distance
export const HP_BASE_COEF = 0.8;
// Drain: 20 * (v - baseSpeed + 12)^2 / 144 * mods
export const HP_DRAIN_NUM = 20.0;
export const HP_DRAIN_OFFSET = 12.0;
export const HP_DRAIN_DENOM = 144.0;
// Guts modifier (phase 2+): 1.0 + 200 / sqrt(600 * guts)
export const GUTS_DRAIN_NUM = 200.0;
export const GUTS_DRAIN_CONSTANT = 600;

// Start dash: +24 accel bonus until velocity > 0.85 * baseSpeed
export const START_DASH_ACCEL = 24.0;
export const START_DASH_VELOCITY_FRAC = 0.85;
// Post-start minimum speed: 0.85 * baseSpeed + sqrt(200 * guts) * 0.001
export const POST_START_MIN_VEL_FRAC = 0.85;
export const POST_START_GUTS_CONSTANT = 200;
export const POST_START_GUTS_SCALE = 0.001;

// Spurt search step
export const SPURT_SEARCH_STEP = 0.1;     // m/s granularity
export const SPURT_BUFFER_M = 60;         // 60m safety buffer
// Spurt target adjustment: phase2Target + 0.01*baseSpeed + 1.05 + guts term
export const SPURT_BASESPEED_BOOST = 0.01;
export const SPURT_FLAT_BOOST = 1.05;
export const SPURT_GUTS_NUM = 450;
export const SPURT_GUTS_EXP = 0.597;
export const SPURT_GUTS_SCALE = 0.0001;

// Course segment defaults when races.json doesn't supply fc/fs.
export const DEFAULT_FINAL_CORNER_FRAC = 0.80;
export const DEFAULT_FINAL_STRAIGHT_FRAC = 0.92;

// Safety
export const MAX_TICKS = 3000;
export const BASHIN_M = 2.5;
export const OVERTAKE_FLAG_TICKS = 30;
export const DEFAULT_COOLDOWN_S = 4;

// Region width for sample-policy triggers (deferred — kept here for v3).
export const REGION_WIDTH_M = 10;

// ---------------------------------------------------------------------------
// Per-race baseSpeed — single source of truth.
// ---------------------------------------------------------------------------
export function computeBaseSpeed(distance: number): number {
  return 20.0 - (distance - 2000) / 1000.0;
}
