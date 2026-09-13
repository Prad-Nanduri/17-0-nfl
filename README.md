# Perfect Season

**Live: https://17-0-nfl.vercel.app**

I built this because I genuinely love football — Sundays on the NFL, Saturdays on
college ball. The inspiration was the mobile game _38-0_: draft a squad, simulate a
season, chase a perfect record. I wanted the American-football version of that loop —
pick a franchise season, pull a player from its real roster, repeat 24 times, then
watch the season play out — for both the NFL and NCAA FBS, with real historical data
instead of made-up names.

Everything below describes what is actually in this repository today. Planned work
lives in [Roadmap](#whats-not-built--roadmap), not in the feature list.

## How to play

1. Pick your sport — NFL or NCAA FBS.
2. Spin. Each spin resolves a **franchise season** (e.g. "Kansas City, 2019" or
   "Georgia, 2022") and offers players who were actually on that roster.
3. Draft 24 players into a scheme-shaped roster (position eligibility is enforced —
   a spin's candidates only fill the slots they can genuinely play).
4. Simulate the season: NFL plays a 17-game schedule plus playoffs; CFB plays a
   12-game Quick Season. Earn trophies, get a shareable season card.
5. Play as a guest — no account, no email. If you want your name on the
   leaderboard, an optional magic-link prompt after the season lets you claim the
   result; skipping it changes nothing.

## The core technical story: one `SportEngine`, two sports

The platform is built around a single interface, `SportEngine`
(`packages/sport-engine-core`). Draft routes, spin UI, sessions, trophies,
leaderboards, and share cards never touch sport logic directly — they call
`registry.get(draft.sportId).method(...)`. `NflSportEngine` and `CfbSportEngine`
are two fully independent implementations; there is deliberately no shared base
class a CFB change could accidentally leak into.

This isn't a diagram-level claim. Adding the entire CFB engine —
positions, schemes, slot eligibility, spin resolution, modes, simulation config,
and trophies — landed as [PR #19](https://github.com/Prad-Nanduri/17-0-nfl/pull/19):
all of its engine code went into `packages/sport-engine-cfb`, and the only files
outside that package were the two-line registry registrations wiring the new
engine in. The one platform-core change the sport ever needed was hoisting shared
scheme presets into the interface package
([PR #20](https://github.com/Prad-Nanduri/17-0-nfl/pull/20)), and that PR carried a
400-line NFL regression test proving the NFL engine behaved identically afterward.

## Architecture

npm-workspaces monorepo (chosen over pnpm so `npm install && npm run build` works
on bare Node 20):

| Directory                    | Package                             | Purpose                                                       |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `apps/web`                   | `@perfect-season/web`               | Next.js 14 App Router — one deployment serves both sports     |
| `packages/sport-engine-core` | `@perfect-season/sport-engine-core` | `SportEngine` interface + registry + shared Elo/RNG utilities |
| `packages/sport-engine-nfl`  | `@perfect-season/sport-engine-nfl`  | NFL engine + nflverse ETL                                     |
| `packages/sport-engine-cfb`  | `@perfect-season/sport-engine-cfb`  | CFB engine + CollegeFootballData ETL                          |
| `packages/simulation`        | `@perfect-season/simulation`        | Polymorphic season simulator over `SportEngine`               |
| `packages/db`                | `@perfect-season/db`                | Supabase (Postgres/Auth) + Upstash Redis client factories     |

Free-tier stack, $0/month at hobby traffic: **Vercel Hobby** (build + serverless +
OG card renderer), **Supabase free** (Postgres + Auth — the leaderboard and
magic-link accounts), **Upstash Redis free** (draft state, guest sessions,
pending result claims). Team logos come from ESPN's public CDN. The full capacity
math and what would have to change past hobby scale are in `docs/spec.md` §7 —
the short version: the Upstash free tier alone supports ~8,000 completed
drafts/month.

### Simulation: the 80/20 guardrail

Your roster is supposed to decide your season — opponent strength shapes _who you
play and how scary the schedule looks_, not whether you win. That's enforced, not
asserted: `simulateGame` computes
`effRosterRating = 0.80 * rosterRating + 0.20 * opponentRating`, then runs an Elo
win probability. `packages/simulation/verify-guardrail.ts` runs 1,000 simulated
seasons at roster ratings 90 and 55; current output:

```
rating 90: mean=0.762 win-share  p5=0.588  p95=0.941  (99.5% of seasons ≥ .500)
rating 55: mean=0.244 win-share  p5=0.118  p95=0.412  (1.0% of seasons ≥ .500)
```

A ~0.52 gap of means with real variance — good rosters are dominant but not
guaranteed, bad rosters struggle but can still steal a season.

## Data & methodology

Ratings are computed in-repo, not imported as a black-box grade: each engine's ETL
pulls real season data — **nflverse** for NFL player stats, snap counts, and PFR
metrics; **CollegeFootballData.com** for CFB — then percentile-ranks players
within their season population and maps to a 40–99 scale. Ratings are
era-normalized so a 2009 season and a 2024 season compare meaningfully, which is
what makes `prime` and `career_season` rating modes work.

Current coverage: **NFL franchise seasons 2005–2024** (nflverse has not published
2025 player stats yet — 2024 is the newest complete season) and **CFB program
seasons 2005–2025** — over 20,000 rated players per sport across two decades of
seasons.

Honest limits worth knowing:

- **CFB OL/DL ratings are a deliberate team-level proxy.** Public college data has
  no credible per-lineman stats, so each program's line rating derives from
  team-level efficiency (sack/stuff rates against the season population) and is
  shared by its linemen. It's a design decision documented in
  `src/ratings/line-proxy.ts`, not a missing data bug.
- Older seasons are sparser by nature — early-2000s CFB rosters have less stat
  coverage, which is exactly why spins re-resolve automatically if a drawn
  program-season can't field a slot-eligible candidate.

## What's built

- **Core Draft mode for both sports** — NFL 17-game + playoffs, CFB 12-game
  Quick Season (campaign mode `quick_season`).
- **Sport-specific spin UX** — the NFL uses a franchise-logo wheel; CFB uses a
  single-reel slot animation ([PR #26](https://github.com/Prad-Nanduri/17-0-nfl/pull/26)),
  built because ~130 FBS logos on a wheel were unreadable. Both always land on the
  server-resolved pick, verified programmatically in e2e tests.
- **Guest-first flow** — drafts run on a cookie + Upstash session; no signup
  friction, drafts survive serverless cold starts.
- **Optional account linking** — Supabase magic-link email upgrades a guest
  session; a post-draft prompt can claim a leaderboard result under your name
  ([PR #34](https://github.com/Prad-Nanduri/17-0-nfl/pull/34)).
- **Cross-sport leaderboard** — `/leaderboard`, per-sport tabs (rating scales
  aren't comparable), ranked by record then point differential, difficulty as a
  filter. Guests appear as generated aliases ("Prime-Time Falcons 76") — no
  session tokens or internal IDs are ever exposed.
- **Trophy MVP subsets** — NFL: `perfect_season`, `full_gauntlet`,
  `worst_in_show`, `ice_in_the_veins`. CFB: `undefeated_untied`, `the_natty`,
  `statement_win`, `overtime_classic`, `legacy_era_lineup`. Each renders as a card
  on the results page and in the OG share image.
- **OG share cards** per completed season, both sports.

## What's not built / roadmap

The spec (`docs/spec.md`) covers more than ships — scoping to a strong MVP was
intentional:

- **Full trophy cabinet** — the spec's ~101-trophy taxonomy; today each sport has
  an MVP subset. Adding trophies is now a data-definition exercise in each
  engine's `trophies/` directory, not architecture work.
- **One-Franchise / One-Program mode** — draft from a single team's history.
  Mode descriptors already exist in `modes.ts`; needs the mode-specific spin
  filtering wired through `resolveSpinUnit`.
- **Daily Challenge** — everyone spins the same seed daily. Needs a scheduled
  seed publisher (GitHub Actions cron + Redis) and a shared-result leaderboard view.
- **Playoff Draft / Blue-Blood Bracket / persistent campaigns** — larger draft
  modes; the CFB rankings/campaign machinery is the missing piece below.
- **CFB ranking lifecycle** — recruiting ranks, AP poll movement, and playoff
  results that feed back into future seasons. The poll tables are already
  migrated (`cfb_*` ground-truth polls); needs the lifecycle engine.
- **True real-time multiplayer** — live drafts over Supabase Realtime. This is
  the one item that would push infrastructure off the strictest free tiers
  (Realtime concurrency limits).

## Local setup

```bash
npm install
npm run dev      # Next.js dev server on :3000
```

Guest drafts work with zero configuration — sessions and draft state fall back to
in-memory stores. To exercise persistence/auth locally, copy `.env.example` to
`.env.local` and fill in Supabase + Upstash values.

```bash
npm test         # Vitest across workspaces (engine, routes, regression suites)
npm run typecheck
npm run lint
npm run verify:guardrail -w @perfect-season/simulation
```

ETL lives in `packages/sport-engine-{nfl,cfb}/etl` (nflverse downloads for NFL;
CFBD API for CFB — needs a free collegefootballdata.com API key). Its output is
committed under each engine's `data/` directory, so you never need to run it to
play or deploy.

## Further reading

- `docs/spec.md` — the full technical spec (source of truth)
- `docs/qa/cross-sport-regression.md` — the NFL-unchanged regression pass from the
  CFB rollout
- `AGENTS.md` — contributor conventions
