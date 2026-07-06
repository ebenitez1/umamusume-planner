#!/usr/bin/env node
/**
 * generate-skills.mjs — builds src/data/skills.ts from daftuyda's skill DB.
 *
 * Sources (see FORMULAS.md "Data sources"):
 *   - https://daftuyda.moe/assets/skills_core.json
 *       id, name_en (Global text), enname (fan translation), rarity,
 *       type tags, cost, gene_version.cost
 *   - https://raw.githubusercontent.com/daftuyda/UmaTools/main/assets/skills_all.json
 *       same ids + desc_en + condition_groups (precondition/condition strings,
 *       effect types)
 *
 * The output is COMMITTED static data — the app never fetches at runtime.
 * Re-run this script when new EN skills ship:  npm run generate:skills
 *
 * No dependencies; Node 20+ (global fetch).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'src', 'data', 'skills.ts');

const CORE_URL = 'https://daftuyda.moe/assets/skills_core.json';
const ALL_URL =
  'https://raw.githubusercontent.com/daftuyda/UmaTools/main/assets/skills_all.json';

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'uma-planner-build' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[generate-skills] attempt ${attempt} failed for ${url}: ${err.message}`);
      if (attempt === 2) return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mapping rules (FORMULAS.md)
// ---------------------------------------------------------------------------

/** rarity → color: 1 white; 2,3,5 gold; 4,6 pink (overridden below). */
function baseColor(rarity) {
  if (rarity === 1) return 'white';
  if (rarity === 4 || rarity === 6) return 'pink';
  return 'gold';
}

/**
 * SV by underlying RARITY color (white 500, gold 1200, pink 2000) — kept even
 * when the display color is overridden to green/blue/red, so a gold recovery
 * skill still carries gold activation value (matches Team Trials scoring).
 */
const SV_BY_RARITY_COLOR = { white: 500, gold: 1200, pink: 2000 };
const COST_DEFAULT = { white: 160, gold: 340, pink: 0 };

const TAG_DECODE = {
  surface: { tur: 'turf', dir: 'dirt' },
  distance: { sho: 'sprint', mil: 'mile', med: 'medium', lng: 'long' },
  strategy: { run: 'front', ldr: 'pace', btw: 'late', cha: 'end' },
  phase: { l_0: 'opening', l_1: 'middle', l_2: 'final', l_3: 'spurt' },
  terrain: { cor: 'corner', str: 'straight', slo: 'slope', f_c: 'corner', f_s: 'straight' },
};

const STAT_TAGS = ['speed', 'stamina', 'power', 'guts', 'wisdom'];

function decodeAptitudeTags(tags) {
  const out = {};
  for (const [group, table] of Object.entries(TAG_DECODE)) {
    const hits = [];
    for (const t of tags) {
      const mapped = table[t];
      if (mapped && !hits.includes(mapped)) hits.push(mapped);
    }
    if (hits.length) out[group] = hits;
  }
  return out;
}

/**
 * Expected activations heuristic (FORMULAS.md / prompt):
 *   baseline 1.0
 *   ×0.2  one *_random== gate; ×0.06 two or more
 *   ×0.6  references order / order_rate
 *   ×0.7  is_overtake
 */
function expectedActivations(conditionText) {
  let p = 1.0;
  const randomGates = (conditionText.match(/_random==/g) ?? []).length;
  if (randomGates === 1) p *= 0.2;
  else if (randomGates >= 2) p *= 0.06;
  if (/(?<![a-z_])order(_rate)?\s*[=<>!]/.test(conditionText)) p *= 0.6;
  if (/is_overtake/.test(conditionText)) p *= 0.7;
  return Math.round(p * 1000) / 1000;
}

/**
 * Effect-type → dominant stat flavor. This DB carries no stat tags, so we
 * refine the "dominant tag (speed default)" rule via the first effect type:
 * 27/22 velocity → speed, 31 acceleration → power, 1..5 passive stat ups →
 * speed/stamina/power/guts/wisdom respectively.
 */
const EFFECT_STAT = { 1: 'speed', 2: 'stamina', 3: 'power', 4: 'guts', 5: 'wisdom', 22: 'speed', 27: 'speed', 31: 'power' };

/** Dominant SkillType from tags/flags. */
function decodeType({ tags, rarity, isBlue, firstEffectType }) {
  if (tags.includes('dbf')) return 'debuff';
  if (isBlue) return 'recovery';
  if (tags.includes('nac')) return 'passive';
  if (rarity === 4 || rarity === 6) return 'unique';
  for (const t of STAT_TAGS) if (tags.includes(t)) return t;
  return EFFECT_STAT[firstEffectType] ?? 'speed';
}

