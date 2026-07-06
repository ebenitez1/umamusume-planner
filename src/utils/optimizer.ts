/**
 * Skill Optimizer engine — UmaTools "Team Trials" scoring model.
 *
 * Scoring model (FORMULAS.md "Optimizer scoring"):
 *  - consistency (0..1): the skill's heuristic expectedActivations multiplied
 *    by aptitude-grade bucket multipliers (S/A ×1.1, B/C ×0.9, D/E/F ×0.8,
 *    G ×0.7) for every aptitude dimension the skill is tagged with, evaluated
 *    against the CURRENT race config. A skill tagged for a surface/distance/
 *    strategy that does not match the current race is locked out
 *    (consistency = 0) and reported as a warning. Green passives (volatile
 *    race-condition boosts) get a ×0.75 consistency penalty, EXCEPT "Savvy"
 *    skills (FORMULAS.md).
 *  - costEfficiency (0..1): value-per-effective-SP, normalized against a
 *    documented ceiling. Effective SP = (override ?? base cost), ×0.9 when
 *    Fast Learner is on (floored, min 1).
 *  - composite = wC×consistency + wE×costEfficiency (weights sum to 1).
 *
 * Optimize-for targets:
 *  - 'teamTrials' — value basis = sv (activation points: white 500,
 *    gold 1200, pink 2000); user weights as-is. This is the UmaTools
 *    Team Trials (Consistent) model.
 *  - 'rating'     — value basis = profile-rating contribution per skill
 *    (white 220 / gold 380 / pink 700); user weights as-is. Favors buying
 *    many cheap skills, since rating pays a flat amount per learned skill.
 *  - 'aptitudeTest' — documented variant weighting consistency 100%
 *    (cost efficiency is only a tie-breaker inside the sort).
 *
 * Selection heuristic (documented): greedy fill — candidates are sorted by
 * composite score (ties: svPerSp desc, then cheaper first) and bought in
 * order while they fit the remaining SP budget. Locked-out (consistency 0)
 * and non-purchasable skills are never bought. Greedy is not a full knapsack
 * solve, but with skill costs all in the same 80–400 SP band it tracks the
 * optimal set closely and is what UmaTools itself does.
 */

import type {
  AptitudeGrade,
  AptitudeSet,
  OptimizerResult,
  OptimizerSummary,
  RaceConfig,
  RankedSkill,
  SkillEntry,
} from '../types';
import { APTITUDE_CONSISTENCY_MULT, DISTANCE_CLASSES, STRATEGIES, SURFACE_LABELS } from '../data/races';

export type OptimizeTarget = 'rating' | 'teamTrials' | 'aptitudeTest';

export const OPTIMIZE_TARGET_LABELS: Record<OptimizeTarget, string> = {
  rating: 'Rating',
  teamTrials: 'Team Trials (Consistent)',
  aptitudeTest: 'Trainer Aptitude Test',
};

export interface OptimizerArgs {
  /** Candidate pool (the user's working skill list). */
  skills: SkillEntry[];
  aptitudes: AptitudeSet;
  race: RaceConfig;
  spBudget: number;
  /** Fast Learner: ×0.9 on every SP cost. */
  fastLearner: boolean;
  /** Filter the pool to skills with official Global (EN) text. */
  officialOnly: boolean;
  /** Percent weights; consistency + costEfficiency = 100. */
  weights: { consistency: number; costEfficiency: number };
  /** Per-skill SP cost overrides (hint-level discounts, manual entry). */
  costOverrides: Record<number, number>;
  optimizeFor: OptimizeTarget;
}

/** Team Trials activation points by underlying rarity (FORMULAS.md). */
const ACTIVATION_POINTS = { white: 500, gold: 1200, pink: 2000 } as const;

/** Profile-rating contribution per learned skill by underlying rarity. */
const RATING_POINTS = { white: 220, gold: 380, pink: 700 } as const;

/** Normalization ceilings for costEfficiency (value per effective SP). */
const SV_PER_SP_NORM = 12; // ~gold 1200sv at a heavily discounted ~100 SP
const RATING_PER_SP_NORM = 8; // ~pink 700pts at ~88 SP

/** Consistency penalty for green passives (volatile condition boosts). */
const GREEN_PASSIVE_PENALTY = 0.75;

/** Underlying rarity from sv (sv encodes rarity even when color is overridden). */
function rarityOf(skill: SkillEntry): keyof typeof ACTIVATION_POINTS {
  if (skill.sv >= 2000) return 'pink';
  if (skill.sv >= 1200) return 'gold';
  return 'white';
}

/** Effective SP cost after per-skill override and Fast Learner discount. */
export function effectiveSpCost(
  skill: SkillEntry,
  costOverrides: Record<number, number>,
  fastLearner: boolean,
): number {
  const base = costOverrides[skill.id] ?? skill.spCost;
  const discounted = fastLearner ? Math.floor(base * 0.9) : base;
  return Math.max(1, discounted);
}

function bucketMult(grade: AptitudeGrade): number {
  return APTITUDE_CONSISTENCY_MULT[grade];
}

