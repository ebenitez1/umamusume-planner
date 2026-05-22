#!/usr/bin/env node
/**
 * Fetches catalog data from umapyoi.net and writes it to
 * src/data/generated/*.json. Designed to run at build time and on a
 * weekly cron via GitHub Actions.
 *
 * Endpoints used:
 *   GET /api/v1/character/list          — all 169 characters (lean)
 *   GET /api/v1/character/info          — all 169 characters (full)
 *   GET /api/v1/support                 — all 536 support cards (lean)
 *   GET /api/v1/support/{id}            — per-card full details (rarity, type)
 *   GET /api/v1/outfit                  — all 254 outfits
 *
 * Rate limit: 500/min, 7200/hr. We throttle requests with a small sleep
 * between detail calls so a full refresh sits well under the cap.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = "https://umapyoi.net/api/v1";
const UA = "umamusume-planner-build/0.1 (+https://github.com)";
const SLEEP_BETWEEN_DETAILS_MS = 120; // ~8 req/s, well under 10/s

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "src", "data", "generated");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return res.json();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching character list…");
  const characters = await fetchJson("/character/info");
  console.log(`  got ${characters.length} characters`);
  // Slim to fields the app actually uses — keeps the bundle small.
  const slimCharacters = characters.map((c) => ({
    game_id: c.game_id,
    name_en: c.name_en,
    name_jp: c.name_jp,
    preferred_url: c.preferred_url,
    color_main: c.color_main,
    color_sub: c.color_sub,
    thumb_img: c.thumb_img,
  }));
  await writeFile(
    resolve(OUT_DIR, "characters.json"),
    JSON.stringify(slimCharacters, null, 2) + "\n"
  );

  console.log("Fetching support card list…");
  const supportList = await fetchJson("/support");
  console.log(`  got ${supportList.length} support cards`);

  console.log("Hydrating each support card with rarity/type…");
  const supports = [];
  for (const lean of supportList) {
    try {
      const detail = await fetchJson(`/support/${lean.id}`);
      const merged = { ...lean, ...detail };
      supports.push({
        id: merged.id,
        chara_id: merged.chara_id,
        gametora: merged.gametora,
        title_en: merged.title_en,
        rarity: merged.rarity,
        rarity_string: merged.rarity_string,
        type: merged.type,
        type_icon_url: merged.type_icon_url,
      });
    } catch (err) {
      console.warn(`  skipped ${lean.id}: ${err.message}`);
      supports.push(lean);
    }
    await sleep(SLEEP_BETWEEN_DETAILS_MS);
  }
  await writeFile(
    resolve(OUT_DIR, "supports.json"),
    JSON.stringify(supports, null, 2) + "\n"
  );

  console.log("Fetching outfit list…");
  const outfits = await fetchJson("/outfit");
  console.log(`  got ${outfits.length} outfits`);
  await writeFile(
    resolve(OUT_DIR, "outfits.json"),
    JSON.stringify(outfits, null, 2) + "\n"
  );

  console.log("Done. Wrote:");
  console.log(`  ${resolve(OUT_DIR, "characters.json")}`);
  console.log(`  ${resolve(OUT_DIR, "supports.json")}`);
  console.log(`  ${resolve(OUT_DIR, "outfits.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
