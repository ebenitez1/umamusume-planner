// Rating calculator — matches Umamusume's in-game "Score / Power" formula.
//
// Calibrated 2026-05 against a real Daiwa Scarlet Peak Blue build
// (in-game 20,289 → UG1). Formula:
//
//   total = stat_sum + aptitude_score + skill_score
//
// where:
//   stat_sum         = sum of all 5 stats, each capped at 1200
//   aptitude_score   = sum over all 10 aptitudes (2 surface + 4 distance +
//                      4 style) of grade values (S=+800 … G=-800)
//   skill_score      = sum over learned skills of a per-rarity base value
//                      (normal=400, rare=800, unique=1500)
//
// The race-specific aptitudes (meeting surface/distance/style) are
// surfaced as a separate breakdown line — they're a SUBSET of the total
// aptitude sum, useful for "is this build well-suited to this race?".

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
// Stats
// ---------------------------------------------------------------------------

/** Stat values capped at the in-game 1200 cap, summed equally. */
export function computeStatScore(stats: Stats): number {
  return (
    Math.min(1200, Math.max(0, stats.speed)) +
    Math.min(1200, Math.max(0, stats.stamina)) +
    Math.min(1200, Math.max(0, stats.power)) +
    Math.min(1200, Math.max(0, stats.guts)) +
    Math.min(1200, Math.max(0, stats.wit))
  );
}

// ---------------------------------------------------------------------------
// Aptitudes — additive grade values (S best, G worst).
// ---------------------------------------------------------------------------

const APTITUDE_VAL: Record<AptitudeGrade, number> = {
  S: 800,
  A: 600,
  B: 400,
  C: 200,
  D: 0,
  E: -200,
  F: -400,
  G: -800,
};

/** Total aptitude bonus = sum of grade values across all 10 aptitudes. */
export function computeAptitudeScore(apt: Aptitudes): number {
  return (
    APTITUDE_VAL[apt.surface.turf] +
    APTITUDE_VAL[apt.surface.dirt] +
    APTITUDE_VAL[apt.distance.sprint] +
    APTITUDE_VAL[apt.distance.mile] +
    APTITUDE_VAL[apt.distance.medium] +
    APTITUDE_VAL[apt.distance.long] +
    APTITUDE_VAL[apt.style.runner] +
    APTITUDE_VAL[apt.style.early] +
    APTITUDE_VAL[apt.style.late] +
    APTITUDE_VAL[apt.style.end]
  );
}

/** Aptitude score for the specific race traits (subset of total). */
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
// Skill score — per-rarity base value, summed across learned skills.
// ---------------------------------------------------------------------------

// Base game-score contribution per skill, by rarity. Calibrated so a
// representative late-game build of ~17 skills lands near in-game numbers.
const SKILL_SCORE_BASE: Record<Skill["rarity"], number> = {
  normal: 400,
  rare: 800,
  unique: 1500,
};

export function skillScore(skillIds: string[]): number {
  let total = 0;
  for (const id of skillIds) {
    const s = skillById.get(id);
    if (!s) continue;
    total += SKILL_SCORE_BASE[s.rarity] ?? 400;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Scenario bonus — preserved as a small multiplicative bump for
// scenario-favored skills the user actually owns. Tiny relative to the
// other components.
// ---------------------------------------------------------------------------

export function scenarioBonus(
  scenario: Scenario,
  ownedSkillIds: string[]
): number {
  if (!scenario.favoredSkillIds?.length) return 0;
  const owned = new Set(ownedSkillIds);
  const hits = scenario.favoredSkillIds.filter((id) => owned.has(id)).length;
  return Math.min(0.1, hits * 0.02);
}

// ---------------------------------------------------------------------------
// Letter grade table — calibrated against in-game UG1=20,289 sample.
// ---------------------------------------------------------------------------

const GRADE_TABLE: Array<[number, string]> = [
  [19500, "UG1"],
  [18000, "UE"],
  [16500, "UA"],
  [15000, "UB"],
  [13500, "UC"],
  [12500, "SS+"],
  [11500, "SS"],
  [10500, "S+"],
  [9500,  "S"],
  [8500,  "A+"],
  [7500,  "A"],
  [6500,  "B+"],
  [5500,  "B"],
  [4500,  "C+"],
  [3500,  "C"],
  [2500,  "D"],
  [1500,  "E"],
  [500,   "F"],
  [0,     "G"],
];

export function gradeFor(total: number): string {
  for (const [threshold, grade] of GRADE_TABLE) {
    if (total >= threshold) return grade;
  }
  return "G";
}

// ---------------------------------------------------------------------------
// Top-level rating
// ---------------------------------------------------------------------------

export function rateBuild(
  build: UmaBuild,
  _uma: Uma,
  meeting: ChampionMeeting,
  scenario: Scenario
): RatingResult {
  const statScore = computeStatScore(build.stats);
  const aptScore = computeAptitudeScore(build.aptitudes);
  const sScore = skillScore(build.skillIds);
  const sBonus = scenarioBonus(scenario, build.skillIds);
  const base = statScore + aptScore + sScore;
  const total = Math.round(base * (1 + sBonus));

  const notes: string[] = [];
  const raceApt = raceAptitudeScore(build.aptitudes, meeting, build.preferredStyle);
  if (raceApt < -200)
    notes.push(`Aptitudes for this race score ${raceApt} — an Aptitude Hint would help.`);
  if (build.stats.stamina < 450 && meeting.distance === "long")
    notes.push("Stamina under 450 will likely cause stamina-out in Long.");
  if (build.stats.speed < 900 && meeting.distance !== "long")
    notes.push("Speed under 900 is below meta for non-Long races.");
  if (sScore < 4000)
    notes.push("Skill loadout looks thin — aim for at least 8-10 skills.");

  return {
    total,
    grade: gradeFor(total),
    breakdown: {
      statScore,
      skillScore: sScore,
      // aptitudeBonus is now displayed as raw additive points (not %).
      aptitudeBonus: aptScore,
      scenarioBonus: Math.round(sBonus * 100),
    },
    notes,
  };
}

// Helper for cross-uma "what would this uma look like at typical training"
// (used by the recommender's top-5-umas panel).
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
