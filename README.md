# Umamusume Planner

A unified, locally-hosted planning tool for **Uma Musume: Pretty Derby (Global)** that merges two community tools into one web app:

- **Umalator Global** ([kachi-dev.github.io/uma-tools/umalator-global](https://kachi-dev.github.io/uma-tools/umalator-global/)) — race simulation, stat thresholds, outcome probabilities.
- **UmaTools Skill Optimizer** ([daftuyda.moe/optimizer](https://daftuyda.moe/optimizer)) — SP-budget skill optimization, rating projection, skill import, build management.

Everything runs client-side. No backend, no runtime fetches — state persists to localStorage, and builds can be exported as shareable URLs.

## Feature map (by tab)

### Skill Optimizer (default tab)
- SP budget input with **Fast Learner** toggle (−10% cost) and **Official EN Skills Only** filter.
- Optimize-for selector: `* Rating`, `Team Trials (Consistent)`, `Trainer Aptitude Test`.
- **Race Configuration** panel: aptitude grade pickers (S–G) for Track (Turf/Dirt), Distance (Sprint/Mile/Medium/Long), and Strategy (Front/Pace/Late/End).
- **Skill Scoring Weights**: Consistency % vs. Cost Efficiency % sliders (always sum to 100; default 60/40).
- **Ideal Skill Builder**: aptitude filter checkboxes + Generate Build.
- **Skills to Buy** panel: ranked list with SV, expected activations, SV/SP, and effective cost per skill.
- Summary stats: Best Score, Used/Total/Remaining Points, Consistency %, Expected Value, Total SV, Expected Activations, SV per SP, Skill Density, Est. Activation Score, Aptitude Test Score.
- **Explain Build**: consistency strengths, risks & warnings, optimizer warnings.
- Skill entry: manual name + cost (type auto-detected), JSON import, **screenshot OCR** (Tesseract.js) with a Detected Skills review modal, and screen-capture import.
- **Skill Browser** modal: filter by color/type, multi-select, Add Selected / Add All.

### Rating Calculator (right-side rail on the Optimizer tab)
- Stat inputs (Speed / Stamina / Power / Guts / Wisdom), ★1–★5 star level, unique skill level Lv1–Lv6.
- Live projected rating with tier badge (G through LG) and points-to-next-tier.
- Breakdown: Stats Score + Skill Score (auto-populated from the optimizer output) + Unique Bonus.
- Uses the exact in-game "umakonga" stat lookup table and verbatim tier thresholds — see [PIPELINE.md](PIPELINE.md).

### Race Simulator
- Stat form auto-synced with the shared Uma header (same stats everywhere in the app).
- Race selection: surface, distance class, strategy, field size.
- Skill list pulled from the optimizer's current build or entered manually.
- Monte Carlo simulation: win %, top-3 %, placement distribution chart (Recharts), stamina margin at finish, stat-threshold warnings, recommended stat targets.
- Comparison mode: simulate multiple builds side by side.
- Wit-based skill activation rolls, per-phase strategy velocity coefficients, and HP-pool math ported from kachi-dev's RaceSolver — see [PIPELINE.md](PIPELINE.md).

### My Builds
- Save, load, update, and delete builds (localStorage).
- Shareable URL encoding (`#build=…`, lz-string compressed) — opening a share link offers to restore the build.
- A "Current Build: [name]" indicator appears when a saved build is loaded.

### Cross-cutting
- Persistent Uma stat header on every tab, backed by one shared Zustand store.
- Dark navy / pink / gold Uma Musume theme, plain CSS (no Tailwind).
- Toast notifications; keyboard shortcuts (Ctrl+S save build, Ctrl+O open builds, Ctrl+R run simulation); all modals close on Escape and backdrop click.

## Setup

Requires **Node 20+**.

```sh
npm install
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # type-check (tsc -b) + production build → dist/
npm run preview    # serve the production build locally
```

Because the Vite base path defaults to `./` (relative URLs), the built app also works when you **open `dist/index.html` directly from disk** (`file://`) — no server needed.

Other scripts:

```sh
npm run lint              # ESLint
npm run generate:skills   # regenerate src/data/skills.ts from daftuyda's DB
```

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main` (and via manual dispatch). Notes:

- The workflow sets `VITE_BASE_PATH: /umamusume-planner/` for the build — required for project pages hosted at `https://<user>.github.io/umamusume-planner/`. If you rename the repo, update this value; for a `username.github.io` root repo or a custom domain, set it to `/`.
- `actions/configure-pages@v5` runs with `enablement: true`, so the Pages site is auto-created on first run — no manual repository-settings step.
- Local builds (no `VITE_BASE_PATH` env var) fall back to `./`, keeping `file://` usage working.

## What was cloned vs. extended

| Source | Cloned | Extended |
|---|---|---|
| **UmaTools** ([daftuyda.moe](https://daftuyda.moe/optimizer), [github.com/daftuyda/UmaTools](https://github.com/daftuyda/UmaTools)) | Optimizer scoring model (Team Trials weights, consistency/cost-efficiency composite), rating stat table + tier thresholds + unique bonus (`rating-shared.js`, `skill-scorer.js`), skill database (`skills_core.json` / `skills_all.json`), screenshot OCR workflow | Unified store shared with the simulator, Ideal Skill Builder aptitude filters, Explain Build panel, build save/share integration |
| **Umalator / uma-tools** ([kachi-dev/uma-tools](https://github.com/kachi-dev/uma-tools)) | Race math from `RaceSolver.ts`: Wit activation roll, guts min-speed, base speed, strategy velocity/HP coefficients, phase model | Monte Carlo multi-run aggregation, build comparison mode, integration with optimizer skill lists |
| **GameTora** ([gametora.com](https://gametora.com)) | Reference for venue geometry / course data conventions | — |
| **umapyoi.net** ([umapyoi.net](https://umapyoi.net)) | Reference for character/skill data cross-checks | — |

Huge thanks to daftuyda, kachi-dev, GameTora, and umapyoi.net — this project would not exist without their public work.

## Disclaimer

This is an unofficial **fan project**. It is not affiliated with, endorsed by, or connected to Cygames, Inc. or any rights holders of *Uma Musume: Pretty Derby*. All game names, data, and related assets are the property of their respective owners. This tool is provided for personal planning use only.