interface ConsistencyEval {
  consistency: number;
  /** Human-readable lockout reason, if the skill can never fire. */
  lockout: string | null;
  /** Aptitude groups (with grade) that boosted this skill (S/A matches). */
  synergies: string[];
}

function evalConsistency(
  skill: SkillEntry,
  race: RaceConfig,
  aptitudes: AptitudeSet,
): ConsistencyEval {
  const tags = skill.aptitudeTags;
  let mult = 1;
  const synergies: string[] = [];

  if (tags.surface && tags.surface.length > 0) {
    if (!tags.surface.includes(race.surface)) {
      return {
        consistency: 0,
        lockout: `requires ${tags.surface.map((s) => SURFACE_LABELS[s]).join('/')} but the race is ${SURFACE_LABELS[race.surface]}`,
        synergies,
      };
    }
    const grade = aptitudes.track[race.surface];
    mult *= bucketMult(grade);
    if (grade === 'S' || grade === 'A') {
      synergies.push(`${grade} ${SURFACE_LABELS[race.surface]}`);
    }
  }

  if (tags.distance && tags.distance.length > 0) {
    if (!tags.distance.includes(race.distanceClass)) {
      return {
        consistency: 0,
        lockout: `requires ${tags.distance.map((d) => DISTANCE_CLASSES[d].label).join('/')} but the race is ${DISTANCE_CLASSES[race.distanceClass].label}`,
        synergies,
      };
    }
    const grade = aptitudes.distance[race.distanceClass];
    mult *= bucketMult(grade);
    if (grade === 'S' || grade === 'A') {
      synergies.push(`${grade} ${DISTANCE_CLASSES[race.distanceClass].label}`);
    }
  }

  if (tags.strategy && tags.strategy.length > 0) {
    if (!tags.strategy.includes(race.strategy)) {
      return {
        consistency: 0,
        lockout: `requires ${tags.strategy.map((s) => STRATEGIES[s].label).join('/')} but you are running ${STRATEGIES[race.strategy].label}`,
        synergies,
      };
    }
    const grade = aptitudes.strategy[race.strategy];
    mult *= bucketMult(grade);
    if (grade === 'S' || grade === 'A') {
      synergies.push(`${grade} ${STRATEGIES[race.strategy].label}`);
    }
  }

  let consistency = skill.expectedActivations * mult;
  if (skill.color === 'green' && !skill.name.toLowerCase().includes('savvy')) {
    consistency *= GREEN_PASSIVE_PENALTY;
  }
  return { consistency: Math.max(0, Math.min(1, consistency)), lockout: null, synergies };
}

