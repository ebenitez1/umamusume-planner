# Fable 5 Multi-Agent Prompt — Umamusume Planner

## Project Goal

Build a unified, locally-hosted Uma Musume: Pretty Derby planning tool that merges the functionality of two existing community tools into a single cohesive web application:

1. **Umalator Global** (`https://kachi-dev.github.io/uma-tools/umalator-global/`) — a race simulator that models race mechanics, stat thresholds, and outcome probabilities for Uma Musume races.
2. **UmaTools Skill Optimizer** (`https://daftuyda.moe/optimizer`) — a skill build optimizer and rating calculator featuring SP budget management, aptitude-weighted skill scoring, race configuration, a stat-based rating projector, screenshot/JSON skill import, build saving/sharing, and a skill browser.

**Base directory:** `C:\Users\deity\Documents\ai_assistant\umamusume-planner`

---

## Agent Roles

### Agent 1 — Architect
- Define the full project structure under the base directory.
- Decide the tech stack: prefer a **Vite + React + TypeScript** SPA with Tailwind CSS. No backend required — all state is localStorage + optional JSON export/import.
- Design the top-level tab/page layout:
  - **Race Simulator** (Umalator)
  - **Skill Optimizer** (UmaTools)
  - **Rating Calculator** (integrated panel, not a separate page)
  - **My Builds** (saved builds manager)
- Define shared data models: Uma stats, skill entries, aptitude grades (S/A/B/C/D/E/F/G), race config (track type, distance class, strategy), star rarity, unique skill level.
- Output: `ARCHITECTURE.md` and `PROJECT_PLAN.md`.

### Agent 2 — Data Layer
- Build all shared TypeScript types and data files.
- `src/data/skills.ts` — full skill list with name, SP cost, type (speed/stamina/power/guts/wisdom/recovery/unique), applicable aptitudes, activation condition tags, base skill value (SV), expected activations.
- `src/data/races.ts` — race track definitions (turf/dirt), distance classes (sprint/mile/medium/long), strategy types (front/pace/late/end), stat thresholds per class.
- `src/data/ratings.ts` — rating tier thresholds (G through S+), stat score formula, skill score formula, unique bonus table by star/level.
- `src/types/index.ts` — all shared interfaces: `UmaConfig`, `SkillEntry`, `RaceConfig`, `AptitudeSet`, `Build`, `RatingResult`.
- Implement `src/store/` using Zustand (or React Context) with slices for: `umaSlice` (stats, star, unique level), `raceSlice` (track, distance, strategy aptitudes), `skillSlice` (skill pool, optimizer results), `buildSlice` (saved builds).

### Agent 3 — Skill Optimizer Module
Replicate and extend the UmaTools optimizer (`https://daftuyda.moe/optimizer`).

**Features to implement:**
- SP budget input with Fast Learner toggle (−10% cost).
- Official EN Skills Only toggle.
- Optimize-for selector: `* Rating`, `Team Trials (Consistent)`, `Trainer Aptitude Test`.
- **Race Configuration panel:** aptitude grade pickers for Track (Turf/Dirt), Distance (Sprint/Mile/Medium/Long), Strategy (Front/Pace/Late/End) — grades S through G.
- **Skill Scoring Weights:** Consistency % and Cost Efficiency % sliders (must sum to 100%).
- **Ideal Skill Builder:** aptitude filter checkboxes (Track/Distance/Strategy/General), "Generate Build" button that highlights matching skills.
- **Skills to Buy panel:** ranked list with per-skill stats (SV, expected activations, SV/SP, hint level).
- Summary stats: Best Score, Used Points, Total Points, Remaining, Consistency %, Expected Value, Total SV, Expected Activations, SV per SP, Skill Density, Est. Activation Score, Aptitude Test Score.
- **Explain Build** panel: Consistency Strengths, Risks & Warnings, Optimizer Warnings.
- Skill entry: manual (name + cost, type auto-detected), JSON import, screenshot OCR upload (use Tesseract.js), screen capture API.
- Skill browser modal: filter by color/type, multi-select, Add Selected / Add All.
- Build save/load/share (localStorage + shareable URL hash encoding).

