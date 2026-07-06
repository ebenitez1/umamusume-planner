# PROJECT_PLAN.md — Umamusume Planner v2

Condensed from `FABLE5_PROMPT.md` (feature spec). Exact math: `FORMULAS.md`.
Interface contract: `ARCHITECTURE.md`.

## Goal

One Vite + React + TypeScript SPA merging **Umalator Global** (race simulator)
and the **UmaTools Skill Optimizer** (skill builds + rating calculator), with
a **My Builds** manager. No backend — localStorage + shareable URL hashes.

## Approved deviations from the original prompt

1. **No Tailwind** — plain CSS using the theme variables in `src/index.css`
   (dark navy base, pink accent, gold ratings). Zustand IS adopted.
2. **Exact formulas over "approximate"** — everything in `FORMULAS.md`
   (daftuyda rating/scorer JS, kachi-dev RaceSolver, real-build calibration)
   overrides the prompt's simplified models.
3. **Skill data generated, not hand-written** — `scripts/generate-skills.mjs`
   builds `src/data/skills.ts` from daftuyda's own DB.

## Module map

```
src/
├── components/
│   ├── layout/        AppShell, NavBar, UmaHeader, Toaster   (foundation)
│   ├── optimizer/     SkillOptimizer + panels; SkillEntryTools,
│   │                  SkillBrowserModal, DetectedSkillsModal (import agent)
│   ├── rating/        RatingCalculator (right rail on optimizer tab)
│   ├── simulator/     RaceSimulator + inputs/results/comparison
│   └── builds/        MyBuilds
├── data/              skills.ts (generated), races.ts, ratings.ts
├── store/             Zustand slices: uma, race, skill, build, ui
├── types/index.ts     frozen shared interfaces
└── utils/             optimizer.ts, ratingCalc.ts, simulator.ts,
                       shareUrl.ts, ocr.ts
```

Tabs (uiSlice.activeTab): `optimizer` (SkillOptimizer + RatingCalculator
rail), `simulator`, `builds`.

## Agent ownership boundaries (strict — parallel agents)

| Agent | Owns (create/overwrite) |
|---|---|
| Foundation | `types/`, `store/`, `data/`, `components/layout/`, `App.tsx`, `main.tsx`, `index.css` base, configs |
| Optimizer | `src/components/optimizer/*` EXCEPT the three import-agent files; `src/utils/optimizer.ts` |
| Rating | `src/components/rating/*`, `src/utils/ratingCalc.ts` |
| Simulator | `src/components/simulator/*`, `src/utils/simulator.ts` |
| Import | `optimizer/SkillEntryTools.tsx`, `optimizer/SkillBrowserModal.tsx`, `optimizer/DetectedSkillsModal.tsx`, `src/utils/ocr.ts` |
| Builds | `src/components/builds/*`, `src/utils/shareUrl.ts` |
| Docs | `README.md`, `PIPELINE.md`, `PROJECT_PLAN.md` |
| Integrator | keyboard shortcuts, share-URL hash restore, Escape audit, final verify/ship |

Shared files (types, store, data, layout, `App.tsx`) are frozen for module
agents; `index.css` is append-only under per-module comment blocks.

## Acceptance criteria (from FABLE5_PROMPT.md)

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

## Key implementation notes

- **Optimizer score** = `consistencyWeight × consistency + costWeight ×
  costEfficiency` (default 60/40, user-adjustable, sums to 100).
- **Rating** = `statsScore + skillScore + uniqueBonus` — exact umakonga
  table + verbatim tier thresholds; aptitudes never affect the total.
- **Simulator**: Monte Carlo (~1000 runs) with Wit activation rolls,
  strategy phase coefficients, and HP-pool math from RaceSolver.
- **Shared state sync**: stats entered anywhere propagate via `umaSlice`;
  UmaHeader shows them on every tab with a sync indicator.
- **Build sharing**: lz-string-compressed state in `#build=…`; restore
  offered on load.
- All modals close on Escape and backdrop click.
