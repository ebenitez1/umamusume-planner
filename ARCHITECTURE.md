# ARCHITECTURE.md — Uma Planner v2 foundation contract

Written by the Foundation agent for the five module agents that run **in
parallel** after it. You cannot ask questions — everything you need is here,
in `FABLE5_PROMPT.md` (feature spec), and in `FORMULAS.md` (exact math).
**Do not modify files outside your ownership map** (bottom of this doc).

## Stack & ground rules

- Vite 8 + React 19 + TypeScript (strict) SPA. **No Tailwind** — plain CSS with
  the variables/classes in `src/index.css` (user-approved deviation).
- State: **one Zustand store**, slice pattern, in `src/store/`. Persisted to
  localStorage key `uma-planner-v2` (optimizerResult and all UI state excluded).
- Deps available: `zustand`, `lucide-react`, `recharts` (v3, React-19 ready),
  `tesseract.js`, `clsx`, `lz-string`, react/react-dom 19.
- **No runtime fetches.** `src/data/skills.ts` is committed static data
  (regenerate via `npm run generate:skills`). The app must work from `file://`.
- tsconfig: `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` (use `import type { … }` for types!),
  `erasableSyntaxOnly` (no enums/namespaces/param-properties).
- Verify your work with `npx tsc -b --force` and `npm run build`.

## Layout composition (already wired — don't re-wire)

```
main.tsx → <App/>
App
└─ AppShell            (chrome: <NavBar/> + <main class="app-main"> + <Toaster/>)
   ├─ UmaHeader        (persistent stat strip, ALL tabs, bound to umaSlice)
   └─ active tab (uiSlice.activeTab):
      'optimizer' → <div class="optimizer-layout">   (grid: 1fr + 340px rail)
                       <SkillOptimizer/>             (main column)
                       <RatingCalculator/>           (right rail)
                     </div>
      'simulator' → <RaceSimulator/>
      'builds'    → <MyBuilds/>
```

Your module component replaces its stub **in place** — same file path, same
named export, no props (read everything from the store).

## Types — `src/types/index.ts` (FROZEN)

```ts
type AptitudeGrade = 'S'|'A'|'B'|'C'|'D'|'E'|'F'|'G'
type Surface = 'turf'|'dirt'
type DistanceClass = 'sprint'|'mile'|'medium'|'long'
type Strategy = 'front'|'pace'|'late'|'end'
type RacePhase = 'opening'|'middle'|'final'|'spurt'
type TerrainTag = 'corner'|'straight'|'slope'
interface UmaStats { speed; stamina; power; guts; wisdom }          // numbers
type StatKey = keyof UmaStats
interface UmaConfig { stats: UmaStats; starLevel: 1|2|3|4|5; uniqueLevel: 1|2|3|4|5|6 }
interface AptitudeSet {
  track: Record<Surface, AptitudeGrade>
  distance: Record<DistanceClass, AptitudeGrade>
  strategy: Record<Strategy, AptitudeGrade>
}
interface RaceConfig { surface: Surface; distanceClass: DistanceClass; strategy: Strategy; fieldSize: number }
type SkillColor = 'white'|'gold'|'pink'|'green'|'blue'|'red'
type SkillType  = 'speed'|'stamina'|'power'|'guts'|'wisdom'|'recovery'|'passive'|'debuff'|'unique'
interface SkillAptitudeTags { surface?; distance?; strategy?; phase?: RacePhase[]; terrain?: TerrainTag[] }
interface SkillEntry {
  id: number; name: string; description?: string; spCost: number;
  type: SkillType; color: SkillColor; sv: number; expectedActivations: number;
  conditionRaw?: string; aptitudeTags: SkillAptitudeTags; purchasable: boolean;
  official: boolean;      // ← ADDITION to the original contract, see below
}
interface RankedSkill { skill: SkillEntry; score; consistency; costEfficiency; svPerSp; effectiveCost }
interface OptimizerSummary { bestScore; usedPoints; totalPoints; remaining; consistencyPct;
  expectedValue; totalSv; expectedActivations; svPerSp; skillDensity;
  estActivationScore; aptitudeTestScore }                            // all numbers
interface OptimizerResult { ranked: RankedSkill[]; picked: RankedSkill[];
  summary: OptimizerSummary; explain: { strengths: string[]; risks: string[]; warnings: string[] } }
interface Build { id: string; name: string; createdAt: number; uma: UmaConfig;
  aptitudes: AptitudeSet; race: RaceConfig; skillIds: number[];
  costOverrides: Record<number, number>; spBudget: number }
interface RatingResult { total: number; tier: string; toNextTier: number; nextTier: string;
  breakdown: { stats: number; skills: number; unique: number } }
interface SimulationOutcome { winPct; top3Pct; meanFinishS; placementDistribution: number[];
  staminaMarginPct; warnings: string[]; recommendations: string[] }
type ToastKind = 'info'|'success'|'error'
interface Toast { id: number; message: string; kind: ToastKind }
type TabId = 'simulator'|'optimizer'|'builds'
```

