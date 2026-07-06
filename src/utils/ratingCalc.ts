/**
 * Rating calculator glue — combines the exact rating math materialized in
 * src/data/ratings.ts (umakonga stat table, unique bonus, full tier ladder)
 * into a single RatingResult. No formulas are re-implemented here.
 *
 *   total = statsScore + skillScore + uniqueBonus
 *
 * Aptitudes do NOT contribute to the rating total.
 */
import type { RankedSkill, RatingResult, UmaConfig, UmaStats } from '../types';
import { gradeFor, skillRatingScore, statsScore, uniqueBonus } from '../data/ratings';

export interface ComputeRatingInput {
  stats: UmaStats;
  starLevel: UmaConfig['starLevel'];
  uniqueLevel: UmaConfig['uniqueLevel'];
  /** Total rating points contributed by learned skills. */
  skillScore: number;
}

/**
 * Compute the full projected rating from stats + rarity + skill score.
 * Uses only src/data/ratings.ts exports for the underlying math.
 */
export function computeRating({
  stats,
  starLevel,
  uniqueLevel,
  skillScore,
}: ComputeRatingInput): RatingResult {
  const statsPart = statsScore(stats);
  const uniquePart = uniqueBonus(starLevel, uniqueLevel);
  const skillsPart = Math.max(0, skillScore);
  const total = Math.floor(statsPart + skillsPart + uniquePart);
  const grade = gradeFor(total);
  return {
    total,
    tier: grade.tier,
    nextTier: grade.next,
    toNextTier: grade.toNext,
    breakdown: {
      stats: statsPart,
      skills: Math.floor(skillsPart),
      unique: uniquePart,
    },
  };
}

/**
 * Sum the rating contribution of an optimizer pick list.
 * skillRatingScore keys off the underlying rarity (sv 500/1200/2000 →
 * 220/380/700), which matches SKILL_SCORE_BY_COLOR for true white/gold/pink
 * skills and correctly scores green/blue/red display-color overrides by their
 * real rarity. These are PROFILE rating points, not Team Trials 500/1200.
 */
export function skillScoreFromPicked(picked: readonly RankedSkill[]): number {
  return picked.reduce((sum, ranked) => sum + skillRatingScore(ranked.skill), 0);
}
