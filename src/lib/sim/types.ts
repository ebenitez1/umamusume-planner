// Race simulator data model + tuning constants.
//
// Unit conventions:
//   - distance: meters
//   - velocity: m/s  (top-tier umas peak around 22 m/s; final spurt ~25 m/s)
//   - time:     seconds
//   - hp:       arbitrary "stamina pool" units (typical pool ~ 1500-2500)
//
// Constants are first-pass estimates calibrated against community-reported
// finish times. The calibration task (#38) tunes them against real builds.

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
export const PHASE_BOUNDS = [0, 1 / 6, 2 / 3, 5 / 6] as const; // start fractions
// Opening:    0.000 – 0.167
// Middle:     0.167 – 0.667
// Final:      0.667 – 0.833
// LastSpurt:  0.833 – 1.000

// distance_type — sprint/mile/medium/long
export const DISTANCE_TYPE_NUM: Record<"sprint" | "mile" | "medium" | "long", number> = {
  sprint: 1,
  mile: 2,
  medium: 3,
  long: 4,
};

// ground_type — turf=1, dirt=2
export const GROUND_TYPE_NUM: Record<"turf" | "dirt", number> = {
  turf: 1,
  dirt: 2,
};

// Aptitude grade → speed/recovery multiplier. These are stand-in numbers;
// the in-game S-grade gives roughly +5% over A which gives +5% over B, etc.
export const APTITUDE_MULT: Record<AptitudeGrade, number> = {
  S: 1.10,
  A: 1.05,
  B: 1.00,
  C: 0.95,
  D: 0.85,
  E: 0.75,
  F: 0.65,
  G: 0.55,
};

// ---------------------------------------------------------------------------
// Per-uma state
// ---------------------------------------------------------------------------

export interface UmaSimState {
  // identity
  id: string;
  name: string;
  isPlayer: boolean;            // true for the user's planned uma

  // immutable inputs
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
  hp: number;                   // remaining stamina pool
  hpMax: number;
  order: number;                // 1 = lead
  finished: boolean;
  finishTime?: number;          // seconds, set when crossing the line

  // skill bookkeeping
  cooldowns: Map<string, number>;       // skillId → remaining seconds
  activeEffects: ActiveEffect[];        // currently-running effects
  activatedSkillIds: Set<string>;       // for is_used_skill_id checks
  activationLog: ActivationLog[];       // for the UI timeline

  // race-state tracking for condition vars
  prevOrder: number;                    // order at the previous tick (for overtake detection)
  overtakeTickRemaining: number;        // ticks remaining where is_overtake=1
  changeOrderCount: number;             // cumulative passes (this uma overtook someone)

  // per-skill activation diagnostics (player only; left empty for opponents)
  skillDiagnostics: Map<string, SkillDiagnostic>;

  // random rolls captured once per (phase / corner / etc.) bucket
  randomRolls: {
    phase: Record<number, number>;      // phase index → roll value
    phaseFirstHalf: Record<number, number>;
    phaseLaterHalf: Record<number, number>;
    phaseFirstQuarter: Record<number, number>;
    corner: Record<number, number>;
    allCorner: number;
    straight: number;
  };
}

export interface SkillDiagnostic {
  preconditionTrueTicks: number;        // ticks where condition evaluated true
  activations: number;                  // times the skill actually fired
  firstTrueAtS?: number;                // seconds when condition was first true
}

export interface ActiveEffect {
  source: string;               // skill id that produced this effect
  kind: "speed" | "accel" | "heal" | "buff" | "debuff";
  value: number;                // delta in m/s for speed; raw for others
  remainingS: number;           // seconds until effect expires
}

export interface ActivationLog {
  tick: number;
  timeS: number;
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
  // course course shape — derived from meeting + races.json segments
  course: {
    distance: number;           // meters
    surface: "turf" | "dirt";
    finalCornerStart: number;   // meters from start where the final corner begins
    finalStraightStart: number; // meters from start where the final straight begins
  };
  finished: boolean;
}

// ---------------------------------------------------------------------------
// Tuning constants (TODO: calibrate against real game data — task #38)
// ---------------------------------------------------------------------------

export const TICK_S = 1 / 15;   // 15 ticks/second matches the game engine

// Base velocity (m/s) derived from Speed stat at the listed aptitude grades.
// Top-tier uma (~1200 Speed, A aptitudes) should peak ~22 m/s base.
export const BASE_VELOCITY_SCALE = 0.018;  // m/s per Speed stat point

// Phase-specific velocity targets, as a fraction of base velocity.
// Style differentiation: runners push opening hard, end-closers conserve.
export const PHASE_VEL_FRAC: Record<PhaseNum, Record<Style, number>> = {
  0: { runner: 1.00, early: 0.95, late: 0.92, end: 0.90 },   // Opening
  1: { runner: 1.02, early: 1.00, late: 0.98, end: 0.96 },   // Middle
  2: { runner: 1.03, early: 1.05, late: 1.06, end: 1.06 },   // Final
  3: { runner: 1.05, early: 1.07, late: 1.10, end: 1.12 },   // LastSpurt
};

// Acceleration toward target velocity (m/s^2). Scaled by Power.
export const ACCEL_BASE = 0.6;
export const ACCEL_PER_POWER = 0.002;

// HP pool = (Stamina * STAMINA_HP) + (distance * DIST_HP).
// Typical: 800 stamina, 2400m race → ~1640 + 600 = ~2240 hp pool.
export const STAMINA_HP = 2.05;
export const DIST_HP = 0.25;

// HP drain rate (units/sec). Aggressive pace (above base velocity) costs
// more. Wit reduces drain slightly.
export const HP_DRAIN_BASE = 0.55;          // baseline drain at base velocity
export const HP_DRAIN_AGGRESSION = 1.8;     // multiplier on overshoot above base
export const HP_DRAIN_WIT_REDUCTION = 0.0002; // per wit point

// When HP <= 0, uma "stamina out" — velocity caps at 70% of base.
export const STAMINA_OUT_VEL_FRAC = 0.7;

// Course segment defaults — when races.json doesn't supply fc/fs, use these
// fractions of total distance.
export const DEFAULT_FINAL_CORNER_FRAC = 0.80;
export const DEFAULT_FINAL_STRAIGHT_FRAC = 0.92;

// Max tick count safeguard — kill the sim if a race somehow runs forever.
// At 15 ticks/sec, 3000 ticks = 200s, comfortably longer than any race.
export const MAX_TICKS = 3000;

// 1 bashin (horse length) ≈ 2.5 m in Umamusume's internal units.
export const BASHIN_M = 2.5;

// How many ticks `is_overtake` stays = 1 after a uma actually overtakes.
// Real game flags it for ~2 seconds; at 15 ticks/sec that's ~30 ticks.
export const OVERTAKE_FLAG_TICKS = 30;

// Default per-skill cooldown when sim metadata doesn't provide one. Lower =
// more activations per race; calibrate against typical activation counts.
export const DEFAULT_COOLDOWN_S = 4;