**Documented additions to the frozen contract:**

- `SkillEntry.official: boolean` — true when the source DB carries official
  Global (EN) text (`name_en` present). Drives the "Official EN Skills Only"
  toggle (`skillSlice.officialOnly`): when on, filter to `s.official`.
- `SkillEntry.sv` encodes the **underlying rarity** even when `color` is
  overridden to green/blue/red: white 500, gold 1200, pink 2000. Use `sv` (or
  `ratings.skillRatingScore`) when you need rarity-based points; use `color`
  only for display/filtering.

## Store — `src/store/` (one store, `useStore`)

```ts
import { useStore } from '../../store';         // adjust relative depth
const speed = useStore((s) => s.uma.stats.speed);   // always select narrowly
```

`StoreState = UmaSlice & RaceSlice & SkillSlice & BuildSlice & UiSlice`.
Persisted keys: `uma, race, aptitudes, spBudget, fastLearner, officialOnly,
weights, selectedSkillIds, costOverrides, builds, currentBuildId`.
NOT persisted: `optimizerResult`, `activeTab`, `toasts`, `saveModalOpen`.

### umaSlice (defaults: 600 in every stat, ★3, unique Lv2)
```ts
uma: UmaConfig
setStat(key: StatKey, value: number): void
setStarLevel(star: UmaConfig['starLevel']): void
setUniqueLevel(level: UmaConfig['uniqueLevel']): void
setUma(uma: UmaConfig): void                      // whole-config replace
```

### raceSlice (defaults: turf / medium / pace / field 9; all aptitudes 'A')
```ts
race: RaceConfig
aptitudes: AptitudeSet
setRaceField<K extends keyof RaceConfig>(key: K, value: RaceConfig[K]): void
setAptitude(group: keyof AptitudeSet, key: Surface|DistanceClass|Strategy, grade: AptitudeGrade): void
setAptitudes(aptitudes: AptitudeSet): void
```

### skillSlice (defaults: budget 600, toggles off, weights 60/40)
```ts
spBudget: number
fastLearner: boolean                 // −10% SP cost when true
officialOnly: boolean
weights: { consistency: number; costEfficiency: number }   // always sums to 100
selectedSkillIds: number[]           // the user's working skill list (ids into SKILLS)
costOverrides: Record<number, number>
optimizerResult: OptimizerResult | null

setSpBudget(value: number): void
setFastLearner(value: boolean): void
setOfficialOnly(value: boolean): void
setWeights(consistency: number): void            // clamps 0..100, derives costEfficiency
addSkill(id: number): void                       // no-op if already present
removeSkill(id: number): void
setSelectedSkillIds(ids: number[]): void
setCostOverride(id: number, cost: number | null): void     // null clears
setCostOverrides(overrides: Record<number, number>): void
setOptimizerResult(result: OptimizerResult | null): void
```

