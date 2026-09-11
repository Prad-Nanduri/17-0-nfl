# NFL sport engine

The NFL package owns the nflverse ETL fixtures, domain types, rating model, and
Postgres loader. Its database tables retain the names from spec §5.2 and use
separate `nfl_*` tables because NFL rows have different identity and statistics
than CFB rows.

## Domain schema

`nfl_franchises` stores the 32 current nflverse teams and their stable
`franchise_key`; `nfl_franchise_seasons` stores regular-season records and the
confidence era. `nfl_players` stores GSIS identity and roster metadata.
`nfl_player_season_stats` stores one player/team/season row with a flat JSON
statistics map. `nfl_ratings` stores career-season ratings.

The migration adds `franchise_key`, nflverse team and logo identifiers, player
GSIS/PFR/ESPN identifiers, position groups, games, percentile and composite
scores, qualification, confidence tiers, and `is_team_level_proxy`.
`nfl_legacy_player_careers` and `nfl_legacy_ratings` hold pre-1999 career
inputs and ratings.

## Statistics and proxies

Raw nflverse totals are retained in `stats`. Common keys are
`offenseSnaps`, `defenseSnaps`, `stSnaps`, and `games`. QB keys include
`passAttempts`, `completions`, `passingYards`, `passingTds`, `interceptions`,
`sacks`, `sackYards`, `rushingEpa`, `rushingYards`, and ANY/A-style
`anyPerAttempt`, `tdRate`, `intRate`, and `completionPct`.

RB keys include carries, rushing/receiving totals, `yardsPerCarry`,
`rushYardsShare`, and PFR `brokenTackleRate`. WR/TE keys include targets,
receiving totals, `targetShare`, and `yardsPerRouteProxy`. The latter is
receiving yards divided by offensive snaps: nflverse does not provide routes
run, so this is a documented YPRR proxy.

OL rows include team `teamPressureRateAllowed`,
`teamYardsBeforeContactPerAtt`, and penalties. These are team-level proxies
because nflverse does not provide per-player OL pressures or PFF grades; OL
rows set `isTeamLevelProxy` to true.

DL rows include tackles, sacks, QB hits, tackles for loss, PFR pressures,
`pressureRate`, and `runStopProxy`. LB/CB/S rows include tackle and coverage
inputs plus `coverageProxy`, derived from passer rating allowed when at least
15 targets are available.

K rows include distance-bucket accuracy, PAT totals,
`kickoffTouchbackRate`, and clutch field-goal percentage. P rows include punt
count, gross/net averages, `inside20Rate`, and clutch net average. PBP-derived
values are null when PBP is unavailable.

## Ratings

Qualified rows are grouped by season and position. Each §1.3 component is
population-z-scored, weighted into a composite, optionally inverted, ranked by
percentile, and mapped to the inclusive 40–99 scale. The exact qualification
floors are QB 100 pass attempts, RB 50 carries, WR 25 targets, TE 20 targets,
OL 300 offensive snaps, front-seven/secondary 200 defensive snaps, K 10 field
goal attempts, and P 20 punts. Unqualified rows receive exactly 40.

## Legacy era

The shared `resolveConfidenceTier` helper uses 1999 as the NFL full-feature
cutoff. `nfl_data_py==0.3.3` has no seasonal stats or seasonal rosters before
1999 (`import_seasonal_data([1998])` raises `Data not available before 1999`).
Legacy ratings therefore use draft-pick career data and are per-career rather
than per-season. Pre-1999 franchise depth charts require another source and
remain an open item.

For 2023 roster rows, an `LB` whose depth-chart role is `OLB` is treated as an
edge/DL rating row while its roster `primaryPosition` remains `LB`. This keeps
edge defenders comparable to the nflverse defensive-role feed.

## Re-running the ETL

From this package, create a Python 3.11 environment and install the pinned
dependencies:

```sh
uv venv .venv --python 3.11
uv pip install -r etl/requirements.txt
python etl/run_etl.py --season 2023 --out data/2023 --legacy-drafts 1980-1998
npm run etl:rate -w @perfect-season/sport-engine-nfl
npm run etl:load -w @perfect-season/sport-engine-nfl
```

The ETL caches raw frames under `etl/.staging`, supports `--refresh`, and
accepts `--skip-pbp` when the PBP source is unavailable. This version of
`nfl_data_py` exposes `import_seasonal_rosters`, not `import_rosters`.
