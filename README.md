# Umamusume Build Planner

A web tool for planning Umamusume Pretty Derby builds. Pick a uma, the
Champion Meeting you're targeting, your training scenario, and your support
cards — get skill recommendations, a rating estimate, and uma recommendations
for the meeting.

Live (after you deploy): `https://<your-github-username>.github.io/umamusume-planner/`

## Features (MVP)

- **Uma picker** with the full Global EN roster of 169 characters from
  [umapyoi.net](https://umapyoi.net) — playable umas (with curated stats /
  aptitudes / unique skill / awakening skills) grouped above catalog-only umas.
- **Champion Meeting picker** with track / surface / distance and a meta
  notes blurb (Tokyo 2400 turf, Nakayama 2500 turf, etc.).
- **Scenario picker** with stat multipliers and favored skills (URA, Aoharu,
  MANT, Grand Live, Grand Masters, U.A.F., L'Arc).
- **Support card deck** (up to 6) — picks from the full 536-card Global
  roster, grouped by type + rarity, with "(no skills)" flag on cards we
  haven't curated yet.
- **Stat inputs** with bars (Speed / Stamina / Power / Guts / Wit).
- **Running style** selector (Front Runner / Pace Chaser / Late Surger / End Closer).
- **Rating** with letter grade (G → UG1), stat / skill / aptitude /
  scenario breakdown, and warnings (e.g. "stamina too low for Long").
- **Skill recommendations** grouped by Core / Strong / Nice-to-have, each
  with explanations and a checkbox to add to your build.
- **Uma recommendations** — top 5 umas ranked for the chosen meeting +
  scenario, plus meta running styles.

## Data layout

```
src/data/
├── generated/                # umapyoi.net catalog — auto-refreshed weekly
│   ├── characters.json       #   169 umas (English + JP names, IDs, thumbs)
│   ├── supports.json         #   536 support cards (type, rarity, GameTora slug)
│   └── outfits.json          #   254 outfits
├── gameplay/                 # hand-curated, keyed by API IDs
│   ├── uma-stats.json        #   stats, aptitudes, unique-skill + awakenings
│   ├── card-skills.json      #   taught skills per support card
│   ├── skills.json           #   skill catalog (descriptions, rating points, sim metadata)
│   ├── scenarios.json        #   URA, Aoharu, MANT, Grand Live, Grand Masters, U.A.F., L'Arc
│   └── champion-meetings.json#   Japan Cup, Arima Kinen, Tenno Sho Spring, etc.
└── index.ts                  # merges catalog + gameplay, exports typed arrays
```

Umas without a gameplay overlay are marked `unplayable: true` and surface
in the picker under "Catalog only" — you can see who exists but they
won't generate meaningful recommendations until you fill in their
stats/aptitudes.

## Updating data

- **Manual refresh:** `npm run fetch:data` pulls fresh data from
  umapyoi.net into `src/data/generated/`.
- **Automatic refresh:** `.github/workflows/update-data.yml` runs every
  Monday at 06:00 UTC, pulls fresh data, and commits any changes — so
  Global server additions appear without manual work.

## Roadmap

- Race simulator (tick-by-tick, HP & stamina drain, skill triggers).
- Source a skills catalog with effects from elsewhere (umapyoi has no
  skills endpoint) — likely a GameTora scrape using the `gametora` slug
  on each support card as the join key.
- Add gameplay overlays for more umas — current playable roster is the
  initial Global launch heroes (Special Week → El Condor Pasa).
- Track preview / minimap with corner & straight visualisation.
- Per-skill activation probability calc and breakeven stat suggestions.
- Save / share builds via URL hash.

## Local dev

```bash
npm install
npm run dev
```

Open the URL it prints (usually <http://localhost:5173>).

## Build

```bash
npm run build
npm run preview  # to view the production build locally
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → "Build and deployment" → Source: **GitHub Actions**.
3. Edit `.github/workflows/deploy.yml` — set `VITE_BASE_PATH` to
   `/<your-repo-name>/` (already defaulted to `/umamusume-planner/`).
4. Push to `main`. The workflow builds and deploys automatically.

If you use a custom domain or a `username.github.io` repo, set
`VITE_BASE_PATH: /` instead.

## Data structure

All game data lives in `src/data/*.json` with TypeScript types in
`src/types/index.ts`. The shape mirrors GameTora's so a scraper can drop
the JSON in directly. See `src/lib/rating.ts` for the heuristic rating
formula (`computeStatScore`, `aptitudeMultiplier`, `skillScore`,
`scenarioBonus`, `gradeFor`) — these are calibrated against community
numbers and meant to be tuned as we collect more samples.

## Disclaimer

Fan project. Not affiliated with Cygames, Inc. or Umamusume Pretty Derby.
Game data sourced from publicly available community resources.