### buildSlice
```ts
builds: Build[]
currentBuildId: string | null

saveBuild(name: string): Build       // snapshots current state into a NEW build, sets current
updateBuild(id: string): Build|null  // re-snapshots current state into an existing build
loadBuild(id: string): void          // writes snapshot back into uma/race/skill slices,
                                     //   clears optimizerResult, sets currentBuildId
deleteBuild(id: string): void        // clears currentBuildId if it pointed at the deleted build
setCurrentBuild(id: string | null): void
```

### uiSlice (default tab: 'optimizer')
```ts
activeTab: TabId
setActiveTab(tab: TabId): void
toasts: Toast[]
pushToast(message: string, kind?: ToastKind): void   // kind defaults to 'info'
dismissToast(id: number): void
saveModalOpen: boolean                                // shared Save Build modal flag
setSaveModalOpen(open: boolean): void
```

Toaster auto-dismisses after 3 s — just `pushToast('Build saved', 'success')`.

## Data modules — `src/data/`

### skills.ts (GENERATED — never hand-edit; `npm run generate:skills`)
```ts
SKILLS: SkillEntry[]                              // 1,839 skills, sorted by id
SKILLS_BY_ID: ReadonlyMap<number, SkillEntry>
normalizeSkillName(name: string): string          // lowercase alphanumerics; ○→'o', ◎→'oo'
findSkillByName(name: string): SkillEntry | undefined   // exact normalized match,
                                                        //   incl. fan-translation alt names
fuzzyFindSkills(query: string, limit = 5): SkillEntry[] // edit-distance + substring, best first
```
Data notes: 985 skills are `official`; 1,193 `purchasable` (rarity-6 inherent
uniques are not). Colors: 566 gold, 642 pink, 306 white, 227 green (white
passives), 79 red (debuffs), 19 blue (recovery). `expectedActivations` is the
FORMULAS.md heuristic (random gates ×0.2/×0.06, order refs ×0.6, overtake
×0.7). `conditionRaw` joins precondition+condition with `&`; source `@` = OR.

### races.ts (hand-authored from FORMULAS.md)
```ts
DISTANCE_CLASSES: Record<DistanceClass, DistanceClassInfo>
  // { class, label, minMeters, maxMeters, typicalMeters,
  //   recommendedStats: UmaStats }  ← recommended values are documented HEURISTICS
DISTANCE_CLASS_ORDER: DistanceClass[]
distanceClassFor(meters: number): DistanceClass
STRATEGIES: Record<Strategy, StrategyInfo>
  // { strategy, label ('Front Runner'/'Pace Chaser'/'Late Surger'/'End Closer'),
  //   velocityByPhase: [opening, middle, final], hpCoefficient }
STRATEGY_ORDER: Strategy[]
SURFACE_LABELS: Record<Surface, string>
baseSpeed(distanceMeters): number                 // 20 − (d−2000)/1000
minSpeed(distanceMeters, guts): number            // 0.85·base + √(200·guts)·0.001
PHASE_BOUNDS: Record<RacePhase, { start; end }>   // fractions: 1/6, 2/3, 5/6
phaseAt(distanceFraction: number): RacePhase
APTITUDE_CONSISTENCY_MULT: Record<AptitudeGrade, number>  // S/A 1.1, B/C 0.9, D/E/F 0.8, G 0.7
APTITUDE_GRADES: AptitudeGrade[]
LEFT_HANDED_VENUES                                 // Tokyo, Niigata, Chukyo, Longchamp
FIELD_SIZE_MIN / MAX / DEFAULT                     // 2 / 18 / 9
CM_HISTORY: ChampionMeeting[]                      // { cm, race, surface, distanceMeters, distanceClass }
```

