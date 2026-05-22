import type {
  AptitudeGrade,
  ChampionMeeting,
  RatingResult,
  Scenario,
  Skill,
  Stats,
  Uma,
  UmaBuild,
} from "../types";
import { skillById } from "../data";

// Effective stat value with diminishing returns above 1100 (community
// rule-of-thumb for the Umamusume stat-to-score curve).
function effectiveStat(s: number): number {
  const clipped = Math.max(0, Math.min(1200, s));
  if (clipped <= 1100) return clipped;
  return 1100 + (clipped - 1100) * 0.5;
}

const STAT_WEIGHTS: Record<keyof Stats, number> = {
  speed: 1.0,
  stamina: 1.0,
  power: 1.0,
  guts: 0.9,
  wit: 0.85,
};

export function computeStatScore(stats: Stats): number {
  let total = 0;
  for (const [k, v] of Object.entries(stats) as [keyof Stats, number][]) {
    total += effectiveStat(v) * STAT_WEIGHTS[k];
  }
  return total;
}

const APTITUDE_MULT: Record<AptitudeGrade, number> = {
  S: 1.15,
  A: 1.1,
  B: 1.05,
  C: 1.0,
  D: 0.93,
  E: 0.85,
  F: 0.75,
  G: 0.6,
};

export function aptitudeMultiplier(
  uma: Uma,
  meeting: ChampionMeeting,
  style: keyof Uma["aptitudes"]["style"]
): number {
  const apt = uma.aptitudes;
  const surface = APTITUDE_MULT[apt.surface[meeting.surface]];
  const distance = APTITUDE_MULT[apt.distance[meeting.distance]];
  const styleM = APTITUDE_MULT[apt.style[style]];
  // multiply but rein in extremes — perfect S across all three shouldn't 1.5x
  const combined = surface * distance * styleM;
  return Math.pow(combined, 0.7);
}

export function skillScore(skillIds: string[]): number {
  let total = 0;
  for (const id of skillIds) {
    const s = skillById.get(id);
    if (s) total += s.ratingPoints;
  }
  return total;
}

export function scenarioBonus(
  scenario: Scenario,
  ownedSkillIds: string[]
): number {
  if (!scenario.favoredSkillIds?.length) return 0;
  const owned = new Set(ownedSkillIds);
  const hits = scenario.favoredSkillIds.filter((id) => owned.has(id)).length;
  return Math.min(0.2, hits * 0.05);
}

// Letter grade thresholds, calibrated against in-game "Power" displays for
// fully-trained 3-star umas at L4 fan score. Tune as we collect real samples.
const GRADE_TABLE: Array<[number, string]> = [
  [17000, "UG1"],
  [16000, "UE"],
  [15000, "UA"],
  [14000, "UB"],
  [13000, "UC"],
  [12500, "SS+"],
  [12000, "SS"],
  [11500, "S+"],
  [11000, "S"],
  [10000, "A+"],
  [9000, "A"],
  [8000, "B+"],
  [7000, "B"],
  [6000, "C+"],
  [5000, "C"],
  [4000, "D"],
  [3000, "E"],
  [2000, "F"],
  [0, "G"],
];

export function gradeFor(total: number): string {
  for (const [threshold, grade] of GRADE_TABLE) {
    if (total >= threshold) return grade;
  }
  return "G";
}

export function rateBuild(
  build: UmaBuild,
  uma: Uma,
  meeting: ChampionMeeting,
  scenario: Scenario
): RatingResult {
  const statScore = computeStatScore(build.stats);
  const sScore = skillScore(build.skillIds);
  const aptMult = aptitudeMultiplier(uma, meeting, build.preferredStyle);
  const sBonus = scenarioBonus(scenario, build.skillIds);

  const base = statScore + sScore;
  const total = Math.round(base * aptMult * (1 + sBonus));

  const notes: string[] = [];
  if (aptMult < 0.85)
    notes.push(
      "Aptitudes are working against you for this race — consider an Aptitude Hint book if available."
    );
  if (build.stats.stamina < 450 && meeting.distance === "long")
    notes.push("Stamina under 450 will likely cause stamina-out in Long.");
  if (build.stats.speed < 900 && meeting.distance !== "long")
    notes.push("Speed under 900 is below meta for non-Long races.");
  if (sScore < 400)
    notes.push("Skill loadout looks thin — aim for 8-12 useful skills.");

  return {
    total,
    grade: gradeFor(total),
    breakdown: {
      statScore: Math.round(statScore),
      skillScore: sScore,
      aptitudeBonus: Math.round((aptMult - 1) * 100),
      scenarioBonus: Math.round(sBonus * 100),
    },
    notes,
  };
}

// Helper used by the UmaPicker / Recommender to estimate a uma's ceiling
// for a given meeting using just baseline stats + their awakening skills.
export function estimateBaselineRating(
  uma: Uma,
  meeting: ChampionMeeting,
  scenario: Scenario
): RatingResult {
  // approximate "fully trained" stats from baseStats + growthRates
  const trained: Stats = {
    speed: 600 + uma.baseStats.speed * 4 + uma.growthRates.speed * 6,
    stamina: 600 + uma.baseStats.stamina * 3 + uma.growthRates.stamina * 6,
    power: 600 + uma.baseStats.power * 3 + uma.growthRates.power * 6,
    guts: 400 + uma.baseStats.guts * 2 + uma.growthRates.guts * 4,
    wit: 400 + uma.baseStats.wit * 2 + uma.growthRates.wit * 4,
  };
  const skills = [uma.uniqueSkillId, ...uma.awakeningSkillIds];
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
  // Cards expose their teachable skills; we don't auto-add them
  // (the user has to learn them in training) but we surface them for
  // the recommender to pick from.
  void cardIds;
  return [...ids].map((id) => skillById.get(id)!).filter(Boolean);
}
