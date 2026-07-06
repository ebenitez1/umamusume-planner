/**
 * Race simulator — simplified 3-phase Monte Carlo model (Agent 5).
 *
 * Per FABLE5_PROMPT.md the model is deliberately simplified, but every
 * constant comes from FORMULAS.md / src/data/races.ts so the behavior tracks
 * Umalator's real output:
 *  - baseSpeed(d) = 20 − (d − 2000)/1000
 *  - style velocity coefficients per phase + style HP-pool coefficients
 *  - HP pool = distance + 0.8 × hpCoef × stamina; drain 20(v − base + 12)²/144,
 *    ×1.65 gross during the last spurt
 *  - Wit activation roll P = max(100 − 9000/wit, 20)/100
 *  - aptitude buckets S/A ×1.1, B/C ×0.9, D/E/F ×0.8, G ×0.7
 *
 * Phases (three conceptual phases; the final one covers final leg + spurt):
 *  1. opening (0–1/6): wisdom gate response + power positioning
 *  2. middle (1/6–2/3): speed × strategy coefficient × aptitude bucket
 *  3. final (2/3–1): guts + remaining stamina vs distance drain
 */
import type {
  AptitudeSet,
  RaceConfig,
  SimulationOutcome,
  SkillEntry,
  Strategy,
  UmaConfig,
  UmaStats,
} from '../types';
import {
  APTITUDE_CONSISTENCY_MULT,
  DISTANCE_CLASSES,
  STRATEGIES,
  baseSpeed,
  minSpeed,
} from '../data/races';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

/** How strong the simulated rival field is. */
export type CompetitionLevel = 'easy' | 'cm' | 'hard';

export interface CompetitionLevelInfo {
  id: CompetitionLevel;
  label: string;
  hint: string;
  /** All five rival stats are sampled around this value. */
  rivalStat: number;
  /** Flat seconds shaved off rival times to represent their skill loadouts. */
  skillAllowanceS: number;
}

export const COMPETITION_LEVELS: CompetitionLevelInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    hint: 'Team Trials-grade rivals (~480 in every stat)',
    rivalStat: 480,
    skillAllowanceS: 0.05,
  },
  {
    id: 'cm',
    label: 'CM Average',
    hint: "Champion's Meeting average (~1050 in every stat)",
    rivalStat: 1050,
    skillAllowanceS: 0.25,
  },
  {
    id: 'hard',
    label: 'Hard',
    hint: 'Top-end CM finals (~1250 in every stat)',
    rivalStat: 1250,
    skillAllowanceS: 0.45,
  },
];

export interface SimulationInput {
  uma: UmaConfig;
  aptitudes: AptitudeSet;
  race: RaceConfig;
  /** Skills included in the run (already filtered by the UI checkboxes). */
  skills: SkillEntry[];
  /** Rival field strength. Default: 'cm'. */
  competitionLevel?: CompetitionLevel;
  /** Monte Carlo iterations. Default: 1000. */
  iterations?: number;
  /** Deterministic seed (tests / fair build comparisons). Random when omitted. */
  seed?: number;
}

