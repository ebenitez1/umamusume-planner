/**
 * Rating math — ported VERBATIM from FORMULAS.md (daftuyda rating-shared.js).
 *
 *   total = statsScore + uniqueBonus + skillScore
 *
 * Aptitudes do NOT contribute to the rating total.
 */
import type { SkillEntry, UmaConfig, UmaStats } from '../types';

// ---------------------------------------------------------------------------
// statsScore — the "umakonga" lookup table, built once at module load.
// STAT_SCORES[v] = score contribution of a single stat at value v (0..2500).
// Reference points: [400]=577 [651]=1301 [752]=1640 [900]=2209 [1000]=2635
//                   [1100]=3171 [1200]=3841
// ---------------------------------------------------------------------------

const R1 = [
  5, 8, 10, 13, 16, 18, 21, 24, 26, 28, 29, 30, 31, 33, 34, 35, 39, 41, 42, 43, 52, 55,
  66, 68, 68,
];
const R2 = [
  79, 80, 81, 83, 84, 85, 86, 88, 89, 90, 92, 93, 94, 96, 97, 98, 100, 101, 102, 103,
  105, 106, 107, 109, 110, 111, 113, 114, 115, 117, 118, 119, 121, 122, 123, 124, 126,
  127, 128, 130, 131, 132, 134, 135, 136, 138, 139, 140, 141, 143, 144, 145, 147, 148,
  149, 151, 152, 153, 155, 156, 157, 159, 160, 161, 162, 164, 165, 166, 168, 169, 170,
  172, 173, 174, 176, 177, 178, 179, 181, 182, 182,
];

function buildStatScores(): number[] {
  const sc: number[] = [0];
  let raw = 0;
  let idx = 0;
  for (let c = 1; c <= 1200; c++) {
    if (c <= 49) idx = 0;
    else if (c <= 99) idx = 1;
    else if (c % 50 === 0) idx++;
    raw += R1[idx];
    sc[c] = Math.round(raw / 10);
  }
  raw = 38413;
  idx = 0;
  for (let c = 1201; c <= 2000; c++) {
    if (c <= 1209) idx = 0;
    else if (c <= 1219) idx = 1;
    else if (c % 10 === 0) idx++;
    raw += R2[idx];
    sc[c] = Math.round(raw / 10);
  }
  raw = 142796;
  idx = 0;
  let rate = 183;
  for (let c = 2001; c <= 2500; c++) {
    if (idx >= 25) {
      rate++;
      idx = 0;
    }
    raw += rate;
    idx++;
    sc[c] = Math.round(raw / 10);
  }
  return sc;
}

/** Index = stat value (0..2500). All five stats use the SAME table, equally weighted. */
export const STAT_SCORES: readonly number[] = buildStatScores();

/** Score for a single stat value (input clamped to 0..2500). */
export function statScore(value: number): number {
  const v = Math.max(0, Math.min(2500, Math.floor(value)));
  return STAT_SCORES[v];
}

/** Sum of all five stat scores. */
export function statsScore(stats: UmaStats): number {
  return (
    statScore(stats.speed) +
    statScore(stats.stamina) +
    statScore(stats.power) +
    statScore(stats.guts) +
    statScore(stats.wisdom)
  );
}

// ---------------------------------------------------------------------------
// uniqueBonus
// ---------------------------------------------------------------------------

/** uniqueLevel × (star ≤ 2 ? 120 : 170). */
export function uniqueBonus(
  starLevel: UmaConfig['starLevel'],
  uniqueLevel: UmaConfig['uniqueLevel'],
): number {
  return uniqueLevel * (starLevel <= 2 ? 120 : 170);
}

// ---------------------------------------------------------------------------
// skillScore — calibrated per-rarity averages (profile rating contribution)
// ---------------------------------------------------------------------------

/**
 * Rating points per learned skill by DISPLAY color. Green/blue/red skills are
 * rarity overrides (passive/recovery/debuff) — prefer skillRatingScore(),
 * which keys off the underlying rarity via SkillEntry.sv.
 */
export const SKILL_SCORE_BY_COLOR: Record<SkillEntry['color'], number> = {
  white: 220,
  gold: 380,
  pink: 700,
  green: 220,
  blue: 220,
  red: 220,
};

/**
 * Preferred per-skill rating contribution: keyed off underlying rarity
 * (sv 500 = white 220, sv 1200 = gold 380, sv 2000 = pink 700).
 */
export function skillRatingScore(skill: SkillEntry): number {
  if (skill.sv >= 2000) return 700;
  if (skill.sv >= 1200) return 380;
  return 220;
}

// ---------------------------------------------------------------------------
// Tier thresholds (RATING_BADGE_MINIMA, ported verbatim)
// ---------------------------------------------------------------------------

export interface RatingTier {
  tier: string;
  min: number;
}

