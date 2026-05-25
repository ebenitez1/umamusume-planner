// Pure transforms from UmaTools' raw JSON shapes (game-extracted dumps)
// to our internal Uma / Skill / SupportCard / ChampionMeeting types.
//
// Constants below were decoded by sampling the dataset committed at
// src/data/generated/umatools/. See src/data/generated/umatools/_meta.json
// for the pinned SHA.
import type {
  Aptitudes,
  AptitudeGrade,
  CardRarity,
  CardType,
  ChampionMeeting,
  Distance,
  Skill,
  SkillCategory,
  SkillRarity,
  Stats,
  Style,
  SupportCard,
  Surface,
  Uma,
} from "../../types";

// -----------------------------------------------------------------------------
// UmaTools raw shapes (subset of fields we use)
// -----------------------------------------------------------------------------
export interface RawStats {
  Speed: number;
  Stamina: number;
  Power: number;
  Guts: number;
  Wit: number;
}

export interface RawUma {
  UmaKey: string;
  UmaName: string;
  UmaNameJP?: string | null;
  UmaNickname?: string | null;
  UmaNicknameJP?: string | null;
  UmaSlug: string;          // e.g. "100101-special-week"
  UmaId: string;            // outfit ID e.g. "100101"
  UmaServer: string;        // "global" | "japan"
  UmaBaseStars: number;     // 1, 2, or 3
  UmaBaseStats: Record<string, RawStats>; // keyed by "3★"/"4★"/"5★"
  UmaStatBonuses: RawStats;
  UmaAptitudes: {
    Surface: { Turf: AptitudeGrade; Dirt: AptitudeGrade };
    Distance: {
      Short: AptitudeGrade;
      Mile: AptitudeGrade;
      Medium: AptitudeGrade;
      Long: AptitudeGrade;
    };
    Strategy: {
      Front: AptitudeGrade;
      Pace: AptitudeGrade;
      Late: AptitudeGrade;
      End: AptitudeGrade;
    };
  };
  UmaImage?: string | null;
}

export interface RawSkillEffect {
  type: number;
  value: number;
}
export interface RawSkillConditionGroup {
  base_time?: number;
  condition?: string;
  precondition?: string;
  effects: RawSkillEffect[];
}
export interface RawSkill {
  id: number;
  name_en?: string;
  enname?: string;
  desc_en?: string;
  endesc?: string;
  jpname?: string;
  jpdesc?: string;
  rarity: number;           // 1..6 — see SKILL_RARITY_MAP
  type: string[];           // tag codes, e.g. ["ldr","l_1","f_c"] — see SKILL_TAG_MAP
  iconid?: number;
  char?: number[];          // outfit IDs that own this skill (uniques) or can learn it
  condition_groups?: RawSkillConditionGroup[];
  gene_version?: { id?: number; cost?: number; name_en?: string };
  activation?: number;
}

export interface RawSupportEffect {
  id: number;
  name: string;
  symbol: string;
  values: number[];          // index = level (0..10), MLB ≈ index 10
}
export interface RawSupport {
  SupportId: string;         // numeric string
  SupportName: string;       // e.g. "Silence Suzuka (SSR)"
  SupportNameJP?: string;
  SupportSlug: string;       // e.g. "30002-silence-suzuka"
  SupportRarity: CardRarity;
  SupportServer: string;     // "global" | "japan"
  SupportType: string;       // "Speed" | "Stamina" | "Power" | "Guts" | "Wit" | "Friend"
  SupportEffects?: RawSupportEffect[];
  SupportImage?: string;
}

export interface RawRace {
  id: number;
  race_id: number;
  name: string;              // JP
  name_en: string;
  venue: string;             // JP
  track_id: number;
  course_id: number;
  distance: number;          // meters
  terrain: number;           // 1 = turf, 2 = dirt
  grade: number;             // 100=G1, 200=G2, 300=G3, 400=OP/Listed, 700=other
  group?: number | null;
  season?: number | null;
  entries?: number | null;
  // course segment lengths (used by future race simulator)
  gt?: number | null; ls?: number | null; fc?: number | null; fs?: number | null;
  us?: unknown[]; ds?: unknown[];
  instances?: Array<{ year: number; month: number; half: number }> | null;
}

// -----------------------------------------------------------------------------
// Decoding tables
// -----------------------------------------------------------------------------

