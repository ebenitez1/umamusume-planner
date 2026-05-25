export type StatKey = "speed" | "stamina" | "power" | "guts" | "wit";

export type Stats = Record<StatKey, number>;

export type AptitudeGrade = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Surface = "turf" | "dirt";
export type Distance = "sprint" | "mile" | "medium" | "long";
export type Style = "runner" | "early" | "late" | "end";

export interface Aptitudes {
  surface: Record<Surface, AptitudeGrade>;
  distance: Record<Distance, AptitudeGrade>;
  style: Record<Style, AptitudeGrade>;
}

export type SkillRarity = "normal" | "rare" | "unique";
export type SkillCategory =
  | "speed"
  | "acceleration"
  | "recovery"
  | "passive"
  | "debuff"
  | "vision"
  | "positional"
  | "heal";

export interface Skill {
  id: string;
  name: string;
  rarity: SkillRarity;
  category: SkillCategory;
  description: string;
  // numeric icon ID — pair with skillIconUrl() to get a CDN image
  iconid?: number;
  // numeric "rating points" contributed when owned (community heuristic)
  ratingPoints: number;
  // optional sim metadata — used by the future race simulator
  sim?: {
    trigger?: string;       // free-form key e.g. "last_leg && in_front"
    effectKind?: "speed" | "accel" | "heal" | "buff" | "debuff";
    effectValue?: number;   // e.g. +0.35 (speed)
    durationS?: number;     // seconds
    cooldownS?: number;
  };
  // contextual tags used by the recommender
  tags?: {
    styles?: Style[];        // running styles that benefit
    distances?: Distance[];  // distances that benefit
    surfaces?: Surface[];
    phase?: ("opening" | "middle" | "final" | "spurt")[];
    terrain?: ("corner" | "straight" | "slope")[];  // course-feature gating
  };
}

export interface Uma {
  id: string;                // string form of game_id, e.g. "1001"
  gameId: number;            // umapyoi game_id
  name: string;              // English name
  nameJp?: string;
  rarity: 1 | 2 | 3;         // star rating
  preferredStyle: Style;
  baseStats: Stats;          // at limit break, fully bonded — game baseline
  growthRates: Stats;        // % bonus per training, e.g. { speed: 10, ... }
  aptitudes: Aptitudes;
  uniqueSkillId: string;
  awakeningSkillIds: string[];
  // catalog metadata from umapyoi
  thumbImg?: string;
  colorMain?: string;
  preferredUrl?: string;
  // true when we have no gameplay overlay yet (stats/aptitudes are defaults)
  unplayable?: boolean;
}

export type CardType = "speed" | "stamina" | "power" | "guts" | "wit" | "friend";
export type CardRarity = "R" | "SR" | "SSR";

export interface SupportCard {
  id: string;                  // string form of umapyoi id, e.g. "30001"
  apiId: number;               // umapyoi id
  name: string;                // English title with character prefix
  title?: string;              // just the bracketed title from API
  type: CardType;
  rarity: CardRarity;
  charaGameId?: number;        // owning character's game_id
  charaName?: string;          // English name of owning character
  gametoraSlug?: string;       // join key to GameTora
  iconUrl?: string;
  // gameplay overlay — empty array if we don't have curated data yet
  taughtSkillIds: string[];
  trainingBonusPct: number;
  friendshipBonusPct: number;
  hasGameplay: boolean;        // false when no overlay; UI can dim it
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  // multipliers applied during recommender/rating heuristics
  statMultipliers?: Partial<Record<StatKey, number>>;
  // skills strongly favored in this scenario
  favoredSkillIds?: string[];
  // free-form notes for the UI
  notes?: string;
}

export interface ChampionMeeting {
  id: string;
  name: string;
  // Global Champion Meeting number, e.g. 1 for CM1. Optional — only set
  // for featured meetings that have actually been a Champion Meeting.
  cmNumber?: number;
  // race shape
  track: string;             // venue name e.g. "Tokyo Racecourse"
  trackId?: number;          // gametora venue id (1xxxx) — for the icon CDN
  surface: Surface;
  distance: Distance;
  distanceMeters: number;    // exact m
  // hint for the recommender: which styles historically dominate
  metaStyles?: Style[];
  // notable course traits (final straight, slopes, corners)
  notes?: string;
  // Full course geometry (corners + slopes), populated from kachi-dev's
  // course_data.json when the race's course_id is in their dataset.
  geometry?: CourseGeometry;
}

export interface CourseGeometry {
  /** All corner regions on the course, ordered by start position. */
  corners: Array<{ start: number; length: number }>;
  /** Slope sections. Positive `slope` = uphill, negative = downhill. */
  slopes: Array<{ start: number; length: number; slope: number }>;
  /** Straight sections (between corners). */
  straights: Array<{ start: number; end: number }>;
}

export interface UmaBuild {
  umaId: string;
  meetingId: string;
  scenarioId: string;
  cardIds: string[];          // up to 6 in normal training
  stats: Stats;
  aptitudes: Aptitudes;       // copied/overridden from uma
  skillIds: string[];         // skills the uma has learned
  preferredStyle: Style;
}

export interface RatingResult {
  total: number;
  grade: string;
  breakdown: {
    statScore: number;
    skillScore: number;
    aptitudeBonus: number;
    scenarioBonus: number;
  };
  notes: string[];
}

export interface SkillRecommendation {
  skill: Skill;
  priority: "core" | "strong" | "nice-to-have" | "avoid";
  reasons: string[];
  source?: { fromCardId?: string; fromUmaId?: string; manual?: boolean };
}

export interface UmaRecommendation {
  uma: Uma;
  style: Style;
  rationale: string[];
  expectedGrade: string;
}
