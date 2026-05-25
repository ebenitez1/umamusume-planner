// Data layer.
//
// Sources, in priority order:
//   1. UmaTools dumps (src/data/generated/umatools/) — game-extracted truth,
//      Global server filtered. Drives umas + skills + cards + races.
//   2. umapyoi catalog (src/data/generated/) — used purely as a catalog
//      enrichment layer for thumbnails / colors / JP-name cross-check.
//   3. Hand-curated gameplay (src/data/gameplay/) — only scenarios and a
//      featured-champion-meetings list remain hand-curated; everything else
//      is now UmaTools-derived.
import rawCharacters from "./generated/characters.json";
import rawSupports from "./generated/supports.json";

import umatoolsUmas from "./generated/umatools/uma_data.json";
import umatoolsSkills from "./generated/umatools/skills_all.json";
import umatoolsSupports from "./generated/umatools/support_hints.json";
import umatoolsRaces from "./generated/umatools/races.json";
import kachiSkillnames from "./generated/umatools/kachi_skillnames.json";
import kachiCourses from "./generated/umatools/kachi_courses.json";

import scenariosRaw from "./gameplay/scenarios.json";
import featuredMeetingsRaw from "./gameplay/champion-meetings.json";

import type {
  ChampionMeeting,
  Scenario,
  Skill,
  SupportCard,
  Uma,
} from "../types";

import {
  buildSkillIndex,
  isGlobalSupport,
  isGlobalUma,
  transformRace,
  transformSkill,
  transformSupport,
  transformUma,
  type RawRace,
  type RawSkill,
  type RawSupport,
  type RawUma,
} from "./transforms/umatools";

