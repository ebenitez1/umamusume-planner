# FORMULAS.md — verified game math for the v2 rebuild

Constants reverse-engineered during v1 development and verified against real
in-game builds (a Daiwa Scarlet Peak Blue at 20,289 / UG1 matched within 0.4%).
Where FABLE5_PROMPT.md says "approximate", prefer these exact versions — the
prompt's goal is replicating UmaTools/Umalator, and this IS their math.

Sources:
- daftuyda.moe/js/rating-shared.js (stat table, tier thresholds, unique bonus)
- daftuyda.moe/js/skill-scorer.js (Team Trials scoring, weights)
- kachi-dev/uma-tools/uma-skill-tools/RaceSolver.ts (Wit roll, guts formulas)
- v1 codebase at git commit `940b980` (src/lib/rating.ts, src/lib/sim/*)

## Deviations from FABLE5_PROMPT.md (user-approved)

1. **No Tailwind** — keep plain CSS with the existing dark navy/pink/gold theme
   variables. Zustand IS adopted.
2. **Exact formulas over "approximate"** — everything below.
3. **Skill data generated, not hand-written** — from daftuyda's own DB (below),
   not typed from imagination.

## Rating formula (exact — this is what the game shows)

```
total = statsScore + uniqueBonus + skillScore
```

Aptitudes do NOT contribute to the total. They only affect skill usefulness.

### statsScore — the "umakonga" lookup table

Per stat (all five weighted EQUALLY, cap input at 2500), sum `STAT_SCORES[stat]`:

```js
const R1 = [5,8,10,13,16,18,21,24,26,28,29,30,31,33,34,35,39,41,42,43,52,55,66,68,68];
const R2 = [79,80,81,83,84,85,86,88,89,90,92,93,94,96,97,98,100,101,102,103,105,106,107,
  109,110,111,113,114,115,117,118,119,121,122,123,124,126,127,128,130,131,132,134,135,136,
  138,139,140,141,143,144,145,147,148,149,151,152,153,155,156,157,159,160,161,162,164,165,
  166,168,169,170,172,173,174,176,177,178,179,181,182,182];
const sc = [0]; let raw = 0, idx = 0;
for (let c = 1; c <= 1200; c++) {
  if (c <= 49) idx = 0; else if (c <= 99) idx = 1; else if (c % 50 === 0) idx++;
  raw += R1[idx]; sc[c] = Math.round(raw / 10);
}
raw = 38413; idx = 0;
for (let c = 1201; c <= 2000; c++) {
  if (c <= 1209) idx = 0; else if (c <= 1219) idx = 1; else if (c % 10 === 0) idx++;
  raw += R2[idx]; sc[c] = Math.round(raw / 10);
}
raw = 142796; idx = 0; let rate = 183;
for (let c = 2001; c <= 2500; c++) {
  if (idx >= 25) { rate++; idx = 0; }
  raw += rate; idx++; sc[c] = Math.round(raw / 10);
}
```
Reference points: sc[400]=577, sc[651]=1301, sc[752]=1640, sc[900]=2209,
sc[1000]=2635, sc[1100]=3171, sc[1200]=3841.

### uniqueBonus

```
uniqueBonus = uniqueLevel × (starLevel <= 2 ? 120 : 170)      // level 1-6
```

### skillScore (profile-rating contribution per learned skill)

Calibrated per-rarity averages: white/normal = 220, gold/rare = 380,
pink/unique = 700. (Team Trials scoring is different — see below.)

### Tier thresholds (RATING_BADGE_MINIMA, ported verbatim)

G 0, G+ 300, F 600, F+ 900, E 1300, E+ 1800, D 2300, D+ 2900, C 3500, C+ 4900,
B 6500, B+ 8200, A 10000, A+ 12100, S 14500, S+ 15900, SS 17500, SS+ 19200,
UG 19600, UG1 20000, UG2 20400, UG3 20800, UG4 21200, UG5 21600, UG6 22100,
UG7 22500, UG8 23000, UG9 23400, UF 23900, UF1 24300, UF2 24800, UF3 25300,
UF4 25800, UF5 26300, UF6 26800, UF7 27300, UF8 27800, UF9 28300, UE 28800,
UE1 29400, UE2 29900, UE3 30400, UE4 31000, UE5 31500, UE6 32100, UE7 32700,
UE8 33200, UE9 33800, UD 34400, UD1 35000, UD2 35600, UD3 36200, UD4 36800,
UD5 37500, UD6 38100, UD7 38700, UD8 39400, UD9 40000, UC 40700, UC1 41300,
UC2 42000, UC3 42700, UC4 43400, UC5 44000, UC6 44700, UC7 45400, UC8 46200,
UC9 46900, UB 47600, UB1 48300, UB2 49000, UB3 49800, UB4 50500, UB5 51300,
UB6 52000, UB7 52800, UB8 53600, UB9 54400, UA 55200, UA1 55900, UA2 56700,
UA3 57500, UA4 58400, UA5 59200, UA6 60000, UA7 60800, UA8 61700, UA9 62500,
US 63400, US1 64200, US2 65100, US3 66400, US4 67700, US5 69000, US6 70300,
US7 71600, US8 72900, US9 74400, LG 76000.

## Optimizer scoring (UmaTools Team Trials model)

- Activation scoring: Gold skill = 1200 pts, White = 500 pts on activation.
- Default weights: consistency 0.6, costEfficiency 0.4 (user-adjustable, must
  sum to 1 — matches the prompt's 60/40 default).
- scorePerSp = composite × 500 / spCost.
- Gold detection: cost >= 170, or skill id in 100000..199999.
- Green passives get a consistency penalty (volatile race-condition boosts),
  EXCEPT "Savvy" skills.

### Aptitude grade buckets (affect skill consistency, NOT rating total)

good = S/A (×1.1), average = B/C (×0.9), bad = D/E/F (×0.8), terrible = G (×0.7).

## Skill activation (for the simulator)

Wit roll per activation attempt (RaceSolver.ts:967):
```
P(activate) = max(100 − 9000/wit, 20) / 100
```
wit 400 → 78%, 800 → 89%, 1200 → 93%; floor 20%.

Skills fire AT MOST ONCE per race (cooldown mechanic exists only for a handful
of special skills). Random-gated conditions (`phase_random==N` etc.) roll a
value 1–6 once per bucket per race — a big source of run-to-run variance.

## Race/course constants

- Distance classes: sprint < 1400 m, mile 1400–1799, medium 1800–2400, long > 2400.
- baseSpeed(course) = 20 − (distance − 2000)/1000  (m/s reference speed).
- minSpeed = 0.85 × baseSpeed + sqrt(200 × guts) × 0.001.
- Left-handed venues: Tokyo, Niigata, Chukyo, Longchamp; all other JP venues
  right-handed. (Skill "Right-Handed ○" checks rotation==1 = right.)
- Style velocity coefficients per phase (opening/middle/final) —
  runner [1.000, 0.980, 0.962], pace/early [0.978, 0.991, 0.975],
  late [0.938, 0.998, 0.994], end [0.931, 1.000, 1.000].
- Style HP-pool coefficients: runner 0.95, pace 0.89, late 1.00, end ~0.995.
- Race phases by distance fraction: opening 0–1/6, middle 1/6–2/3,
  final 2/3–5/6, last spurt 5/6–1. The game models races in 12 sections.

## Data sources for src/data/skills.ts

Generate, don't hand-write:
- `https://daftuyda.moe/assets/skills_core.json` — 1,839 skills: id, name_en
  (= Global game text; `enname` is the fan translation — do NOT prefer it),
  rarity (1 white, 2/3/5 gold, 4/6 pink-unique), type tags, gene_version.cost.
- `https://raw.githubusercontent.com/daftuyda/UmaTools/main/assets/skills_all.json`
  — same ids plus desc_en + condition_groups (precondition/condition strings)
  for activation-condition tags.
- Type tag decode: run/ldr/btw/cha = Front/Pace/Late/End; sho/mil/med/lng =
  Sprint/Mile/Medium/Long; tur/dir = Turf/Dirt; l_0..l_3 = opening/middle/
  final/spurt phase; cor/str/slo = corner/straight/slope; nac = passive;
  dbf = debuff.
- SP costs vary in-game with hint level; store a base cost (from data where
  present, else rarity default: white 160, gold 340) and let the UI override
  per-skill — this is exactly why UmaTools lets users type costs manually.

## Champion Meeting history (user-supplied, Global)

CM1 Japanese Oaks · CM2 Tenno Sho (Spring) · CM3 NHK Mile Cup · CM4 Takarazuka
Kinen · CM5 Oka Sho · CM6 Kikuka Sho · CM7 Tenno Sho (Autumn) · CM8 Arima
Kinen · CM9 Takamatsunomiya Kinen · CM10 February Stakes · CM11 Tenno Sho
(Spring) · CM12 Satsuki Sho · CM13 Japanese Oaks · CM14 NHK Mile Cup.