### Agent 4 — Rating Calculator Module
Replicate the rating calculator from UmaTools, integrated as a persistent right-side panel on the Skill Optimizer page.

**Features:**
- Stat inputs: Speed, Stamina, Power, Guts, Wisdom.
- Star Level selector: ★1 through ★5.
- Unique Skill Level selector: Lv1 through Lv6.
- Projected Rating display with tier label and points-to-next-tier.
- Auto-populate Skill Score from optimizer output.
- Breakdown: Stats Score, Skill Score, Unique Bonus.
- Live recalculation on any input change.

### Agent 5 — Race Simulator Module
Replicate and extend the Umalator Global race simulator (`https://kachi-dev.github.io/uma-tools/umalator-global/`).

**Features to implement:**
- Uma stat input form (Speed, Stamina, Power, Guts, Wisdom) — auto-synced from the shared `umaSlice` if already entered in the optimizer.
- Race selection: track type, distance, strategy, field size, surface condition.
- Skill selection panel — pull from the optimizer's current build if available, or allow manual entry.
- Run simulation: Monte Carlo or formula-based probability model for finish placement.
- Output: win %, top 3 %, stamina margin at finish, speed/power threshold warnings, recommended stat targets.
- Comparison mode: simulate 2–3 different builds side by side.
- Visual results: bar chart or distribution graph for finish placement probability.

### Agent 6 — UI/UX & Integration
- Implement the global layout: sidebar or top nav with tabs for Simulator / Optimizer / My Builds.
- Apply a dark theme consistent with the Uma Musume aesthetic — use a dark navy/slate base (`#0f172a` family), pink/magenta accents for Uma branding, gold for ratings.
- Shared stat panel at the top of any page that persists the current Uma's stats so both modules stay in sync.
- Breadcrumb or indicator showing "Current Build: [name]" when a saved build is loaded.
- Responsive layout — desktop-first but functional at 1280px+.
- Toasts for save/load/share actions.
- Keyboard shortcuts: `Ctrl+S` to save build, `Ctrl+O` to open build, `Ctrl+R` to run simulation.
- All modals accessible and closeable via Escape key.

### Agent 7 — Build, Config & Documentation
- `vite.config.ts` — standard Vite SPA config, base path `./` for local file:// usage.
- `package.json` — dependencies: React 18, TypeScript, Tailwind CSS, Zustand, Lucide React icons, Recharts (charts), Tesseract.js (OCR), clsx, tailwind-merge.
- `tailwind.config.ts` — extend theme with Uma color palette.
- `tsconfig.json` — strict mode.
- `.gitignore`.
- `README.md` — setup instructions, feature map, and notes on what was cloned from each source tool vs. what was extended.
- `PIPELINE.md` — notes on how the optimizer scoring formulas were derived and how to update the skill database when new EN skills are added.
- Dev script: `npm run dev` → Vite dev server on `localhost:5173`.
- Build script: `npm run build` → outputs to `dist/` for static hosting or direct `index.html` opening.

---

## Project File Tree (Target)