// ---------------------------------------------------------------------------
// SCENARIOS — hand-curated (UmaTools has no scenario data)
// ---------------------------------------------------------------------------
export const scenarios: Scenario[] = scenariosRaw as Scenario[];
export const scenarioById = new Map(scenarios.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// SKILLS — fully from UmaTools
// ---------------------------------------------------------------------------
const rawSkills = umatoolsSkills as unknown as RawSkill[];

// Build outfit_id → owned/learnable skill IDs once, used by uma transform.
const skillIndex = buildSkillIndex(rawSkills);

// kachi-dev's Global-server skillname dump — authoritative for the 462 skills
// it covers. We override transformed Skill.name where present.
const kachiNames = kachiSkillnames as Record<string, string>;

export const skills: Skill[] = rawSkills.map((raw) => {
  const transformed = transformSkill(raw);
  const kachi = kachiNames[String(raw.id)];
  if (kachi) transformed.name = kachi;
  return transformed;
});
export const skillById = new Map(skills.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// UMAS — UmaTools primary, enriched with umapyoi catalog for thumb/color
// ---------------------------------------------------------------------------
interface ApiCharacter {
  game_id: number;
  name_en: string;
  name_jp: string;
  thumb_img?: string | null;
  color_main?: string | null;
  preferred_url?: string;
}
const apiCharacters = rawCharacters as ApiCharacter[];

// umapyoi's `game_id` is the character ID (1001), while UmaTools' `UmaId` is
// the outfit ID (100101). The base char ID = floor(outfit_id / 100).
const charByGameId = new Map(apiCharacters.map((c) => [c.game_id, c]));

const umatoolsUmasGlobal = (umatoolsUmas as unknown as RawUma[]).filter(isGlobalUma);

export const umas: Uma[] = umatoolsUmasGlobal.map((u) => {
  const transformed = transformUma(u, skillIndex);
  // Try to enrich with umapyoi catalog (thumb, color) by character ID.
  const charId = Math.floor(transformed.gameId / 100);
  const cat = charByGameId.get(charId);
  if (cat) {
    transformed.thumbImg ||= cat.thumb_img ?? undefined;
    transformed.colorMain ||= cat.color_main ?? undefined;
    // Prefer umapyoi's JP name if UmaTools didn't have one.
    transformed.nameJp ||= cat.name_jp;
  }
  return transformed;
});

umas.sort((a, b) => a.name.localeCompare(b.name));

export const umaById = new Map(umas.map((u) => [u.id, u]));
export const umaByGameId = new Map(umas.map((u) => [u.gameId, u]));

// ---------------------------------------------------------------------------
// SUPPORT CARDS — UmaTools primary, enriched with umapyoi (gametora slug)
// ---------------------------------------------------------------------------
interface ApiSupport {
  id: number;
  chara_id: number;
  gametora: string;
  title_en: string;
  rarity?: number;
  rarity_string?: string;
  type?: string;
  type_icon_url?: string;
}
const apiSupports = rawSupports as ApiSupport[];
const apiSupportById = new Map(apiSupports.map((s) => [s.id, s]));

// Build card → taught skill IDs from skillIndex (skills owned by the support's
// owning character outfit are what the card teaches).
function cardTaughtSkills(charaGameId: number | undefined): string[] {
  if (!charaGameId) return [];
  // Cards reference the character chara_id (e.g. 1001), but skills index keys
  // are outfit IDs (100101). Sum across all outfits of the character.
  const outfitPrefix = String(charaGameId);
  const ids = new Set<string>();
  for (const [outfitId, entry] of skillIndex) {
    if (outfitId.startsWith(outfitPrefix)) {
      if (entry.uniqueId) ids.add(entry.uniqueId);
      for (const s of entry.learnable) ids.add(s);
    }
  }
  return [...ids];
}

const umatoolsSupportsGlobal = (umatoolsSupports as unknown as RawSupport[]).filter(isGlobalSupport);

export const cards: SupportCard[] = umatoolsSupportsGlobal.map((s) => {
  const transformed = transformSupport(s);
  // Enrich from umapyoi if available — adds chara_id, type_icon_url.
  const cat = apiSupportById.get(transformed.apiId);
  if (cat) {
    transformed.charaGameId ||= cat.chara_id;
    transformed.gametoraSlug ||= cat.gametora;
    transformed.iconUrl ||= cat.type_icon_url;
  }
  // Derive taught skills via the skill index.
  transformed.taughtSkillIds = cardTaughtSkills(transformed.charaGameId);
  return transformed;
});

// Sort: SSR before SR before R, then by name within rarity.
const RARITY_RANK: Record<SupportCard["rarity"], number> = { SSR: 0, SR: 1, R: 2 };
cards.sort((a, b) => {
  if (RARITY_RANK[a.rarity] !== RARITY_RANK[b.rarity])
    return RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity];
  return a.name.localeCompare(b.name);
});

export const cardById = new Map(cards.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// CHAMPION MEETINGS — UmaTools races + featured hand-curated picks on top
// ---------------------------------------------------------------------------
const featuredMeetings: ChampionMeeting[] = featuredMeetingsRaw as ChampionMeeting[];

// All G1/G2 races from UmaTools become selectable.
const allRaces = (umatoolsRaces as unknown as RawRace[]).filter((r) => r.grade <= 200);
const courseGeometryById = kachiCourses as Record<string, {
  distance: number;
  corners: Array<{ start: number; length: number }>;
  slopes: Array<{ start: number; length: number; slope: number }>;
  straights: Array<{ start: number; end: number }>;
}>;
const transformedRaces = allRaces.map((r) =>
  transformRace(r, courseGeometryById[String(r.course_id)])
);

// Enrich each featured meeting with course geometry from a matching race
// (by track + distance + surface). The hand-curated featured list was
// authored before course geometry existed; without this lookup the
// RaceTrack viz for CM1-14 would render with no corners or slopes.
function findGeometryFor(m: ChampionMeeting) {
  const match = transformedRaces.find(
    (r) =>
      r.track === m.track &&
      r.distanceMeters === m.distanceMeters &&
      r.surface === m.surface &&
      r.geometry
  );
  return match?.geometry;
}
const enrichedFeatured = featuredMeetings.map((m) =>
  m.geometry ? m : { ...m, geometry: findGeometryFor(m) }
);

export const championMeetings: ChampionMeeting[] = [
  // Featured / hand-curated meetings render first.
  ...enrichedFeatured,
  // Then the rest of the G1/G2 game races, deduped by id-collision avoidance
  // (we prefix UmaTools race IDs since the namespaces differ).
  ...transformedRaces.filter((r) => !enrichedFeatured.some((f) => f.name === r.name)),
];

export const meetingById = new Map(championMeetings.map((m) => [m.id, m]));

// ---------------------------------------------------------------------------
// DIAGNOSTICS — handy for dev console / future "about data" UI
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// IMAGE HELPERS
// ---------------------------------------------------------------------------
// Skill icons are hosted at GameTora's CDN, looked up by `iconid`. The icon
// pattern was probed and confirmed; URL is stable as of 2026-05.
export function skillIconUrl(iconid: number | undefined): string | undefined {
  if (!iconid) return undefined;
  return `https://gametora.com/images/umamusume/skill_icons/utx_ico_skill_${iconid}.png`;
}

// Full-size support card art from GameTora's CDN, keyed by support id.
export function supportCardImageUrl(apiId: number | undefined): string | undefined {
  if (!apiId) return undefined;
  return `https://gametora.com/images/umamusume/supports/tex_support_card_${apiId}.png`;
}

// ---------------------------------------------------------------------------
// DIAGNOSTICS — handy for dev console / future "about data" UI
// ---------------------------------------------------------------------------
export const dataStats = {
  umas: umas.length,
  cards: cards.length,
  skills: skills.length,
  scenarios: scenarios.length,
  meetings: championMeetings.length,
  umasWithUnique: umas.filter((u) => u.uniqueSkillId).length,
  cardsWithSkills: cards.filter((c) => c.taughtSkillIds.length > 0).length,
};