/** True when the skill's activation depends on a random roll bucket. */
function isRandomGated(skill: SkillEntry): boolean {
  return /random/i.test(skill.conditionRaw ?? '');
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const EXPLAIN_CAP = 8;

export function runOptimizer(args: OptimizerArgs): OptimizerResult {
  const { aptitudes, race, spBudget, fastLearner, officialOnly, optimizeFor, costOverrides } = args;

  const warnings: string[] = [];
  const risks: string[] = [];
  const strengths: string[] = [];

  // -- Pool filtering ------------------------------------------------------
  const hiddenByOfficial = officialOnly ? args.skills.filter((s) => !s.official).length : 0;
  const pool = officialOnly ? args.skills.filter((s) => s.official) : args.skills;
  if (hiddenByOfficial > 0) {
    warnings.push(
      `${hiddenByOfficial} skill${hiddenByOfficial === 1 ? '' : 's'} hidden by the Official EN Skills Only filter.`,
    );
  }
  if (pool.length === 0) {
    warnings.push('No candidate skills — add skills with Skill Entry or the skill browser.');
  }

  // -- Effective weights per optimize-for target ---------------------------
  const wC = optimizeFor === 'aptitudeTest' ? 1 : Math.max(0, Math.min(100, args.weights.consistency)) / 100;
  const wE = 1 - wC;

  // -- Score every candidate ----------------------------------------------
  const lockouts: { skill: SkillEntry; reason: string }[] = [];
  const synergyBySkill = new Map<number, string[]>();

  const ranked: RankedSkill[] = pool.map((skill) => {
    const effectiveCost = effectiveSpCost(skill, costOverrides, fastLearner);
    const { consistency, lockout, synergies } = evalConsistency(skill, race, aptitudes);
    if (lockout) lockouts.push({ skill, reason: lockout });
    if (synergies.length > 0) synergyBySkill.set(skill.id, synergies);

    const rarity = rarityOf(skill);
    const value = optimizeFor === 'rating' ? RATING_POINTS[rarity] : ACTIVATION_POINTS[rarity];
    const norm = optimizeFor === 'rating' ? RATING_PER_SP_NORM : SV_PER_SP_NORM;
    const costEfficiency = Math.min(1, value / effectiveCost / norm);
    const svPerSp = skill.sv / effectiveCost;
    const score = lockout ? 0 : wC * consistency + wE * costEfficiency;

    return { skill, score, consistency, costEfficiency, svPerSp, effectiveCost };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.svPerSp - a.svPerSp ||
      a.effectiveCost - b.effectiveCost ||
      a.skill.id - b.skill.id,
  );

  // -- Greedy selection under the SP budget --------------------------------
  const picked: RankedSkill[] = [];
  let remaining = Math.max(0, Math.floor(spBudget));
  let skippedForBudget = 0;
  for (const entry of ranked) {
    if (!entry.skill.purchasable || entry.consistency <= 0 || entry.score <= 0) continue;
    if (entry.effectiveCost <= remaining) {
      picked.push(entry);
      remaining -= entry.effectiveCost;
    } else {
      skippedForBudget++;
    }
  }

  // -- Summary (all twelve fields) -----------------------------------------
  const usedPoints = picked.reduce((sum, p) => sum + p.effectiveCost, 0);
  const totalSv = picked.reduce((sum, p) => sum + p.skill.sv, 0);
  const sumConsistency = picked.reduce((sum, p) => sum + p.consistency, 0);
  const expectedValue = picked.reduce((sum, p) => sum + p.skill.sv * p.skill.expectedActivations, 0);
  const estActivationScore = picked.reduce(
    (sum, p) => sum + ACTIVATION_POINTS[rarityOf(p.skill)] * p.consistency,
    0,
  );

  const summary: OptimizerSummary = {
    // Per FORMULAS.md scorePerSp = composite × 500 / spCost; per-skill build
    // score is therefore composite × 500, summed over the bought set.
    bestScore: Math.round(picked.reduce((sum, p) => sum + p.score * 500, 0)),
    usedPoints,
    totalPoints: Math.max(0, Math.floor(spBudget)),
    remaining: Math.max(0, Math.floor(spBudget)) - usedPoints,
    consistencyPct: picked.length > 0 ? Math.round((sumConsistency / picked.length) * 100) : 0,
    expectedValue: Math.round(expectedValue),
    totalSv,
    expectedActivations: round2(sumConsistency),
    svPerSp: usedPoints > 0 ? round2(totalSv / usedPoints) : 0,
    // Skills bought per 100 SP spent.
    skillDensity: usedPoints > 0 ? round2((picked.length * 100) / usedPoints) : 0,
    estActivationScore: Math.round(estActivationScore),
    // Documented variant: consistency weighted 100% (composite = consistency).
    aptitudeTestScore: Math.round(picked.reduce((sum, p) => sum + p.consistency * 500, 0)),
  };

  // -- Explain: strengths ----------------------------------------------------
  for (const p of picked) {
    if (p.consistency >= 0.75) {
      strengths.push(
        `${p.skill.name} activates reliably (${Math.round(p.consistency * 100)}% expected).`,
      );
    }
    if (strengths.length >= EXPLAIN_CAP) break;
  }
  for (const p of picked) {
    const syn = synergyBySkill.get(p.skill.id);
    if (syn && strengths.length < EXPLAIN_CAP) {
      strengths.push(`${p.skill.name} synergizes with your ${syn.join(' + ')} aptitude.`);
    }
  }
  if (picked.length > 0 && summary.consistencyPct >= 80) {
    strengths.push(`Overall build consistency is high (${summary.consistencyPct}%).`);
  }

  // -- Explain: risks --------------------------------------------------------
  for (const p of picked) {
    if (isRandomGated(p.skill) && risks.length < EXPLAIN_CAP) {
      risks.push(
        `${p.skill.name} is random-gated — its activation spot rolls per race, so results vary run to run.`,
      );
    }
  }
  for (const p of picked) {
    if (!isRandomGated(p.skill) && p.consistency > 0 && p.consistency < 0.45 && risks.length < EXPLAIN_CAP) {
      risks.push(
        `${p.skill.name} has low consistency (${Math.round(p.consistency * 100)}%) under the current race config.`,
      );
    }
  }
  if (skippedForBudget > 0) {
    risks.push(
      `SP budget exhausted — ${skippedForBudget} scored candidate${skippedForBudget === 1 ? '' : 's'} left unbought (${summary.remaining} SP remaining).`,
    );
  }

  // -- Explain: warnings ------------------------------------------------------
  for (const { skill, reason } of lockouts.slice(0, EXPLAIN_CAP)) {
    warnings.push(`${skill.name} will not activate: ${reason}.`);
  }
  const inherent = pool.filter((s) => !s.purchasable);
  for (const s of inherent.slice(0, 3)) {
    warnings.push(`${s.name} is an inherent unique and cannot be bought with SP.`);
  }
  if (pool.length > 0 && picked.length === 0 && spBudget > 0) {
    warnings.push('Budget too small to buy any candidate skill.');
  }

  return {
    ranked,
    picked,
    summary,
    explain: {
      strengths: strengths.slice(0, EXPLAIN_CAP),
      risks: risks.slice(0, EXPLAIN_CAP),
      warnings: warnings.slice(0, EXPLAIN_CAP + 4),
    },
  };
}
