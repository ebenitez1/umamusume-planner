# PIPELINE.md — formula provenance & skill-DB update procedure

## How the scoring/rating formulas were derived

All game math lives in `FORMULAS.md` (canonical reference) and is implemented
in `src/data/ratings.ts`, `src/data/races.ts`, and `src/utils/*`. Provenance:

1. **daftuyda.moe `rating-shared.js`** — the rating stat table ("umakonga"
   incremental lookup, `STAT_SCORES` for stat values 0–2500), the verbatim
   tier thresholds (`RATING_TIERS`, G at 0 through LG at 76,000 — 101
   entries), and the unique-skill bonus
   (`uniqueLevel × (star ≤ 2 ? 120 : 170)`).
2. **daftuyda.moe `skill-scorer.js`** — the Team Trials optimizer model:
   gold skill = 1200 pts / white = 500 pts on activation, default 60/40
   consistency/cost-efficiency weights, `scorePerSp = composite × 500 /
   spCost`, gold detection (cost ≥ 170 or id in 100000–199999), the green-
   passive consistency penalty (exempting "Savvy" skills), and the aptitude
   consistency buckets (S/A ×1.1, B/C ×0.9, D/E/F ×0.8, G ×0.7).
3. **kachi-dev/uma-tools `RaceSolver.ts`** — simulator mechanics: the Wit
   activation roll `P = max(100 − 9000/wit, 20) / 100`, guts min-speed
   `0.85·baseSpeed + √(200·guts)·0.001`, course base speed
   `20 − (d−2000)/1000`, strategy velocity coefficients per phase and HP-pool
   coefficients, and the phase model (opening 0–1/6, middle 1/6–2/3, final
   2/3–5/6, last spurt 5/6–1).
4. **Real-build calibration** — verified against an in-game Daiwa Scarlet at
   **20,289 rating (UG1)**; the implementation matched within 0.4%. Per-skill
   rating contributions were calibrated to rarity averages: white 220,
   gold 380, pink 700.

Where `FABLE5_PROMPT.md` said "approximate", these exact versions win — the
goal is replicating UmaTools/Umalator output, and this IS their math.

## Skill-DB update procedure

`src/data/skills.ts` is **generated, never hand-edited**. When new EN skills
ship to Global:

1. Run `npm run generate:skills` (Node 20+, needs internet). This runs
   `scripts/generate-skills.mjs`, which fetches:
   - `https://daftuyda.moe/assets/skills_core.json` — ~1,839 skills: id,
     `name_en`, `enname`, rarity, type tags, cost / `gene_version.cost`.
   - `https://raw.githubusercontent.com/daftuyda/UmaTools/main/assets/skills_all.json`
     — same ids plus `desc_en` and `condition_groups`
     (precondition/condition strings, effect types).
2. **Review the `src/data/skills.ts` diff** before committing — check that
   new skills got sensible names, costs, colors, and aptitude tags, and that
   the total count / official count changed by the expected amount.
3. Type-check and build: `npx tsc -b --force && npm run build`.

The generated file embeds its data as `JSON.parse('…')` on purpose —
TypeScript throws TS2590 on 1,800-element object-literal arrays. Keep it
that way.

## Field mapping (source JSON → `SkillEntry`)

| Source field | Output | Rule |
|---|---|---|
| `id` | `id` | as-is |
| `name_en`, else `enname` | `name` | `name_en` is the **official Global text**; `enname` is the fan translation (fallback only). `official = name_en present` — drives the "Official EN Skills Only" toggle. |
| `desc_en` (skills_all) | `description` | as-is |
| `rarity` | `color`, `sv` | 1 → white (sv 500); 2/3/5 → gold (sv 1200); 4/6 → pink/unique (sv 2000). Display color overridden: `dbf` tag → red, white `nac` passives → green, recovery → blue. `sv` always keeps the **underlying rarity** value. |
| `cost` / `gene_version.cost` | `spCost` | base cost from data where present, else rarity default (white 160, gold 340) |
| type tags | `type`, `aptitudeTags` | `run/ldr/btw/cha` → Front/Pace/Late/End; `sho/mil/med/lng` → Sprint/Mile/Medium/Long; `tur/dir` → Turf/Dirt; `l_0..l_3` → opening/middle/final/spurt phase; `cor/str/slo` → corner/straight/slope; `nac` → passive; `dbf` → debuff. Dominant stat type refined via first effect type. |
| `condition_groups` | `conditionRaw`, `expectedActivations` | precondition+condition joined with `&` (`@` in source = OR). Heuristic expected activations: random gates ×0.2/×0.06, order refs ×0.6, overtake ×0.7. |
| rarity 6 | `purchasable = false` | inherent uniques can't be bought |

## Known data caveats

- **`name_en` vs `enname`**: always prefer `name_en` (official Global text).
  `enname` fan translations sometimes differ from what shipped in-game;
  `findSkillByName` in `src/data/skills.ts` still matches fan-translation alt
  names for import convenience.
- **SP costs vary by hint level** in-game. The DB stores one base cost, so
  the UI lets users override cost per skill (`skillSlice.costOverrides`) —
  exactly why UmaTools has manual cost entry.
- Not all skills are purchasable (1,193 of ~1,839) and only ~985 are
  `official` (released on Global) as of the last generation run.
- `expectedActivations` is a heuristic, not solver output — the simulator
  does its own per-run Wit rolls.
- The source DB carries no explicit stat tags; the dominant stat type is
  inferred (speed default, refined by first effect type) and may be wrong for
  odd skills. Cost/rarity/conditions are unaffected.
