// Data layer: merges the umapyoi.net catalog (committed under generated/)
// with our hand-curated gameplay overlays (committed under gameplay/) and
// exposes typed arrays + lookup maps to the rest of the app.
import charactersRaw from "./generated/characters.json";
import supportsRaw from "./generated/supports.json";
import umaStatsRaw from "./gameplay/uma-stats.json";
import cardSkillsRaw from "./gameplay/card-skills.json";
import skillsRaw from "./gameplay/skills.json";
import scenariosRaw from "./gameplay/scenarios.json";
import meetingsRaw from "./gameplay/champion-meetings.json";
import type {
  Aptitudes,
  CardRarity,
  CardType,
  ChampionMeeting,
  Scenario,
  Skill,
  Stats,
  Style,
  SupportCard,
  Uma,
} from "../types";

// --- raw catalog shapes (subset of fields we use) ---
interface ApiCharacter {
  game_id: number;
  name_en: string;
  name_jp: string;
  thumb_img?: string | null;
  color_main?: string | null;
  preferred_url?: string;
}

interface ApiSupport {
  id: number;
  chara_id: number;
  gametora: string;
  title_en: string;
  title?: string;
  type?: string;             // "Speed" | "Stamina" | ...
  rarity?: number;           // 1 | 2 | 3
  rarity_string?: string;    // "R" | "SR" | "SSR"
  type_icon_url?: string;
}

interface UmaStatsOverlay {
  game_id: number;
  preferredStyle: Style;
  baseStats: Stats;
  growthRates: Stats;
  aptitudes: Aptitudes;
  uniqueSkillId: string;
  awakeningSkillIds: string[];
}

interface CardSkillsOverlay {
  id: number;
  taughtSkillIds: string[];
  trainingBonusPct: number;
  friendshipBonusPct: number;
}

// --- direct gameplay catalogs (unchanged) ---
export const skills: Skill[] = skillsRaw as Skill[];
export const scenarios: Scenario[] = scenariosRaw as Scenario[];
export const championMeetings: ChampionMeeting[] = meetingsRaw as ChampionMeeting[];

export const skillById = new Map(skills.map((s) => [s.id, s]));
export const scenarioById = new Map(scenarios.map((s) => [s.id, s]));
export const meetingById = new Map(championMeetings.map((m) => [m.id, m]));

// --- merge characters + uma-stats ---
const apiCharacters = charactersRaw as ApiCharacter[];
const umaStats = umaStatsRaw as UmaStatsOverlay[];
const umaStatsById = new Map(umaStats.map((o) => [o.game_id, o]));

const DEFAULT_APT: Aptitudes = {
  surface: { turf: "C", dirt: "C" },
  distance: { sprint: "C", mile: "C", medium: "C", long: "C" },
  style: { runner: "C", early: "C", late: "C", end: "C" },
};
const DEFAULT_STATS: Stats = { speed: 80, stamina: 80, power: 80, guts: 80, wit: 80 };
const DEFAULT_GROWTH: Stats = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 };

export const umas: Uma[] = apiCharacters.map((c) => {
  const overlay = umaStatsById.get(c.game_id);
  if (overlay) {
    return {
      id: String(c.game_id),
      gameId: c.game_id,
      name: c.name_en,
      nameJp: c.name_jp,
      rarity: 3,
      preferredStyle: overlay.preferredStyle,
      baseStats: overlay.baseStats,
      growthRates: overlay.growthRates,
      aptitudes: overlay.aptitudes,
      uniqueSkillId: overlay.uniqueSkillId,
      awakeningSkillIds: overlay.awakeningSkillIds,
      thumbImg: c.thumb_img ?? undefined,
      colorMain: c.color_main ?? undefined,
      preferredUrl: c.preferred_url,
    };
  }
  return {
    id: String(c.game_id),
    gameId: c.game_id,
    name: c.name_en,
    nameJp: c.name_jp,
    rarity: 3,
    preferredStyle: "early",
    baseStats: DEFAULT_STATS,
    growthRates: DEFAULT_GROWTH,
    aptitudes: DEFAULT_APT,
    uniqueSkillId: "",
    awakeningSkillIds: [],
    thumbImg: c.thumb_img ?? undefined,
    colorMain: c.color_main ?? undefined,
    preferredUrl: c.preferred_url,
    unplayable: true,
  };
});

// sort: playable first (alphabetical), then unplayable (alphabetical)
umas.sort((a, b) => {
  if (!!a.unplayable !== !!b.unplayable) return a.unplayable ? 1 : -1;
  return a.name.localeCompare(b.name);
});

export const umaById = new Map(umas.map((u) => [u.id, u]));
export const umaByGameId = new Map(umas.map((u) => [u.gameId, u]));

// --- merge supports + card-skills ---
const apiSupports = supportsRaw as ApiSupport[];
const cardSkills = cardSkillsRaw as CardSkillsOverlay[];
const cardSkillsById = new Map(cardSkills.map((o) => [o.id, o]));

function normalizeCardType(s?: string): CardType {
  switch ((s ?? "").toLowerCase()) {
    case "speed":   return "speed";
    case "stamina": return "stamina";
    case "power":   return "power";
    case "guts":    return "guts";
    case "wit":     return "wit";
    case "friend":  return "friend";
    default:        return "speed";
  }
}

function normalizeRarity(s?: string, n?: number): CardRarity {
  if (s === "SSR" || s === "SR" || s === "R") return s;
  if (n === 3) return "SSR";
  if (n === 2) return "SR";
  return "R";
}

export const cards: SupportCard[] = apiSupports.map((s) => {
  const overlay = cardSkillsById.get(s.id);
  const owner = umaByGameId.get(s.chara_id);
  const charaName = owner?.name ?? "";
  const name = charaName ? `${charaName} ${s.title_en}` : s.title_en;
  return {
    id: String(s.id),
    apiId: s.id,
    name,
    title: s.title_en,
    type: normalizeCardType(s.type),
    rarity: normalizeRarity(s.rarity_string, s.rarity),
    charaGameId: s.chara_id,
    charaName,
    gametoraSlug: s.gametora,
    iconUrl: s.type_icon_url,
    taughtSkillIds: overlay?.taughtSkillIds ?? [],
    trainingBonusPct: overlay?.trainingBonusPct ?? 0,
    friendshipBonusPct: overlay?.friendshipBonusPct ?? 0,
    hasGameplay: !!overlay,
  };
});

// sort: hasGameplay first, then by rarity (SSR > SR > R), then by name
const RARITY_RANK: Record<CardRarity, number> = { SSR: 0, SR: 1, R: 2 };
cards.sort((a, b) => {
  if (a.hasGameplay !== b.hasGameplay) return a.hasGameplay ? -1 : 1;
  if (RARITY_RANK[a.rarity] !== RARITY_RANK[b.rarity])
    return RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity];
  return a.name.localeCompare(b.name);
});

export const cardById = new Map(cards.map((c) => [c.id, c]));