// UmaTools rarity → our SkillRarity. Verified by sampling skills_all.json:
//   1 (564) — base/normal skills (white)
//   2 (326) — rare (gold)
//   3 ( 22) — rare base, upgrades to 4
//   4 ( 22) — rare upgraded
//   5 (235) — inherited (purple) — parent_skills present
//   6 (627) — unique (pink) — IDs like 1001XXXXX, character-specific
const SKILL_RARITY_MAP: Record<number, SkillRarity> = {
  1: "normal",
  2: "rare",
  3: "rare",
  4: "rare",
  5: "rare",     // inherited — we treat as rare for the heuristic
  6: "unique",
};

// UmaTools effect type IDs (from condition_groups[].effects[].type).
// 27 = velocity boost (speed). 9 = accel. 21 = stamina recovery.
// Refined as we cross-check more skills; for now category drives mostly off `type` tags.
const EFFECT_TYPE_TO_KIND: Record<number, NonNullable<Skill["sim"]>["effectKind"]> = {
  27: "speed",
  9: "accel",
  2: "heal",
  21: "heal",
  31: "debuff",
};

// UmaTools `type` field is a CSV of tag codes. Decoded from the histogram.
// We map to our SkillCategory (best-fit) + tags (style/distance/phase).
const STYLE_TAG: Record<string, Style> = {
  run: "runner",
  ldr: "early",
  btw: "late",
  cha: "end",
};
const DISTANCE_TAG: Record<string, Distance> = {
  sho: "sprint",
  mil: "mile",
  med: "medium",
  lng: "long",
};
const SURFACE_TAG: Record<string, Surface> = {
  tur: "turf",
  dir: "dirt",
};
const PHASE_TAG: Record<string, "opening" | "middle" | "final" | "spurt"> = {
  l_0: "opening",
  l_1: "middle",
  l_2: "final",
  l_3: "spurt",
};

// Venue JP → English (used by races.json venue field).
const VENUE_EN: Record<string, string> = {
  札幌: "Sapporo",
  函館: "Hakodate",
  福島: "Fukushima",
  新潟: "Niigata",
  中山: "Nakayama",
  東京: "Tokyo",
  中京: "Chukyo",
  京都: "Kyoto",
  阪神: "Hanshin",
  小倉: "Kokura",
  大井: "Ōi",
  船橋: "Funabashi",
  盛岡: "Morioka",
  佐賀: "Saga",
  ロンシャン: "Longchamp",
  サンタアニタパーク: "Santa Anita Park",
};

// Race grade code → human label.
const GRADE_LABEL: Record<number, string> = {
  100: "G1",
  200: "G2",
  300: "G3",
  400: "OP/Listed",
  700: "Special",
};

// Support effect IDs we actually consume.
const EFFECT_FRIENDSHIP = 1;
const EFFECT_TRAINING_BONUS_BY_TYPE: Record<CardType, number> = {
  speed: 3,
  stamina: 4,
  power: 5,
  guts: 6,
  wit: 7,
  friend: 8, // Friend cards: use Training Effectiveness
};

// MLB = level 4 = index 10 in the 11-element values array (0..10).
const MLB_INDEX = 10;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function tagsFor(typeCodes: string[]): {
  category: SkillCategory;
  tags: NonNullable<Skill["tags"]>;
} {
  const codes = typeCodes ?? [];
  const styles = new Set<Style>();
  const distances = new Set<Distance>();
  const surfaces = new Set<Surface>();
  const phases = new Set<"opening" | "middle" | "final" | "spurt">();
  let isDebuff = false;
  let isPositional = false;
  for (const c of codes) {
    if (STYLE_TAG[c]) styles.add(STYLE_TAG[c]);
    if (DISTANCE_TAG[c]) distances.add(DISTANCE_TAG[c]);
    if (SURFACE_TAG[c]) surfaces.add(SURFACE_TAG[c]);
    if (PHASE_TAG[c]) phases.add(PHASE_TAG[c]);
    if (c === "dbf") isDebuff = true;
    if (c === "cor" || c === "str" || c === "slo") isPositional = true;
  }
  let category: SkillCategory = "passive";
  if (isDebuff) category = "debuff";
  else if (phases.has("spurt") || phases.has("final")) category = "speed";
  else if (isPositional) category = "positional";
  else if (codes.includes("nac")) category = "passive";
  return {
    category,
    tags: {
      styles: [...styles],
      distances: [...distances],
      surfaces: [...surfaces],
      phase: [...phases],
    },
  };
}

function ratingPointsFor(raw: RawSkill, category: SkillCategory): number {
  // Heuristic: scale by rarity, bump for known categories.
  const base =
    raw.rarity === 6 ? 260 :          // unique
    raw.rarity >= 2 ? 150 :           // rare/golden/inherited
    80;                               // normal
  if (raw.gene_version?.cost) {
    // Cost-based scaling when available, capped.
    return Math.min(320, Math.round(raw.gene_version.cost * 0.85));
  }
  const bump =
    category === "speed" ? 20 :
    category === "acceleration" ? 25 :
    category === "recovery" || category === "heal" ? 30 :
    category === "debuff" ? 10 :
    0;
  return base + bump;
}

