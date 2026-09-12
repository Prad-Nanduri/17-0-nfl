# Perfect Season

**Draft it. Play it. Chase perfection.**

Live: <https://17-0-nfl.vercel.app>

## 1. What this is

Perfect Season is a **two-sport draft-and-simulate platform built around a single pluggable `SportEngine` abstraction** — it is not "a football game with a college mode bolted on." The platform core (draft UI, spin resolution, sessions/accounts, trophies, share cards) depends only on the `SportEngine` interface from `packages/sport-engine-core`, and two fully independent implementations — `NflSportEngine` and `CfbSportEngine` — plug into it through a `SportEngineRegistry`.

The game: spin for a real franchise/program-season, draft a 24-slot roster from that team's real players, then simulate a season. An NFL player chases **17-0**; a CFB player chases **Undefeated & Untied**. Guest play requires no signup; linking an email at `/account` (Supabase magic link) makes drafts follow the account.

Full technical spec: [`docs/spec.md`](docs/spec.md).

## 2. The core abstraction

```typescript
type SportId = 'nfl' | 'cfb';

interface SportEngine {
  readonly sportId: SportId;
  readonly rosterSlotCount: 24; // standardized across both sports

  resolveSpinUnit(seed, filters): Promise<DraftPoolUnit>;
  // (a) NFL -> { franchiseId, season }   CFB -> { programId, season, conferenceId, ... }

  getSchemePresets(): SchemePreset[]; // (b) roster/scheme presets
  validateSlotEligibility(candidate, slot): EligibilityResult; // slot-fit validation

  computeRating(candidate, mode): PositionRating; // (c) per-position-group rating
  // RatingMode = 'career_season' | 'prime'

  simulateSeason(roster, mode, context): Promise<SeasonResult>; // (d) roster -> season

  getModeRuleset(modeId): ModeRuleset; // (e) sport's own modes/rules
  getTrophyDefinitions(): TrophyDefinition[]; // (f) sport's own trophy logic
  evaluateTrophies(result, ctx): EarnedTrophy[];
}
```

Why each responsibility exists: (a) the spin is the draft's entry point, and what a "draftable unit" even _is_ differs per sport (franchise-season vs program-season-with-conference); (b) eligibility rules are sport-flavored (position aliases, versatility flags); (c) rating inputs differ wildly per position group and per sport; (d) "a season" is structurally different (17 games + playoff bracket vs 12 games + conference title + CFP/bowl); (e)/(f) modes and trophies are retention mechanics that should be authored per sport without forking the app.

`NflSportEngine` and `CfbSportEngine` implement the interface independently — no shared base class with sport overrides (that pattern is how CFB edits produce NFL bugs). They share only small genuinely-sport-agnostic utilities (Elo math, seeded RNG, roster-rating aggregation). Every platform dispatch is `registry.get(draft.sportId).method(...)`.

