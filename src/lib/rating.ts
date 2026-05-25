// Rating calculator — ports daftuyda.moe/optimizer's exact in-game formula.
//
//   total = statsScore + uniqueBonus + skillScore
//
//   statsScore = sum over 5 stats of STAT_SCORES[stat] (nonlinear lookup)
//   uniqueBonus = uniqueLevel × (starLevel<=2 ? 120 : 170)
//   skillScore = sum over learned skills of a per-rarity base value
//
// Aptitudes do NOT directly add to the total — they only affect which
// SKILLS score well (via affinity buckets). Kept in the UI as informational.
//
// Sources:
//   - STAT_SCORES table (umakonga formula): daftuyda.moe/js/rating-shared.js
//   - RATING_BADGE_MINIMA: same source, full table with sub-tiers
//   - Skill base values: daftuyda skill-scorer.js comment
//     ("Gold=1200pts, White=500pts" for Team Trials), unique extrapolated

import type {
  AptitudeGrade,
  Aptitudes,
  ChampionMeeting,
  RatingResult,
  Scenario,
  Skill,
  Stats,
  Uma,
  UmaBuild,
} from "../types";
import { skillById } from "../data";

// ---------------------------------------------------------------------------
// Stat → score lookup (the umakonga formula)
// ---------------------------------------------------------------------------

const MAX_STAT_VALUE = 2500;

const STAT_SCORES: number[] = (() => {
  // 0-1200: 50-pt blocks, 25 rate values
  const R1 = [
    5, 8, 10, 13, 16, 18, 21, 24, 26, 28, 29, 30, 31, 33, 34, 35, 39, 41, 42, 43, 52, 55, 66,
    68, 68,
  ];
  // 1201-2000: 10-pt blocks, 81 rate values
  const R2 = [
    79, 80, 81, 83, 84, 85, 86, 88, 89, 90, 92, 93, 94, 96, 97, 98, 100, 101, 102, 103, 105,
    106, 107, 109, 110, 111, 113, 114, 115, 117, 118, 119, 121, 122, 123, 124, 126, 127, 128,
    130, 131, 132, 134, 135, 136, 138, 139, 140, 141, 143, 144, 145, 147, 148, 149, 151, 152,
    153, 155, 156, 157, 159, 160, 161, 162, 164, 165, 166, 168, 169, 170, 172, 173, 174, 176,
    177, 178, 179, 181, 182, 182,
  ];

  const sc: number[] = [0];
  let raw = 0, idx = 0;
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
  for (let c = 2001; c <= MAX_STAT_VALUE; c++) {
    if (idx >= 25) { rate++; idx = 0; }
    raw += rate;
    idx++;
    sc[c] = Math.round(raw / 10);
  }
  return sc;
})();

const clampStat = (v: number) => Math.max(0, Math.min(MAX_STAT_VALUE, Math.round(v)));

function statScoreFor(stat: number): number {
  return STAT_SCORES[clampStat(stat)] ?? 0;
}

export function computeStatScore(stats: Stats): number {
  return (
    statScoreFor(stats.speed) +
    statScoreFor(stats.stamina) +
    statScoreFor(stats.power) +
    statScoreFor(stats.guts) +
    statScoreFor(stats.wit)
  );
}

// ---------------------------------------------------------------------------
// Unique skill bonus
//   1- or 2-star uma:  level × 120
//   3-star+ uma:       level × 170
// ---------------------------------------------------------------------------

export function calcUniqueBonus(starLevel: number, uniqueLevel: number): number {
  if (!uniqueLevel || uniqueLevel <= 0) return 0;
  const multiplier = starLevel === 1 || starLevel === 2 ? 120 : 170;
  return uniqueLevel * multiplier;
}

// ---------------------------------------------------------------------------
// Skill score — calibrated against a Daiwa Scarlet Peak Blue build whose
// in-game score is 20,289 UG1. With the umakonga stat formula already
// contributing ~14,500 from the stats and ~1,000 from the unique bonus,
// the skill component needs to land near ~4,800 total. Per-rarity averages:
//   normal (white): ~220, rare (gold): ~380, unique (pink): ~700
// ---------------------------------------------------------------------------

const SKILL_SCORE_BASE: Record<Skill["rarity"], number> = {
  normal: 220,
  rare: 380,
  unique: 700,
};