function lowercaseStats(s: RawStats): Stats {
  return {
    speed: s.Speed,
    stamina: s.Stamina,
    power: s.Power,
    guts: s.Guts,
    wit: s.Wit,
  };
}

// In-game distance classification:
//   Sprint: under 1400m  (typically 1000–1399, e.g. 1200m Takamatsunomiya)
//   Mile:   1400–1799    (e.g. 1600m NHK Mile Cup, Yasuda Kinen)
//   Medium: 1800–2400    (e.g. 2000m Satsuki Sho, 2400m Japanese Oaks)
//   Long:   2401+        (e.g. 2500m Arima Kinen, 3000m Kikuka Sho)
function distanceBucket(meters: number): Distance {
  if (meters < 1400) return "sprint";
  if (meters < 1800) return "mile";
  if (meters <= 2400) return "medium";
  return "long";
}

function preferredStyleFrom(apt: RawUma["UmaAptitudes"]): Style {
  // Pick whichever Strategy has the highest aptitude (S>A>B>C>D>E>F>G).
  const rank: Record<AptitudeGrade, number> = {
    S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7,
  };
  const candidates: Array<[Style, AptitudeGrade]> = [
    ["runner", apt.Strategy.Front],
    ["early", apt.Strategy.Pace],
    ["late", apt.Strategy.Late],
    ["end", apt.Strategy.End],
  ];
  candidates.sort((a, b) => rank[a[1]] - rank[b[1]]);
  return candidates[0][0];
}

// -----------------------------------------------------------------------------
// Skill transform
// -----------------------------------------------------------------------------
export function transformSkill(raw: RawSkill): Skill {
  // After fetch-time slimming, raw.name_en holds the Global game text
  // (UmaTools' `name_en` field — verified against kachi-dev's authoritative
  // Global dump). data/index.ts may additionally override with kachi-dev's
  // skillnames.json for the 462 skills it covers.
  const name = raw.name_en || raw.enname || raw.jpname || `Skill ${raw.id}`;
  const description = raw.desc_en || raw.endesc || raw.jpdesc || "";
  const { category, tags } = tagsFor(raw.type || []);
  const rarity = SKILL_RARITY_MAP[raw.rarity] ?? "normal";
  const ratingPoints = ratingPointsFor(raw, category);

  let sim: Skill["sim"];
  const cg = raw.condition_groups?.[0];
  if (cg) {
    const eff = cg.effects?.[0];
    sim = {
      trigger: [cg.precondition, cg.condition].filter(Boolean).join(" && ") || undefined,
      effectKind: eff && EFFECT_TYPE_TO_KIND[eff.type],
      effectValue: eff?.value !== undefined ? eff.value / 10000 : undefined,
      durationS: cg.base_time ? cg.base_time / 10000 : undefined,
    };
  }

  return {
    id: String(raw.id),
    name,
    rarity,
    category,
    description,
    iconid: raw.iconid,
    ratingPoints,
    sim,
    tags,
  };
}

// -----------------------------------------------------------------------------
// Uma transform
//
// `skillIndex` maps outfit ID → skill IDs they own (built from skills_all.json
// `char` arrays). Pass null on first pass; refine later.
// -----------------------------------------------------------------------------
export function transformUma(
  raw: RawUma,
  skillIndex: Map<string, { uniqueId?: string; learnable: string[] }> | null
): Uma {
  const idx = skillIndex?.get(raw.UmaId);
  const stars = `${raw.UmaBaseStars}★`;
  // Prefer 5★ stats when available (they exist for every uma in the dataset);
  // fall back to the uma's base star tier.
  const rawStats = raw.UmaBaseStats["5★"] ?? raw.UmaBaseStats[stars] ?? raw.UmaBaseStats["3★"];
  const baseStats: Stats = lowercaseStats(rawStats);
  const apt = raw.UmaAptitudes;
  const aptitudes: Aptitudes = {
    surface: { turf: apt.Surface.Turf, dirt: apt.Surface.Dirt },
    distance: {
      sprint: apt.Distance.Short,
      mile: apt.Distance.Mile,
      medium: apt.Distance.Medium,
      long: apt.Distance.Long,
    },
    style: {
      runner: apt.Strategy.Front,
      early: apt.Strategy.Pace,
      late: apt.Strategy.Late,
      end: apt.Strategy.End,
    },
  };
  const gameId = Number(raw.UmaId);
  const fullName =
    raw.UmaNickname && raw.UmaNickname !== raw.UmaName
      ? `${raw.UmaName} — ${raw.UmaNickname}`
      : raw.UmaName;

  return {
    id: String(gameId),
    gameId,
    name: fullName,
    nameJp: raw.UmaNameJP ?? undefined,
    rarity: (raw.UmaBaseStars as 1 | 2 | 3) ?? 3,
    preferredStyle: preferredStyleFrom(apt),
    baseStats,
    growthRates: lowercaseStats(raw.UmaStatBonuses),
    aptitudes,
    uniqueSkillId: idx?.uniqueId ?? "",
    awakeningSkillIds: idx?.learnable ?? [],
    thumbImg: raw.UmaImage ?? undefined,
    preferredUrl: raw.UmaSlug,
  };
}