```
C:\Users\deity\Documents\ai_assistant\umamusume-planner\
├── public\
│   └── favicon.ico
├── src\
│   ├── components\
│   │   ├── layout\
│   │   │   ├── AppShell.tsx
│   │   │   ├── NavBar.tsx
│   │   │   └── UmaHeader.tsx
│   │   ├── optimizer\
│   │   │   ├── SkillOptimizer.tsx
│   │   │   ├── RaceConfigPanel.tsx
│   │   │   ├── SkillScoringWeights.tsx
│   │   │   ├── IdealSkillBuilder.tsx
│   │   │   ├── SkillsToBuyPanel.tsx
│   │   │   ├── BuildSummary.tsx
│   │   │   ├── ExplainBuildModal.tsx
│   │   │   ├── SkillBrowserModal.tsx
│   │   │   ├── SaveBuildModal.tsx
│   │   │   └── SavedBuildsModal.tsx
│   │   ├── rating\
│   │   │   └── RatingCalculator.tsx
│   │   └── simulator\
│   │       ├── RaceSimulator.tsx
│   │       ├── SimulatorInputs.tsx
│   │       ├── SimulationResults.tsx
│   │       └── ComparisonView.tsx
│   ├── data\
│   │   ├── skills.ts
│   │   ├── races.ts
│   │   └── ratings.ts
│   ├── store\
│   │   ├── umaSlice.ts
│   │   ├── raceSlice.ts
│   │   ├── skillSlice.ts
│   │   └── buildSlice.ts
│   ├── types\
│   │   └── index.ts
│   ├── utils\
│   │   ├── optimizer.ts
│   │   ├── ratingCalc.ts
│   │   ├── simulator.ts
│   │   └── shareUrl.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── ARCHITECTURE.md
├── PIPELINE.md
├── PROJECT_PLAN.md
├── README.md
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## Key Implementation Notes for Agents

### Optimizer Scoring Formula
The optimizer must score each skill on a weighted combination:
- **Consistency score**: how reliably the skill activates given race config aptitudes
- **Cost efficiency**: SV delivered per SP spent
- Final score = `(consistency_weight × consistency_score) + (cost_weight × cost_efficiency_score)`
- Weights are user-configurable (default 60/40).

### Rating Formula
Approximate the rating projection as:
```
Rating = floor(stats_score + skill_score + unique_bonus)
```
Where `stats_score` is a weighted sum of all five stats (Speed and Wisdom weighted highest), `skill_score` is derived from the optimizer's total SV output, and `unique_bonus` is a lookup table by star × unique level.

### Simulator Model
Use a simplified speed-phase model:
1. **Phase 1 (start/early):** influenced by Wisdom (gate response) and Power (positioning)
2. **Phase 2 (mid):** influenced by Speed and strategy
3. **Phase 3 (final sprint):** influenced by Guts and remaining stamina
Run 1000 iterations per simulation. Track finish time distribution and convert to placement probability against a simulated field.

### Shared State Sync
When a user fills in stats in the Rating Calculator, those stats should auto-propagate to the Simulator's stat inputs (and vice versa) via the shared `umaSlice`. A small sync indicator should appear when values are linked.

### Screenshot OCR (Skill Import)
Use Tesseract.js in the browser. On image upload or screen capture, OCR the image and parse skill name + cost using regex patterns. Detected skills appear in a review modal (`DetectedSkills`) before being added to the optimizer. This mirrors the UmaTools "Upload Screenshot" and "Detected Skills" workflow exactly.

### Build Sharing
Encode the full build state (race config + skill list + stats) as a compressed base64 URL hash (`#build=...`). On page load, detect the hash and offer to restore it.

---

## Deliverable Acceptance Criteria

- [ ] `npm install && npm run dev` works on a Windows machine with Node 20+.
- [ ] Race Simulator tab renders, accepts stat input, and runs a simulation with visible results.
- [ ] Skill Optimizer tab renders the full optimizer UI — all panels present and interactive.
- [ ] Rating Calculator panel auto-updates from stat inputs and optimizer output.
- [ ] My Builds tab lists, loads, and deletes saved builds from localStorage.
- [ ] Skill browser modal filters by type and allows multi-select add.
- [ ] Screenshot OCR parses a sample skill screenshot and surfaces detected skills.
- [ ] Build share URL round-trips correctly (encode → decode → same state).
- [ ] Dark theme is consistent throughout.
- [ ] No TypeScript errors on `tsc --noEmit`.
