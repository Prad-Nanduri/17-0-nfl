# NFL sport engine

The NFL package owns the nflverse ETL fixtures, domain types, rating model, and
Postgres loader. Its database tables retain the names from spec §5.2 and use
separate `nfl_*` tables because NFL rows have different identity and statistics
than CFB rows.

## Domain schema

`nfl_franchises` stores the 32 current nflverse teams and their stable
`franchise_key`; `nfl_franchise_seasons` stores regular-season records and the
confidence era. `nfl_players` stores GSIS identity and roster metadata.
`nfl_player_season_stats` stores one player/team/season row with a compact
position-specific JSON statistics map. `nfl_ratings` stores career-season
ratings.

The migration adds `franchise_key`, nflverse team and logo identifiers, player
GSIS/PFR/ESPN identifiers, position groups, games, percentile and composite
scores, qualification, confidence tiers, and `is_team_level_proxy`.
`nfl_legacy_player_careers` and `nfl_legacy_ratings` hold pre-1999 career
inputs and ratings.

## Draft schemes and eligibility

The engine exposes `4-3`, `3-4`, and `nickel` presets. Each has the same
11 offensive slots and kicker/punter slots, with defensive slots matching the
named front. A normalized primary position must be listed in a slot's
eligible positions. A player marked `versatile` may fill an adjacent position
group (CB/S, DL/LB, or OL cross-fill) with a warning rather than a hard block.
The flag is derived when a roster row's NGS or depth-chart position maps to a
different canonical group than its listed roster position; unknown metadata is
ignored.

## Statistics and proxies

Raw nflverse totals are retained only for the row's position group. Every row
has `games`, `offenseSnaps`, `defenseSnaps`, and `stSnaps`. Position keys are:

- QB: `passAttempts`, `completions`, `passingYards`, `passingTds`,
  `interceptions`, `sacks`, `sackYards`, `rushingEpa`, `rushingYards`,
  `anyPerAttempt`, `tdRate`, `intRate`, `completionPct`.
- RB: `carries`, `rushingYards`, `rushingTds`, `receivingYards`, `receptions`,
  `targets`, `yardsPerCarry`, `rushYardsShare`, `brokenTackleRate`.
- WR/TE: `targets`, `receptions`, `receivingYards`, `receivingTds`,
  `targetShare`, `yardsPerRouteProxy`.
- OL: `teamPressureRateAllowed`, `teamYardsBeforeContactPerAtt`, `penalties`.
  These are team-level proxies because nflverse does not provide per-player OL
  pressures or PFF grades; OL rows set `isTeamLevelProxy` to true.
- DL: `sacks`, `qbHits`, `tacklesForLoss`, `tacklesSolo`, `tackles`,
  `pfrPressures`, `pressureRate`, `runStopProxy`.
- LB/CB/S: `tackles`, `tacklesForLoss`, `tacklesSolo`, `interceptions`,
  `passDefended`, `pfrTargets`, `completionsAllowed`, `yardsAllowed`,
  `passerRatingAllowed`, `runStopProxy`, `coverageProxy`.
- K: `fgAtt`, `fgMade`, `fgPct`, distance-bucket made/attempt totals, `patAtt`,
  `patMade`, `accuracyByDistance`, `kickoffTouchbackRate`, `clutchFgPct`.
- P: `punts`, `grossAvg`, `netAvg`, `inside20Rate`, `clutchNetAvg`.

`yardsPerRouteProxy` is receiving yards divided by offensive snaps because
nflverse does not provide routes run. PBP-derived values are null only when
the direct PBP asset is unavailable.

Legacy career rows always retain `carAv`, `weightedAv`, `draftTeamAv`,
`proBowls`, `allPro`, `seasonsStarted`, and `games`. They add only the
position-relevant career box totals: passing totals for QBs, rushing and
receiving totals for RBs, receiving totals for WR/TE, defensive totals for
DL/LB/CB/S, and no extra totals for OL/K/P.

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

For 2023 roster rows, rating role classification uses the nflverse NGS role:
`ngsPosition == EDGE` maps to DL; when NGS position is null,
`position == LB` plus `depthChartPosition == OLB` also maps to DL for a
traditional 3-4 outside edge rusher. Otherwise the generic roster-position
mapping applies. `primaryPosition` remains the roster position, and
`ngsPosition`/`depthChartPosition` are retained on the player.

## Spin pool

The multi-season spin pool is committed at
`data/franchise_seasons/franchise_seasons.json`, with generation metadata in
`data/franchise_seasons/manifest.json`. Full-feature rows use regular-season
records from 1999 onward; legacy rows use draft seasons and nullable records.
The engine returns stable `franchiseKey` values in spin units; database numeric
IDs are only loader concerns.

Historical draft keys are normalized by the explicit ETL map: `GNB`→`GB`,
`KAN`→`KC`, `NOR`→`NO`, `NWE`→`NE`, `SFO`→`SF`, `TAM`→`TB`, `SDG`→`LAC`,
`RAI`→`LV`, `RAM`/`STL`→`LA`, `PHO`→`ARI`, `OAK`→`LV`; Houston and Baltimore
use season-aware Oilers/Colts mappings. Unmapped keys are reported in the
spin-pool manifest rather than guessed.

## Logos and sampling

`createLogoResolver` uses the ESPN team endpoint with positive caching for
24 hours, failure caching for five minutes, a three-second timeout,
in-flight deduplication, and `/logos/nfl-placeholder.svg` fallback. The
`spin:sample` script runs twenty deterministic seeds and prints franchise
frequencies:

```sh
npm run spin:sample -w @perfect-season/sport-engine-nfl
```

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
accepts `--skip-pbp` when the PBP source is unavailable. Add
`--franchise-seasons 1999-2023` to generate the multi-season spin pool. This version of
`nfl_data_py` exposes `import_seasonal_rosters`, not `import_rosters`.

## Simulation

NFL simulation uses 17 regular-season games. The shared simulation package
maps ratings to Elo with `1500 + (rating - 50) * 16`, then applies the 80/20
roster/opponent guardrail before drive-by-drive scoring. Regular-season
overtime allows one period and ties; Full Gauntlet playoff overtime continues
until a winner.

Records qualify for the playoffs at `wins + 0.5 * ties >= 10`. A 14-win
equivalent record earns seed 1 and a divisional bye; 12–13 win-equivalent
records receive seeds 2–4, and other qualifying records receive seeds 5–7.
The engine-owned postseason outcome codes are `missed_playoffs`,
`lost_wild_card`, `lost_divisional`, `lost_conference`, `lost_super_bowl`,
and `won_super_bowl`.
