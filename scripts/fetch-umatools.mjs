#!/usr/bin/env node
/**
 * Pulls game-extracted JSON dumps from daftuyda/UmaTools (which mirrors
 * data extracted from the Umamusume game files) and writes them to
 * src/data/generated/umatools/.
 *
 * Pinned to a specific commit SHA so refreshes are deterministic — bump
 * the SHA via PR after spot-checking that the upstream data hasn't
 * broken our shape assumptions.
 *
 * Source: https://github.com/daftuyda/UmaTools
 * License: see upstream repo
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Bump this when UmaTools ships new game data. See:
// https://github.com/daftuyda/UmaTools/commits/main
const UMATOOLS_SHA = "a024c11ea47d53ad38b5ade866de67708f37bc9e"; // 2026-05-16

// Files we ingest. Comment out anything we don't need to keep transfer
// + bundle size sane.
const FILES = [
  "uma_data.json",        // 253 umas — stats, aptitudes, growth, slug
  "skills_all.json",      // 1796 skills — names, descriptions, sim metadata
  "races.json",           // 322 races — venue, distance, terrain, course
  "support_hints.json",   // 2.1MB — card→taught-skills mapping
  "uma_skills.csv",       // English uma→skills mapping (CSV)
];

const BASE = `https://raw.githubusercontent.com/daftuyda/UmaTools/${UMATOOLS_SHA}/assets`;
const UA = "umamusume-planner-build/0.1 (+https://github.com)";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "src", "data", "generated", "umatools");

async function fetchFile(name) {
  const url = `${BASE}/${name}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return res.text();
}

// Per-file slimmers — drop fields the app never touches. Reduces bundle size
// dramatically (skills_all alone drops from ~1.7MB minified to ~500KB by
// removing Korean/Taiwanese locales and duplicate description fields).
const SLIMMERS = {
  "uma_data.json": (arr) =>
    arr.filter((u) => u.UmaServer === "global").map((u) => ({
      UmaKey: u.UmaKey,
      UmaName: u.UmaName,
      UmaNameJP: u.UmaNameJP,
      UmaNickname: u.UmaNickname,
      UmaSlug: u.UmaSlug,
      UmaId: u.UmaId,
      UmaServer: u.UmaServer,
      UmaBaseStars: u.UmaBaseStars,
      UmaBaseStats: u.UmaBaseStats,
      UmaStatBonuses: u.UmaStatBonuses,
      UmaAptitudes: u.UmaAptitudes,
      UmaImage: u.UmaImage,
    })),

  "skills_all.json": (arr) =>
    arr.map((s) => ({
      id: s.id,
      // Prefer Global EN flavor (enname/endesc) over the formal
      // JP-translated fan version (name_en/desc_en). For skills that only
      // have one of the two, the other fills in.
      name_en: s.enname || s.name_en,
      desc_en: s.endesc || s.desc_en,
      jpname: s.jpname,
      rarity: s.rarity,
      type: s.type,
      iconid: s.iconid,
      char: s.char,
      // Only the first condition group's preconditions + first effect matter
      // for our sim heuristics; drop the rest.
      condition_groups: (s.condition_groups || []).slice(0, 1).map((cg) => ({
        base_time: cg.base_time,
        condition: cg.condition,
        precondition: cg.precondition,
        effects: (cg.effects || []).slice(0, 1),
      })),
      // Inherited cost is useful for rating; rest of gene_version is not.
      gene_version: s.gene_version ? { cost: s.gene_version.cost } : undefined,
    })),

  "support_hints.json": (arr) =>
    arr.filter((s) => s.SupportServer === "global").map((s) => ({
      SupportId: s.SupportId,
      SupportName: s.SupportName,
      SupportNameJP: s.SupportNameJP,
      SupportSlug: s.SupportSlug,
      SupportRarity: s.SupportRarity,
      SupportServer: s.SupportServer,
      SupportType: s.SupportType,
      SupportEffects: s.SupportEffects,
      SupportImage: s.SupportImage,
    })),

  "races.json": (arr) =>
    arr.map((r) => ({
      id: r.id,
      race_id: r.race_id,
      name: r.name,
      name_en: r.name_en,
      venue: r.venue,
      distance: r.distance,
      terrain: r.terrain,
      grade: r.grade,
      entries: r.entries,
      // course segment lengths — useful for the future race sim
      fc: r.fc, fs: r.fs, ls: r.ls,
    })),
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Fetching UmaTools data at SHA ${UMATOOLS_SHA.slice(0, 7)}…`);
  for (const name of FILES) {
    const text = await fetchFile(name);
    // For JSON files, parse+slim+stringify to normalize and shrink.
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      const slimmed = SLIMMERS[name] ? SLIMMERS[name](parsed) : parsed;
      const out = JSON.stringify(slimmed, null, 0);
      await writeFile(resolve(OUT_DIR, name), out + "\n");
      const size = Array.isArray(slimmed)
        ? `${slimmed.length} entries`
        : `${Object.keys(slimmed).length} keys`;
      const reduction = Math.round((1 - out.length / text.length) * 100);
      console.log(
        `  ${name.padEnd(22)} ${(out.length / 1024).toFixed(0)} KB  (${size}, -${reduction}%)`
      );
    } else {
      await writeFile(resolve(OUT_DIR, name), text);
      console.log(`  ${name.padEnd(22)} ${(text.length / 1024).toFixed(0)} KB`);
    }
  }
  // Write a tiny meta file so we can show in-app which SHA we're pinned to.
  await writeFile(
    resolve(OUT_DIR, "_meta.json"),
    JSON.stringify(
      {
        source: "daftuyda/UmaTools",
        sha: UMATOOLS_SHA,
        fetched_at: new Date().toISOString(),
        files: FILES,
      },
      null,
      2
    ) + "\n"
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