**The V1 checkpoint — the real proof:** adding CFB required zero modified lines in `packages/sport-engine-core`, `packages/sport-engine-nfl`, or any existing `apps/web` file. See the actual diff in [PR #19](https://github.com/Prad-Nanduri/17-0-nfl/pull/19) — `CfbSportEngine` lands as a new package plus one new registry file. (The follow-up that shipped real 2023 CFBD data and fixed the ETL is [PR #24](https://github.com/Prad-Nanduri/17-0-nfl/pull/24).)

**DB schema philosophy (spec §0.2):** hybrid, not purely polymorphic. Shared platform tables (`users`, `sessions`, `drafts`, `draft_picks`, `season_results`, trophies) carry a `sport_id` discriminator — `drafts.sport_id` is immutable once picks exist — while sport-domain data lives in separate table families (`nfl_franchise_seasons`, `cfb_program_seasons`, …) because their shapes genuinely differ. One set of tables for cross-sport features; per-sport families where polymorphism would just mean nullable columns.

## 3. Simulation methodology

Both engines implement the same `simulateSeason()` contract in `packages/simulation` — a shared drive/possession sampler (`drive-sampler.ts`) with per-sport config (possessions per game, scoring table) plus a shared schedule generator and Elo-style opponent model.

- **NFL:** 17-game regular season; optional **Full Gauntlet** toggle adds the playoff bracket.
- **CFB:** **Quick Season** — 12-game regular season (conference-title → CFP/bowl structure exists in the engine; not yet exposed in the shipped UI — see Roadmap). No ties.
- **The 80/20 guardrail (spec §2B.5, `guardrail.ts`):** a game outcome is a function of `0.80 × roster_aggregate_rating` versus `0.20 × opponent power_rating + baseline randomness`. Your draft quality dominates; ranking-derived opponent strength is a bounded 20% variance injection — so "just draft high-ranked players" is _not_ a winning strategy, and ranking data never overpowers draft skill.
- **Ratings:** per-position-group formulas, era-normalized (0–99). CFB OL/DL use an explicit **team-level proxy** rating (`isTeamLevelProxy`) because individual line play isn't measurable from public box-score stats — the UI badges those so the confidence model is honest.
- **Rankings disclaimer (stated in-app and here):** AP and CFP rankings are the sport's real, human-voted rankings. The platform's team-strength rating is our own simulation model, used to generate fair opponents and draft-pool flavor — never a substitute for or a prediction that overrides the real poll.

## 4. Data sourcing (spec §4)

- **NFL:** `nflverse` / `nfl_data_py` (free, open-source) — full-feature coverage 1999–present; earlier seasons are tagged `era: 'legacy'` and rated with a lighter formula plus a visible **Legacy Era** badge.
- **CFB:** CollegeFootballData (CFBD) free tier — the real 2023 dataset is committed under `packages/sport-engine-cfb/data/2023/` (136 programs, ~20.8k rated players, games, AP/CFP polls, recruits). ESPN's unofficial API supplies logos/headshots for both sports.
- **FBS membership is per-season, not a static list** (spec §2A.1): `reclassifying`/`fcs` programs never enter the spin pool, and a program's **conference is a first-class column of `program_seasons`** — conference realignment means last year's conference is a fact about that season (§2A.2).
- **ETL:** sport-specific extractors (`packages/sport-engine-cfb/etl/` — CFBD client with staging cache, retry on 429/5xx, sequential fetches to respect the free-tier rate limit) feed a shared transform → rate → load stage. NFL ETL output is committed under `packages/sport-engine-nfl/data/` (`franchise_seasons`, `legacy`, `2023`).

## 5. Modes & trophies — what actually ships today

Shipped in the UI:

- **Core Draft** (both sports): Squad-First or Position-First draft order, Easy/Normal/Hard difficulty (rerolls + rating visibility vary), Career-Season or Prime rating mode, single-reel slot animation for CFB / wheel for NFL, OG share card.
- **NFL:** 17-game sim + **Full Gauntlet** playoff toggle. Trophies: `perfect_season` (Perfect Season), `full_gauntlet` (The Full Gauntlet), `worst_in_show`, `ice_in_the_veins`.
- **CFB:** 12-game **Quick Season**. Trophies: `undefeated_untied` (Undefeated & Untied — 12-0 + conference title + national champion), `the_natty`, `statement_win`, `overtime_classic`, `legacy_era_lineup` (Legacy Era Lineup).

The engines already carry rulesets for the wider mode list (One-Franchise/One-Program, Blue-Blood Bracket, Ranked-Only, multiplayer ids), but only the core loop above is reachable in the product.

## 6. Free-tier architecture & cost (spec §5.1)

| Layer                                | Choice                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Frontend                             | Next.js 14 (App Router) + Tailwind + Framer Motion + dnd-kit                                                                   |
| Hosting                              | Vercel Hobby (free) — one deployment serves both sports                                                                        |
| Database / auth / realtime / storage | Supabase free tier (Postgres + Auth magic links + Realtime + Storage)                                                          |
| Cache / rate limiting / leaderboards | Upstash Redis free tier (pay-per-request fits hobby traffic)                                                                   |
| Simulation                           | `packages/simulation`, one polymorphic package behind `SportEngine.simulateSeason()`, running in the Next.js serverless routes |
| Media                                | ESPN unofficial endpoints (free, no key)                                                                                       |
| ETL                                  | Local/GitHub Actions on a public repo (unlimited minutes)                                                                      |

**Total infrastructure cost: $0** on free tiers at hobby traffic. Scaling past hobby traffic would mean paid Vercel/Supabase/Upstash tiers — a deliberate non-goal for V1.

## 7. Roadmap

Done: **MVP** (NFL Core Draft) → **V1** (CFB as the second `SportEngine` implementation — the abstraction checkpoint, PR #19 above).

### Not yet built (future work — spec references)

- **V2:** One-Franchise/One-Program mode, Daily Challenge, and the full per-sport trophy cabinets (§1.7, §2C). The **CFB ranking-lifecycle system** (§2B: official AP/CFP vs internal model vs projected movement, preseason projection, ranking-aware schedule strength, prediction trophies) ships here — it needs a full season of ingested game data to be meaningful. Engine-level CFB Full Campaign (conference championship → CFP/bowl) exists behind a flag and gets UI here.
- **V3:** Playoff Draft / Blue-Blood Bracket resumable campaigns, Leagues multiplayer with CFB's bracket-weighted scoring (§2A.7).
- **V4:** Live Draft real-time rooms, Last One Standing, sport-native extras (Combine mini-game, Weather/Injury cards, Beat the Champs, Draft-Class Synergy; Rivalry Week, Class Bond, Transfer Portal Wildcard, Heisman House) — §1.6, §2C.

Why CFB came second, not last (spec §6): adding a structurally different sport right after the thinnest first slice surfaces leaked sport-specific assumptions while they're cheap to fix — rather than discovering them after five NFL features were built on top.

## 8. Local setup

```sh
npm install
npm run dev        # Next.js dev server -> http://localhost:3000
npm run build      # build/typecheck all workspaces
npm run typecheck  # tsc --noEmit everywhere
npm run lint       # ESLint 9 flat config
npm test           # Vitest (~370 tests across engine + web)
```

Migrations (plain Postgres, or point `DATABASE_URL` at Supabase's pooler):

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres npm run migrate -w @perfect-season/db
```

CFB ETL (writes `packages/sport-engine-cfb/data/<season>/`; free key at <https://collegefootballdata.com/key>):

```sh
CFBD_API_KEY=... npx tsx packages/sport-engine-cfb/etl/run-etl.ts --season 2023
CFBD_API_KEY=... npx tsx packages/sport-engine-cfb/etl/rate.ts --season 2023
```

Copy `.env.example` for the full env-var list. Repo layout (spec §5.6): `apps/web` (Next.js frontend, both sports), `packages/sport-engine-core` (interface + registry), `packages/sport-engine-nfl` / `packages/sport-engine-cfb` (implementations + data/ETL), `packages/simulation` (shared sampler/schedule/guardrail), `packages/db` (migrations + client factories).