export function skillScore(skillIds: string[]): number {
  let total = 0;
  for (const id of skillIds) {
    const s = skillById.get(id);
    if (!s) continue;
    total += SKILL_SCORE_BASE[s.rarity] ?? 500;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Aptitudes — informational only (not part of the total score formula),
// but useful for warning the user when a skill won't activate in this race.
// ---------------------------------------------------------------------------

const APTITUDE_VAL: Record<AptitudeGrade, number> = {
  S: 800, A: 600, B: 400, C: 200, D: 0, E: -200, F: -400, G: -800,
};

export function computeAptitudeScore(apt: Aptitudes): number {
  return (
    APTITUDE_VAL[apt.surface.turf] + APTITUDE_VAL[apt.surface.dirt] +
    APTITUDE_VAL[apt.distance.sprint] + APTITUDE_VAL[apt.distance.mile] +
    APTITUDE_VAL[apt.distance.medium] + APTITUDE_VAL[apt.distance.long] +
    APTITUDE_VAL[apt.style.runner] + APTITUDE_VAL[apt.style.early] +
    APTITUDE_VAL[apt.style.late] + APTITUDE_VAL[apt.style.end]
  );
}

export function raceAptitudeScore(
  apt: Aptitudes,
  meeting: ChampionMeeting,
  style: keyof Aptitudes["style"]
): number {
  return (
    APTITUDE_VAL[apt.surface[meeting.surface]] +
    APTITUDE_VAL[apt.distance[meeting.distance]] +
    APTITUDE_VAL[apt.style[style]]
  );
}

// ---------------------------------------------------------------------------
// Grade thresholds — ported directly from daftuyda's RATING_BADGE_MINIMA.
// Full sub-tier resolution: UG → UG1 → UG2 → … → UG9 → UF → … → LF11.
// ---------------------------------------------------------------------------

const GRADE_TABLE: Array<[number, string]> = [
  [0,     "G"], [300,   "G+"], [600,   "F"], [900,   "F+"],
  [1300,  "E"], [1800,  "E+"], [2300,  "D"], [2900,  "D+"],
  [3500,  "C"], [4900,  "C+"], [6500,  "B"], [8200,  "B+"],
  [10000, "A"], [12100, "A+"], [14500, "S"], [15900, "S+"],
  [17500, "SS"], [19200, "SS+"],
  [19600, "UG"], [20000, "UG1"], [20400, "UG2"], [20800, "UG3"],
  [21200, "UG4"], [21600, "UG5"], [22100, "UG6"], [22500, "UG7"],
  [23000, "UG8"], [23400, "UG9"],
  [23900, "UF"], [24300, "UF1"], [24800, "UF2"], [25300, "UF3"],
  [25800, "UF4"], [26300, "UF5"], [26800, "UF6"], [27300, "UF7"],
  [27800, "UF8"], [28300, "UF9"],
  [28800, "UE"], [29400, "UE1"], [29900, "UE2"], [30400, "UE3"],
  [31000, "UE4"], [31500, "UE5"], [32100, "UE6"], [32700, "UE7"],
  [33200, "UE8"], [33800, "UE9"],
  [34400, "UD"], [35000, "UD1"], [35600, "UD2"], [36200, "UD3"],
  [36800, "UD4"], [37500, "UD5"], [38100, "UD6"], [38700, "UD7"],
  [39400, "UD8"], [40000, "UD9"],
  [40700, "UC"], [41300, "UC1"], [42000, "UC2"], [42700, "UC3"],
  [43400, "UC4"], [44000, "UC5"], [44700, "UC6"], [45400, "UC7"],
  [46200, "UC8"], [46900, "UC9"],
  [47600, "UB"], [48300, "UB1"], [49000, "UB2"], [49800, "UB3"],
  [50500, "UB4"], [51300, "UB5"], [52000, "UB6"], [52800, "UB7"],
  [53600, "UB8"], [54400, "UB9"],
  [55200, "UA"], [55900, "UA1"], [56700, "UA2"], [57500, "UA3"],
  [58400, "UA4"], [59200, "UA5"], [60000, "UA6"], [60800, "UA7"],
  [61700, "UA8"], [62500, "UA9"],
  [63400, "US"], [64200, "US1"], [65100, "US2"], [66400, "US3"],
  [67700, "US4"], [69000, "US5"], [70300, "US6"], [71600, "US7"],
  [72900, "US8"], [74400, "US9"],
  [76000, "LG"],
];

export function gradeFor(total: number): string {
  let label = "G";
  for (const [threshold, g] of GRADE_TABLE) {
    if (total >= threshold) label = g;
    else break;
  }
  return label;
}

// ---------------------------------------------------------------------------
// Scenario bonus — small bump for owning scenario-favored skills.
// ---------------------------------------------------------------------------

export function scenarioBonus(
  scenario: Scenario,
  ownedSkillIds: string[]
): number {
  if (!scenario.favoredSkillIds?.length) return 0;
  const owned = new Set(ownedSkillIds);
  const hits = scenario.favoredSkillIds.filter((id) => owned.has(id)).length;
  return Math.min(0.05, hits * 0.01);  // capped at +5%
}

// ---------------------------------------------------------------------------
// Top-level
// ---------------------------------------------------------------------------

export function rateBuild(
  build: UmaBuild,
  uma: Uma,
  meeting: ChampionMeeting,
  scenario: Scenario,
  opts: { uniqueLevel?: number } = {}
): RatingResult {
  const stat = computeStatScore(build.stats);
  const sk = skillScore(build.skillIds);
  const uniqueLvl = opts.uniqueLevel ?? 6;       // assume MLB unique
  const unique = calcUniqueBonus(uma.rarity, uniqueLvl);
  const sBonus = scenarioBonus(scenario, build.skillIds);
  const base = stat + sk + unique;
  const total = Math.round(base * (1 + sBonus));

  const notes: string[] = [];
  const raceApt = raceAptitudeScore(build.aptitudes, meeting, build.preferredStyle);
  if (raceApt < -200)
    notes.push(`Race-specific aptitudes are weak (${raceApt}). Skill activations may suffer.`);
  if (build.stats.stamina < 450 && meeting.distance === "long")
    notes.push("Stamina under 450 will likely cause stamina-out in Long.");
  if (build.stats.speed < 900 && meeting.distance !== "long")
    notes.push("Speed under 900 is below meta for non-Long races.");
  if (sk < 5000)
    notes.push("Skill loadout looks thin — aim for at least 8-10 skills.");

  return {
    total,
    grade: gradeFor(total),
    breakdown: {
      statScore: stat,
      skillScore: sk,
      // Repurpose the aptitudeBonus slot: now holds unique bonus
      // (aptitudes are no longer part of total; shown elsewhere).
      aptitudeBonus: unique,
      scenarioBonus: Math.round(sBonus * 100),
    },
    notes,
  };
}

export function estimateBaselineRating(
  uma: Uma,
  meeting: ChampionMeeting,
  scenario: Scenario
): RatingResult {
  const trained: Stats = {
    speed: 600 + uma.baseStats.speed * 4 + uma.growthRates.speed * 6,
    stamina: 600 + uma.baseStats.stamina * 3 + uma.growthRates.stamina * 6,
    power: 600 + uma.baseStats.power * 3 + uma.growthRates.power * 6,
    guts: 400 + uma.baseStats.guts * 2 + uma.growthRates.guts * 4,
    wit: 400 + uma.baseStats.wit * 2 + uma.growthRates.wit * 4,
  };
  const skills = [uma.uniqueSkillId, ...uma.awakeningSkillIds].filter(Boolean);
  const build: UmaBuild = {
    umaId: uma.id,
    meetingId: meeting.id,
    scenarioId: scenario.id,
    cardIds: [],
    stats: trained,
    aptitudes: uma.aptitudes,
    skillIds: skills,
    preferredStyle: uma.preferredStyle,
  };
  return rateBuild(build, uma, meeting, scenario);
}

export function aggregateOwnedSkills(
  uma: Uma,
  cardIds: string[],
  extraSkillIds: string[]
): Skill[] {
  const ids = new Set<string>();
  ids.add(uma.uniqueSkillId);
  for (const s of uma.awakeningSkillIds) ids.add(s);
  for (const s of extraSkillIds) ids.add(s);
  void cardIds;
  return [...ids].map((id) => skillById.get(id)!).filter(Boolean);
}