// Build outfit_id → { uniqueId, learnable[] } from skills_all.json. A skill is
// considered "owned/learnable" by an outfit if its `char` array includes that
// outfit ID. Uniques (rarity 6) become uniqueSkillId; everything else goes
// into learnable[].
export function buildSkillIndex(
  rawSkills: RawSkill[]
): Map<string, { uniqueId?: string; learnable: string[] }> {
  const out = new Map<string, { uniqueId?: string; learnable: string[] }>();
  for (const s of rawSkills) {
    if (!s.char?.length) continue;
    for (const c of s.char) {
      const key = String(c);
      const entry = out.get(key) ?? { learnable: [] };
      if (s.rarity === 6 && !entry.uniqueId) {
        entry.uniqueId = String(s.id);
      } else {
        entry.learnable.push(String(s.id));
      }
      out.set(key, entry);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Support transform
//
// `charLookup` resolves a support's owning-character outfit ID to the
// corresponding character outfit ID (so the deck builder can show which uma
// the card belongs to). Built from the support's slug prefix.
// -----------------------------------------------------------------------------
export function transformSupport(raw: RawSupport): SupportCard {
  const type = raw.SupportType.toLowerCase() as CardType;
  const effects = new Map((raw.SupportEffects ?? []).map((e) => [e.id, e]));
  const friendship = effects.get(EFFECT_FRIENDSHIP)?.values?.[MLB_INDEX] ?? 0;
  const trainingBonusId = EFFECT_TRAINING_BONUS_BY_TYPE[type];
  const training = effects.get(trainingBonusId)?.values?.[MLB_INDEX] ?? 0;
  return {
    id: raw.SupportId,
    apiId: Number(raw.SupportId),
    name: raw.SupportName,
    title: raw.SupportName,
    type,
    rarity: raw.SupportRarity,
    charaName: raw.SupportName.replace(/\s*\([RS]+\)\s*$/, "").trim(),
    gametoraSlug: raw.SupportSlug,
    iconUrl: raw.SupportImage ?? undefined,
    // Card → taught skills is derived later in data/index.ts (we need
    // access to the skill index built from skills_all.json).
    taughtSkillIds: [],
    trainingBonusPct: training,
    friendshipBonusPct: friendship,
    hasGameplay: true,
  };
}

// -----------------------------------------------------------------------------
// Race transform — exposes every game race as a "ChampionMeeting candidate"
// the user can pick to test a build against.
// -----------------------------------------------------------------------------
export function transformRace(raw: RawRace): ChampionMeeting {
  const venueEn = VENUE_EN[raw.venue] ?? raw.venue;
  const surface: Surface = raw.terrain === 2 ? "dirt" : "turf";
  const distance = distanceBucket(raw.distance);
  const grade = GRADE_LABEL[raw.grade] ?? `Grade ${raw.grade}`;
  const name = raw.name_en && raw.name_en !== raw.name
    ? `${raw.name_en} (${venueEn} ${raw.distance}m ${surface})`
    : `${venueEn} ${raw.distance}m ${surface}`;
  return {
    id: String(raw.id),
    name,
    track: venueEn,
    surface,
    distance,
    distanceMeters: raw.distance,
    notes: `${grade}. Field: ${raw.entries ?? "?"}. Final corner: ${raw.fc ?? "?"}m, final straight: ${raw.fs ?? "?"}m.`,
  };
}

// Convenience: filter to "global" server entries — UmaTools includes Japan-
// only umas and cards as well, and we only want Global-aligned data.
export function isGlobalUma(r: RawUma): boolean {
  return r.UmaServer === "global";
}
export function isGlobalSupport(r: RawSupport): boolean {
  return r.SupportServer === "global";
}