function buildEntry(core, allEntry) {
  const rarity = core.rarity ?? allEntry?.rarity ?? 1;
  const tags = core.type ?? allEntry?.type ?? [];

  const group = allEntry?.condition_groups?.[0];
  const firstEffectType = group?.effects?.[0]?.type;
  const isBlue = firstEffectType === 2 || firstEffectType === 21; // recovery effects
  const conditionRaw =
    [group?.precondition, group?.condition].filter(Boolean).join('&') || undefined;

  const rarityColor = baseColor(rarity);
  let color = rarityColor;
  if (tags.includes('dbf')) color = 'red';
  else if (tags.includes('nac') && rarity === 1) color = 'green';
  else if (isBlue) color = 'blue';

  const type = decodeType({ tags, rarity, isBlue, firstEffectType });
  const spCost = core.cost ?? core.gene_version?.cost ?? COST_DEFAULT[rarityColor];

  const name = core.name_en || core.enname || allEntry?.enname || `Skill ${core.id}`;
  const description = allEntry?.desc_en || allEntry?.endesc || undefined;

  const entry = {
    id: core.id,
    name,
    spCost,
    type,
    color,
    sv: SV_BY_RARITY_COLOR[rarityColor],
    expectedActivations: expectedActivations(conditionRaw ?? ''),
    aptitudeTags: decodeAptitudeTags(tags),
    purchasable: rarity !== 6,
    official: Boolean(core.name_en),
  };
  if (description) entry.description = description;
  if (conditionRaw) entry.conditionRaw = conditionRaw;
  return entry;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const HELPERS = `
/** Fast id lookup. */
export const SKILLS_BY_ID: ReadonlyMap<number, SkillEntry> = new Map(
  SKILLS.map((s) => [s.id, s]),
);

/** Normalize a skill name for matching: lowercase, alphanumerics only. */
export function normalizeSkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\\u25cb\\u25ce]/g, (m) => (m === '\\u25cb' ? ' o' : ' oo')) // ○ / ◎
    .replace(/[^a-z0-9]+/g, '');
}

/** normalized name → skill id (first occurrence wins; includes alt names). */
const NAME_TO_ID: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [id, alts] of SKILL_ALT_NAMES) {
    for (const alt of alts) {
      const key = normalizeSkillName(alt);
      if (key && !m.has(key)) m.set(key, id);
    }
  }
  for (const s of SKILLS) {
    const key = normalizeSkillName(s.name);
    if (key && !m.has(key)) m.set(key, s.id);
  }
  return m;
})();

/** Exact (normalized) name lookup. Checks Global names and fan translations. */
export function findSkillByName(name: string): SkillEntry | undefined {
  const id = NAME_TO_ID.get(normalizeSkillName(name));
  return id === undefined ? undefined : SKILLS_BY_ID.get(id);
}

function levenshtein(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Fuzzy name match for OCR/manual entry. Returns best matches (closest
 * first) within an edit-distance budget scaled to the query length.
 */
export function fuzzyFindSkills(query: string, limit = 5): SkillEntry[] {
  const q = normalizeSkillName(query);
  if (!q) return [];
  const exact = NAME_TO_ID.get(q);
  const cap = Math.max(2, Math.floor(q.length * 0.34));
  const scored: { id: number; d: number }[] = [];
  const seen = new Set<number>();
  if (exact !== undefined) {
    scored.push({ id: exact, d: 0 });
    seen.add(exact);
  }
  for (const [key, id] of NAME_TO_ID) {
    if (seen.has(id)) continue;
    const d = key.includes(q) || q.includes(key) ? 1 : levenshtein(q, key, cap);
    if (d <= cap) {
      scored.push({ id, d });
      seen.add(id);
    }
  }
  scored.sort((x, y) => x.d - y.d);
  return scored
    .slice(0, limit)
    .map((s) => SKILLS_BY_ID.get(s.id))
    .filter((s): s is SkillEntry => s !== undefined);
}
`;

async function main() {
  const [core, all] = await Promise.all([fetchJson(CORE_URL), fetchJson(ALL_URL)]);
  if (!core && !all) {
    console.error('[generate-skills] both sources failed — aborting, keeping existing file.');
    process.exit(1);
  }
  if (!core) console.warn('[generate-skills] skills_core.json failed — generating from skills_all only.');
  if (!all) console.warn('[generate-skills] skills_all.json failed — generating from skills_core only.');

  const allById = new Map((all ?? []).map((s) => [s.id, s]));
  const baseList = core ?? all ?? [];

  const entries = [];
  const altNames = [];
  for (const c of baseList) {
    const a = allById.get(c.id);
    const entry = buildEntry(c, a);
    entries.push(entry);
    const alts = [c.name_en, c.enname, a?.enname].filter(
      (n, i, arr) => n && n !== entry.name && arr.indexOf(n) === i,
    );
    if (alts.length) altNames.push([c.id, alts]);
  }
  entries.sort((x, y) => x.id - y.id);

  const counts = entries.reduce((acc, e) => {
    acc[e.color] = (acc[e.color] ?? 0) + 1;
    return acc;
  }, {});

  const header = `// AUTO-GENERATED by scripts/generate-skills.mjs — DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:skills
// Generated ${new Date().toISOString().slice(0, 10)} from:
//   ${core ? CORE_URL : '(skills_core.json UNAVAILABLE at generation time)'}
//   ${all ? ALL_URL : '(skills_all.json UNAVAILABLE at generation time)'}
// ${entries.length} skills — colors: ${JSON.stringify(counts)}
import type { SkillEntry } from '../types';

// Data is embedded as JSON strings and parsed once at module load: TypeScript
// cannot type-check a 1,800-element object-literal array without blowing up
// (TS2590), and the data is validated at generation time anyway.

/** Alternate names (fan translations) per skill id, for fuzzy matching. */
const SKILL_ALT_NAMES: ReadonlyArray<readonly [number, readonly string[]]> =
  JSON.parse(${JSON.stringify(JSON.stringify(altNames))});

export const SKILLS: SkillEntry[] = JSON.parse(${JSON.stringify(JSON.stringify(entries))});
`;

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, header + HELPERS, 'utf8');
  console.log(
    `[generate-skills] wrote ${OUT_PATH}: ${entries.length} skills (${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')})`,
  );
}

main();