export const RATING_TIERS: RatingTier[] = [
  { tier: 'G', min: 0 },
  { tier: 'G+', min: 300 },
  { tier: 'F', min: 600 },
  { tier: 'F+', min: 900 },
  { tier: 'E', min: 1300 },
  { tier: 'E+', min: 1800 },
  { tier: 'D', min: 2300 },
  { tier: 'D+', min: 2900 },
  { tier: 'C', min: 3500 },
  { tier: 'C+', min: 4900 },
  { tier: 'B', min: 6500 },
  { tier: 'B+', min: 8200 },
  { tier: 'A', min: 10000 },
  { tier: 'A+', min: 12100 },
  { tier: 'S', min: 14500 },
  { tier: 'S+', min: 15900 },
  { tier: 'SS', min: 17500 },
  { tier: 'SS+', min: 19200 },
  { tier: 'UG', min: 19600 },
  { tier: 'UG1', min: 20000 },
  { tier: 'UG2', min: 20400 },
  { tier: 'UG3', min: 20800 },
  { tier: 'UG4', min: 21200 },
  { tier: 'UG5', min: 21600 },
  { tier: 'UG6', min: 22100 },
  { tier: 'UG7', min: 22500 },
  { tier: 'UG8', min: 23000 },
  { tier: 'UG9', min: 23400 },
  { tier: 'UF', min: 23900 },
  { tier: 'UF1', min: 24300 },
  { tier: 'UF2', min: 24800 },
  { tier: 'UF3', min: 25300 },
  { tier: 'UF4', min: 25800 },
  { tier: 'UF5', min: 26300 },
  { tier: 'UF6', min: 26800 },
  { tier: 'UF7', min: 27300 },
  { tier: 'UF8', min: 27800 },
  { tier: 'UF9', min: 28300 },
  { tier: 'UE', min: 28800 },
  { tier: 'UE1', min: 29400 },
  { tier: 'UE2', min: 29900 },
  { tier: 'UE3', min: 30400 },
  { tier: 'UE4', min: 31000 },
  { tier: 'UE5', min: 31500 },
  { tier: 'UE6', min: 32100 },
  { tier: 'UE7', min: 32700 },
  { tier: 'UE8', min: 33200 },
  { tier: 'UE9', min: 33800 },
  { tier: 'UD', min: 34400 },
  { tier: 'UD1', min: 35000 },
  { tier: 'UD2', min: 35600 },
  { tier: 'UD3', min: 36200 },
  { tier: 'UD4', min: 36800 },
  { tier: 'UD5', min: 37500 },
  { tier: 'UD6', min: 38100 },
  { tier: 'UD7', min: 38700 },
  { tier: 'UD8', min: 39400 },
  { tier: 'UD9', min: 40000 },
  { tier: 'UC', min: 40700 },
  { tier: 'UC1', min: 41300 },
  { tier: 'UC2', min: 42000 },
  { tier: 'UC3', min: 42700 },
  { tier: 'UC4', min: 43400 },
  { tier: 'UC5', min: 44000 },
  { tier: 'UC6', min: 44700 },
  { tier: 'UC7', min: 45400 },
  { tier: 'UC8', min: 46200 },
  { tier: 'UC9', min: 46900 },
  { tier: 'UB', min: 47600 },
  { tier: 'UB1', min: 48300 },
  { tier: 'UB2', min: 49000 },
  { tier: 'UB3', min: 49800 },
  { tier: 'UB4', min: 50500 },
  { tier: 'UB5', min: 51300 },
  { tier: 'UB6', min: 52000 },
  { tier: 'UB7', min: 52800 },
  { tier: 'UB8', min: 53600 },
  { tier: 'UB9', min: 54400 },
  { tier: 'UA', min: 55200 },
  { tier: 'UA1', min: 55900 },
  { tier: 'UA2', min: 56700 },
  { tier: 'UA3', min: 57500 },
  { tier: 'UA4', min: 58400 },
  { tier: 'UA5', min: 59200 },
  { tier: 'UA6', min: 60000 },
  { tier: 'UA7', min: 60800 },
  { tier: 'UA8', min: 61700 },
  { tier: 'UA9', min: 62500 },
  { tier: 'US', min: 63400 },
  { tier: 'US1', min: 64200 },
  { tier: 'US2', min: 65100 },
  { tier: 'US3', min: 66400 },
  { tier: 'US4', min: 67700 },
  { tier: 'US5', min: 69000 },
  { tier: 'US6', min: 70300 },
  { tier: 'US7', min: 71600 },
  { tier: 'US8', min: 72900 },
  { tier: 'US9', min: 74400 },
  { tier: 'LG', min: 76000 },
];

/** Resolve a rating total to its tier plus distance to the next tier. */
export function gradeFor(total: number): { tier: string; next: string; toNext: number } {
  let i = 0;
  for (let j = 0; j < RATING_TIERS.length; j++) {
    if (total >= RATING_TIERS[j].min) i = j;
    else break;
  }
  const current = RATING_TIERS[i];
  const next = RATING_TIERS[i + 1];
  return {
    tier: current.tier,
    next: next ? next.tier : current.tier,
    toNext: next ? next.min - total : 0,
  };
}