### ratings.ts (FORMULAS.md verbatim; table verified against reference points)
```ts
STAT_SCORES: readonly number[]        // index = stat value 0..2500, built at module load
statScore(value): number              // clamped single-stat score
statsScore(stats: UmaStats): number   // all five, equally weighted
uniqueBonus(star, uniqueLevel): number        // level × (star ≤ 2 ? 120 : 170)
SKILL_SCORE_BY_COLOR: Record<SkillColor, number>  // white 220 gold 380 pink 700 (green/blue/red 220)
skillRatingScore(skill): number       // PREFERRED: by underlying rarity via sv
RATING_TIERS: { tier; min }[]         // G(0) … LG(76000), 101 entries
gradeFor(total): { tier, next, toNext }
```
Rating total = `statsScore + uniqueBonus + skillScore` — aptitudes do NOT
affect the total (they only weight optimizer consistency).

## CSS contract — `src/index.css`

Variables (use these, never hex literals):
`--bg --panel --panel-2 --border --text --muted --accent (pink) --accent-2
(teal) --gold --success --danger`

Shared classes: `.panel .panel-title .btn .btn-primary .btn-danger .input
.select .field-label .modal-backdrop .modal .badge` — plus layout chrome
(`.app-shell .app-main .navbar .nav-tab .uma-header .stat-field
.uma-header-meta .sync-indicator .optimizer-layout .toaster .toast`).
Add module-specific rules to `src/index.css` **below** the existing sections
under a clearly-marked comment block for your module (append only — merge
conflicts are on you).

## File-ownership map (STRICT — parallel agents, no overlaps)

| Agent | Owns (create/overwrite) |
|---|---|
| **Optimizer** | `src/components/optimizer/*` EXCEPT `SkillEntryTools.tsx`, `SkillBrowserModal.tsx`, `DetectedSkillsModal.tsx`; plus `src/utils/optimizer.ts` |
| **Rating** | `src/components/rating/*`, `src/utils/ratingCalc.ts` |
| **Simulator** | `src/components/simulator/*`, `src/utils/simulator.ts` |
| **Import** | `src/components/optimizer/SkillEntryTools.tsx`, `src/components/optimizer/SkillBrowserModal.tsx`, `src/components/optimizer/DetectedSkillsModal.tsx`, `src/utils/ocr.ts` |
| **Builds** | `src/components/builds/*`, `src/utils/shareUrl.ts` |

Shared files (`types/`, `store/`, `data/`, `index.css` appends only, layout
components, `App.tsx`) belong to the foundation/integrator — do not restructure
them. The Optimizer agent should render `<SkillEntryTools/>` (import agent's
component) inside its page; treat it as a black box.

## Integration TODOs (left for the integrator agent — do NOT implement in modules)

1. **Keyboard shortcuts** (Ctrl+S save build → `setSaveModalOpen(true)`,
   Ctrl+O open builds tab, Ctrl+R run simulation) — one global listener in
   AppShell.
2. **Share-URL hash restore** — on load, detect `#build=…`, decode via
   `src/utils/shareUrl.ts` (builds agent), offer restore toast/modal.
3. **Escape-to-close** for modals — modules should still wire Escape locally
   in their own modals (standard `onKeyDown`/effect), integrator only audits.
4. README/PIPELINE/PROJECT_PLAN rewrites (docs agent).

## Gotchas discovered during scaffolding

- `skills.ts` embeds its data as `JSON.parse('…')` — TypeScript throws TS2590
  on 1,800-element object-literal arrays. Keep it that way when regenerating.
- `verbatimModuleSyntax` means `import type` is mandatory for type-only
  imports; `erasableSyntaxOnly` forbids TS enums — use string unions.
- Zustand v5: always select single values (`useStore(s => s.x)`); selecting
  fresh object literals causes infinite re-renders (no default shallow equal).
- Base path is `'./'` — never use absolute `/…` asset URLs; import assets or
  put them in `public/` and reference relatively.
