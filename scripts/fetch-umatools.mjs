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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Fetching UmaTools data at SHA ${UMATOOLS_SHA.slice(0, 7)}…`);
  for (const name of FILES) {
    const text = await fetchFile(name);
    // For JSON files, parse+stringify to normalize whitespace and validate.
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      const out = JSON.stringify(parsed, null, 0); // minified — these get further processed at build time
      await writeFile(resolve(OUT_DIR, name), out + "\n");
      const size = Array.isArray(parsed) ? `${parsed.length} entries` : `${Object.keys(parsed).length} keys`;
      console.log(`  ${name.padEnd(22)} ${(out.length / 1024).toFixed(0)} KB  (${size})`);
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
