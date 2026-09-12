# CFB sport engine

The CFB package owns the CFBD (collegefootballdata.com) ETL pipeline, domain
types, rating model, and Postgres loader. Its database tables use the `cfb_*`
family from spec §5.2 — separate from `nfl_*` because CFB rows have different
identity (program-seasons, per-season conference membership, poll history) than
NFL franchise rows.

## Domain schema

- `cfb_conferences` — conference dimension keyed by `conference_key`, with
  `is_active` and founding/dissolution years so defunct conferences still render
  on historical team-season cards (§2A.2, §4.3).
- `cfb_teams` — CFBD `teamId` identity, school, mascot/logo, blue-blood flag.
- `cfb_program_seasons` — one row per program per season: `membership_status`
  (`fbs`/`reclassifying`/`fcs`, §2A.1), `conference_id` **for that season**
  (§2A.2), record, AP ranks (§2A.3), `cfp_result`, `bowl_result`, recruiting
  rank/points, `era_tier`, and a `team_line_stats_jsonb` column holding the
  `CfbTeamLineStats` inputs to the §2A.6 line proxy.
- `cfb_games` — CFBD game ids with `game_type`
  (`regular`/`conference_championship`/`bowl`/`cfp`/`national_championship`).
- `cfb_players`, `cfb_player_season_stats` (JSONB stat map keyed
  `category.statType`), `cfb_ratings`.
- `cfb_ap_rankings_weekly` / `cfb_cfp_rankings_weekly` — ground-truth poll
  imports (§2B.3); week 99 marks the final/postseason release.
- `cfb_recruits` — 247Composite recruiting rows joined to players via
  `roster.recruitIds`.

## Per-season FBS membership (§2A.1)

FBS membership is validated per season, never against today's list. The ETL
fetches `/teams/fbs?year=` for the target season **plus the next two seasons**;
`resolveMembershipStatus` marks a school `fbs` when present that year,
`reclassifying` when it enters the FBS list within the 2-year NCAA window, and
`fcs` otherwise. Only `fbs` program-seasons enter the spin pool
(`filterSpinPool`) and postseason-eligible filters — a 2018 reclassifier has no
pre-2018 FBS team-seasons in the pool even though it is FBS today.

## Conference dimension (§2A.2, §4.3)

`conferenceKey(name)` slugifies conference names. `buildConferenceDimension`
merges the current `/conferences` payload with conference names observed on
per-season `/teams` rows; names not in the current payload become inactive
entries, backfilled with founding/dissolution years from
`KNOWN_DEFUNCT_CONFERENCES` (Big East, WAC, Southwest, Big Eight, Big West).
`describeConference` produces the spin-card label and footnote ("Conference no
longer exists" / "Program has since moved to X").

## Confidence tiers (§4.1)

`CFB_ERA_CUTOFF` is 2005 via the shared `resolveConfidenceTier` helper: CFBD
play-by-play-derived advanced stats solidify around 2005; earlier seasons are
Legacy Era.

## Ratings (§2A.6)

OL/DL rows use the team-level proxy composite:

```
0.40 * team_line_efficiency_percentile   // sack rate + stuff rate, z-scored & ranked
  + 0.35 * selection_bonus               // All-American 1.0 / All-Conference 0.6 / none 0
  + 0.25 * games_started_share
```

mapped onto the shared 40–99 scale (`toRatingScale`). OL efficiency inverts
sack rate allowed and stuff rate allowed (lower is better); DL efficiency uses
sack rate and stuff rate produced (higher is better). Rows carry
`isTeamLevelProxy: true` and the `team_level_rating` badge so the UI can
disclose that an OL rating reflects team line performance more than isolated
individual stats.

Skill positions currently use an interim placeholder — percentile of the raw
sum of numeric stats within (season, positionGroup) — until the CFB
skill-position composite PR lands. `ratingMode` is `career_season` only.

## ETL (TypeScript end-to-end; no Python — CFBD is a plain REST API)

All live pulls require a free CFBD key in `CFBD_API_KEY`
(https://collegefootballdata.com/key). The client retries 429/5xx (max 3
attempts) and optionally caches raw responses under `--staging`.

```sh
CFBD_API_KEY=... npm.cmd run etl:extract -w @perfect-season/sport-engine-cfb -- --season 2023 --out data/2023
npm.cmd run etl:rate -w @perfect-season/sport-engine-cfb -- --season 2023
npm.cmd run etl:load -w @perfect-season/sport-engine-cfb -- --season 2023   # needs DATABASE_URL
```

`etl:extract` pulls `/teams`, `/teams/fbs` (season..season+2), `/conferences`,
`/roster`, `/stats/player/season` per category, `/stats/season`,
`/stats/season/advanced`, `/rankings` (regular+postseason), `/recruiting/*`,
`/rushing/teams/season`, and `/games` (regular+postseason), then writes one JSON
file per output table plus `manifest.json` under `data/<season>/`.

## SportEngine (§0.1, §2A)

`CfbSportEngine` is the second full `SportEngine` implementation —
`displayName` "College Football (FBS)", 24 roster slots, registered alongside
`NflSportEngine` via `apps/web/lib/server/sport-engines.ts`
(`createSportEngineRegistry({ nfl, cfb })`). All platform dispatch goes through
the registry's `get(sportId)`.

- **Schemes**: `CFB_SCHEME_PRESETS` reuses the NFL slot shapes; the Nickel
  preset is renamed "Spread Defense" in UI copy only (§2A.6).
- **Modes** (§2A.7): `core` (Quick Season default — chase "Undefeated &
  Untied"), `one_program` (Prime enabled), `blue_blood_bracket` (elite pool,
  bracketed Full Campaign), `ranked_only`, `daily_challenge`,
  `conference_trophy`, `mp_live_draft`, `mp_leagues` (Full Campaign only,
  bracket-weighted league scoring), `mp_last_one_standing`.
- **Simulation** (§2A.4): 12-game regular season; Full Campaign adds a
  conference-championship gate (≥10 wins), then a CFP bracket (seed-dependent
  3–4 rounds) or a bowl game. CFB overtime has no cap and no ties.
- **Ratings**: `computeRating` looks up ETL ratings; unrated OL/DL candidates
  fall back to overall 40 with `isTeamLevelProxy: true`, and
  `getRatingBadges()` surfaces the `team_level_rating` badge for the UI's
  "Team-Level Rating" disclosure (§2A.6).
- `describeSpinUnit` returns the spin-card title "School (Conference · Season)"
  plus the realignment/defunct-conference footnote (§2A.2).

## Known gaps

- **No CFBD awards endpoint**: `all_conference`/`all_american` are always
  `false`; the selection-bonus component of the OL/DL proxy is inert until an
  awards source is added.
- `games_started` is always null — CFBD does not expose starts, so the
  durability component is currently inert too.
- Sacks allowed come from `/rushing/teams/season` `sacks` (offense's sacks
  taken); `/stats/season/advanced` has no sack field at all.
- `isTransferThisSeason` is a `false` placeholder; `/player/portal` exists but
  is not wired in yet.
- `cfp_result` adds `runner_up` (title-game loser) to the spec's enum.
- Preseason AP rank uses the week-1 regular poll (CFBD has no separate
  preseason feed on `/rankings`).