export const DEFAULT_ITERATIONS = 1000;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) + gaussian sampling
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
function makeGauss(rng: () => number): () => number {
  return () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Effective stats (aptitude buckets from races.ts)
// ---------------------------------------------------------------------------

/**
 * Aptitude buckets scale the stat that matters for that check:
 * distance grade → speed, track grade → power, strategy grade → wisdom.
 * (Stamina and guts pools are grade-independent, as in the game.)
 */
export function effectiveStats(
  stats: UmaStats,
  aptitudes: AptitudeSet,
  race: RaceConfig,
): UmaStats {
  const distMult = APTITUDE_CONSISTENCY_MULT[aptitudes.distance[race.distanceClass]];
  const trackMult = APTITUDE_CONSISTENCY_MULT[aptitudes.track[race.surface]];
  const stratMult = APTITUDE_CONSISTENCY_MULT[aptitudes.strategy[race.strategy]];
  return {
    speed: stats.speed * distMult,
    stamina: stats.stamina,
    power: stats.power * trackMult,
    guts: stats.guts,
    wisdom: stats.wisdom * stratMult,
  };
}

/** Wit activation roll (RaceSolver.ts): max(100 − 9000/wit, 20)/100. */
export function witActivationChance(wisdom: number): number {
  return Math.max(100 - 9000 / Math.max(wisdom, 1), 20) / 100;
}

// ---------------------------------------------------------------------------
// Single-run phase model
// ---------------------------------------------------------------------------

interface RunResult {
  /** Finish time in seconds. */
  time: number;
  /** Leftover HP as a fraction of the pool (negative = gassed out). */
  marginFrac: number;
  gassed: boolean;
}

/**
 * Run one race with fixed effective stats.
 * @param gauss standard-normal sampler, or null for a deterministic
 *              expected-value run (used for the rival reference time).
 */
function runRace(
  eff: UmaStats,
  distance: number,
  strategy: Strategy,
  gauss: (() => number) | null,
  startDelay: number,
  hpBonusFrac: number,
): RunResult {
  const base = baseSpeed(distance);
  const style = STRATEGIES[strategy];
  const [c0, c1, c2] = style.velocityByPhase;

  // Wisdom steadies per-phase pace (fewer mid-race hesitations).
  const noiseSd = 0.006 + 0.018 * (1 - clamp(eff.wisdom, 0, 1600) / 1600);
  const jitter = (): number =>
    gauss === null ? 1 : 1 + noiseSd * clamp(gauss(), -3, 3);

  const speedTerm = Math.sqrt(500 * Math.max(eff.speed, 0)) * 0.002;
  const gutsTerm = Math.sqrt(450 * Math.max(eff.guts, 0)) * 0.0001;
  const powerFactor = clamp(eff.power / 1200, 0, 1.5);

  // Segments: opening | middle | final leg | last spurt (final+spurt = phase 3).
  const segments: { d: number; v: number; spurt: boolean }[] = [
    { d: distance / 6, v: base * c0 * (0.98 + 0.03 * powerFactor) * jitter(), spurt: false },
    { d: distance / 2, v: (base * c1 + speedTerm * 0.35) * jitter(), spurt: false },
    { d: distance / 6, v: (base * c2 + speedTerm + gutsTerm * 0.5) * jitter(), spurt: false },
    {
      d: distance / 6,
      v: ((base * c2 + 0.01 * base) * 1.05 + speedTerm + gutsTerm) * jitter(),
      spurt: true,
    },
  ];

  // HP pool = distance + 0.8 × styleCoef × stamina (recovery skills add %).
  const pool = (distance + 0.8 * style.hpCoefficient * Math.max(eff.stamina, 0)) * (1 + hpBonusFrac);
  const vMin = minSpeed(distance, eff.guts);

  let time = startDelay;
  let hpLeft = pool;
  /** Bookkeeping that may go negative — measures shortfall for the margin. */
  let hpBalance = pool;
  let gassed = false;

  for (const seg of segments) {
    const gross = seg.spurt ? 1.65 : 1; // last-spurt gross consumption
    const rate = ((20 * (seg.v - base + 12) ** 2) / 144) * gross;
    const tFull = seg.d / seg.v;
    hpBalance -= rate * tFull;

    if (gassed) {
      time += seg.d / vMin;
      continue;
    }
    if (hpLeft >= rate * tFull) {
      hpLeft -= rate * tFull;
      time += tFull;
    } else {
      // Runs dry mid-segment: limp home at the guts-boosted minimum speed.
      const tBurn = hpLeft / rate;
      const covered = seg.v * tBurn;
      hpLeft = 0;
      gassed = true;
      time += tBurn + (seg.d - covered) / vMin;
    }
  }

  return { time, marginFrac: hpBalance / pool, gassed };
}

// ---------------------------------------------------------------------------
// Skill contribution
// ---------------------------------------------------------------------------

/** Skills whose surface/distance/strategy tags conflict with the race never fire. */
function skillMatchesRace(skill: SkillEntry, race: RaceConfig): boolean {
  const t = skill.aptitudeTags;
  if (t.surface && t.surface.length > 0 && !t.surface.includes(race.surface)) return false;
  if (t.distance && t.distance.length > 0 && !t.distance.includes(race.distanceClass)) return false;
  if (t.strategy && t.strategy.length > 0 && !t.strategy.includes(race.strategy)) return false;
  return true;
}

/** Aptitude-bucket dampening for tagged skills (capped at ×1). */
function skillAptitudeMult(skill: SkillEntry, race: RaceConfig, aptitudes: AptitudeSet): number {
  let m = 1;
  const t = skill.aptitudeTags;
  if (t.surface && t.surface.includes(race.surface)) {
    m = Math.min(m, APTITUDE_CONSISTENCY_MULT[aptitudes.track[race.surface]]);
  }
  if (t.distance && t.distance.includes(race.distanceClass)) {
    m = Math.min(m, APTITUDE_CONSISTENCY_MULT[aptitudes.distance[race.distanceClass]]);
  }
  if (t.strategy && t.strategy.includes(race.strategy)) {
    m = Math.min(m, APTITUDE_CONSISTENCY_MULT[aptitudes.strategy[race.strategy]]);
  }
  return Math.min(m, 1);
}

/** Time saved when a non-recovery skill fires, scaled by its SV (rarity). */
function skillTimeReductionS(skill: SkillEntry): number {
  return skill.sv / 6000; // white 500 → 0.083s, gold 1200 → 0.2s, pink 2000 → 0.33s
}

/** HP restored (fraction of pool) when a recovery skill fires. */
function skillHpRestoreFrac(skill: SkillEntry): number {
  if (skill.sv <= 500) return 0.035; // white recovery
  if (skill.sv <= 1200) return 0.055; // gold recovery
  return 0.075; // unique-tier recovery
}

// ---------------------------------------------------------------------------
// simulate()
// ---------------------------------------------------------------------------

export function simulate(input: SimulationInput): SimulationOutcome {
  const { uma, aptitudes, race, skills } = input;
  const iterations = Math.max(1, Math.round(input.iterations ?? DEFAULT_ITERATIONS));
  const level =
    COMPETITION_LEVELS.find((l) => l.id === (input.competitionLevel ?? 'cm')) ??
    COMPETITION_LEVELS[1];
  const seed = input.seed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = mulberry32(seed);
  const gauss = makeGauss(rng);

  const fieldSize = clamp(Math.round(race.fieldSize) || 9, 2, 24);
  const rivalCount = fieldSize - 1;
  const distance = DISTANCE_CLASSES[race.distanceClass].typicalMeters;

  const eff = effectiveStats(uma.stats, aptitudes, race);
  const witChance = witActivationChance(eff.wisdom);

  // Pre-resolve skill activation parameters once.
  const activeSkills = skills
    .filter((s) => skillMatchesRace(s, race))
    .map((s) => ({
      skill: s,
      p: clamp(
        witChance * clamp(s.expectedActivations, 0, 1) * skillAptitudeMult(s, race, aptitudes),
        0,
        1,
      ),
      isRecovery: s.type === 'recovery' || s.color === 'blue',
    }));

  // Rival reference: deterministic expected-value run of a uniform-stat
  // pace-chaser with A-grade aptitudes (bucket ×1.1), minus a small skill
  // allowance for the level.
  const rs = level.rivalStat;
  const rivalEff: UmaStats = {
    speed: rs * 1.1,
    stamina: rs,
    power: rs * 1.1,
    guts: rs,
    wisdom: rs * 1.1,
  };
  const rivalRef = runRace(rivalEff, distance, 'pace', null, 0.05, 0);
  const rivalRefTime = rivalRef.time - level.skillAllowanceS;
  const rivalSpreadS = 0.9;

  // Monte Carlo loop.
  const placementCounts = new Array<number>(fieldSize).fill(0);
  let timeSum = 0;
  let marginSum = 0;
  let winCount = 0;
  let top3Count = 0;
  let gassedCount = 0;

  for (let i = 0; i < iterations; i++) {
    // Phase 1 gate response: wisdom-gated start delay.
    const startDelay = rng() * 0.1 + (1 - witChance) * rng() * 0.15;

    // Skill rolls (each skill fires at most once per race).
    let timeReduction = 0;
    let hpBonusFrac = 0;
    for (const a of activeSkills) {
      if (rng() < a.p) {
        if (a.isRecovery) hpBonusFrac += skillHpRestoreFrac(a.skill);
        else timeReduction += skillTimeReductionS(a.skill);
      }
    }

    const run = runRace(eff, distance, race.strategy, gauss, startDelay, hpBonusFrac);
    const finishTime = run.time - timeReduction;

    timeSum += finishTime;
    marginSum += run.marginFrac;
    if (run.gassed) gassedCount++;

    // Placement vs sampled rivals.
    let beatenBy = 0;
    for (let r = 0; r < rivalCount; r++) {
      const rivalTime = rivalRefTime + gauss() * rivalSpreadS;
      if (rivalTime < finishTime) beatenBy++;
    }
    placementCounts[beatenBy]++;
    if (beatenBy === 0) winCount++;
    if (beatenBy <= 2) top3Count++;
  }

  const meanMarginFrac = marginSum / iterations;
  const gassedPct = (gassedCount / iterations) * 100;

  // -------------------------------------------------------------------------
  // Warnings + recommendations (per-class thresholds from data/races.ts)
  // -------------------------------------------------------------------------
  const info = DISTANCE_CLASSES[race.distanceClass];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const thresholdChecks: { key: 'speed' | 'power' | 'stamina'; label: string; note: string }[] = [
    { key: 'speed', label: 'Speed', note: 'expect to lose ground mid-race and in the spurt' },
    { key: 'power', label: 'Power', note: 'weak positioning out of the gate' },
    { key: 'stamina', label: 'Stamina', note: 'high risk of draining the HP pool' },
  ];
  for (const check of thresholdChecks) {
    const current = uma.stats[check.key];
    const target = info.recommendedStats[check.key];
    if (current < target) {
      warnings.push(
        `${check.label} ${current} is below the ~${target} recommended for ${info.label} — ${check.note}.`,
      );
      recommendations.push(
        `Raise ${check.label} by ${target - current} (${current} → ${target}) to clear the ${info.label} benchmark.`,
      );
    }
  }

  if (gassedPct >= 10) {
    warnings.push(`Ran out of HP before the finish in ${gassedPct.toFixed(0)}% of runs.`);
    if (uma.stats.stamina >= info.recommendedStats.stamina && meanMarginFrac < 0) {
      const style = STRATEGIES[race.strategy];
      const pool = distance + 0.8 * style.hpCoefficient * uma.stats.stamina;
      const extra = Math.ceil((-meanMarginFrac * pool) / (0.8 * style.hpCoefficient) / 10) * 10;
      recommendations.push(
        `Add ~${extra} Stamina (or a recovery skill) to survive the last spurt at ${info.label} distance.`,
      );
    }
  }
  if (witChance < 0.7) {
    warnings.push(
      `Effective Wit gives only a ${(witChance * 100).toFixed(0)}% skill activation roll — skills will misfire often.`,
    );
  }

  return {
    winPct: (winCount / iterations) * 100,
    top3Pct: (top3Count / iterations) * 100,
    meanFinishS: timeSum / iterations,
    placementDistribution: placementCounts.map((c) => c / iterations),
    staminaMarginPct: meanMarginFrac * 100,
    warnings,
    recommendations,
  };
}
