# Perfect Season

**Live: https://17-0-nfl.vercel.app**

I built this because I genuinely love football — Sundays on the NFL, Saturdays on
college ball. The idea came straight from
[**38-0-0**](https://38-0-0.com/), the "build the perfect English league XI" game:
spin for a club-season, draft one player from its real squad, repeat until the XI is
full, then simulate and chase an unbeaten season. It is a brilliant loop, and there
was no American-football equivalent. So I built one —
for both the NFL (17-0) and NCAA FBS (Undefeated & Untied) — on real historical data
from two decades of seasons instead of made-up names.

<img width="842" height="762" alt="perfectSzn1" src="https://github.com/user-attachments/assets/5e93c7ac-db68-4cb9-baa1-544a4be95d0d" />
<img width="1827" height="852" alt="PerfectSzn" src="https://github.com/user-attachments/assets/1707d705-356d-4ae9-b502-a66a287bd8af" />


Everything below describes what is actually in this repository today. Planned work
lives in [Roadmap](#whats-not-built--roadmap), not in the feature list.

## How to play

1. Pick your sport — NFL or NCAA FBS.
2. Spin. Each spin resolves a **franchise season** (e.x. "Kansas City, 2019", "Penn State 2024", or
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

### Free-tier architecture & cost

Production runs at **https://17-0-nfl.vercel.app** (Vercel project `17-0-nfl`, root
directory `apps/web`, Node 20.x, install command
`npm ci --include-workspace-root --workspaces --include=dev`). One deployment serves
both sports; the simulation is one polymorphic package running inside a Vercel
Serverless Function, not two services.

#### What is actually provisioned

| Layer                | Service / tier                                         | Used for today                                                                                                                      | Monthly cost |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Hosting + serverless | Vercel Hobby                                           | Next.js 14 App Router build, `/play/{nfl,cfb}` + `/api/**` route handlers, OG share-card renderer                                   | $0           |
| Postgres / Auth      | Supabase Free                                          | 6 migrations applied; `drafts` + `season_results` power the leaderboard, Supabase Auth issues the magic links for optional accounts | $0           |
| Redis                | Upstash Redis Free (REST API)                          | Draft state, guest sessions, pending result claims (`apps/web/lib/server/redis-store.ts`) so drafts survive serverless cold starts  | $0           |
| Media                | ESPN CDN team logos (`a.espncdn.com`) via `next/image` | Franchise/program logo URLs; no ESPN API keys involved                                                                              | $0           |
| Analytics / logs     | Vercel Web Analytics + Vercel runtime logs             | `@vercel/analytics` mounted in `apps/web/app/layout.tsx`; function logs in the Vercel dashboard                                     | $0           |
| ETL                  | Local / GitHub Actions                                 | `packages/sport-engine-{nfl,cfb}/etl` — rated output is committed, so production does no ETL and makes no metered data calls        | $0           |

**Total infrastructure cost at current traffic: $0/month.** Nothing above has a card
attached; every service is on its permanent free tier, not a trial. The rated data set
(~187 MB of minified JSON: NFL 2005–2024 + CFB 2005–2025) is bundled into the
serverless functions via `outputFileTracingIncludes`, scoped per sport so each function
stays under Vercel's 250 MB limit.

#### What the free tiers cap me at

| Limit                       | Free-tier ceiling                                                                         | What a hobby-traffic draft costs                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vercel bandwidth            | 100 GB / month                                                                            | A full 24-pick draft transfers ≈1–2 MB (logos cached by the browser after first load) |
| Vercel serverless execution | 100 GB-hours / month, 10 s default duration                                               | Season simulation runs in tens of ms; share-card render < 1 s                         |
| Vercel Web Analytics        | Hobby event cap (tens of thousands of events / mo)                                        | ~10 page views per draft                                                              |
| Vercel runtime logs         | 1 hour retention on Hobby                                                                 | Debugging only; nothing depends on log retention                                      |
| Upstash Redis               | 500k commands / month, 256 MB, 10k cmds/s                                                 | ≈60 commands per completed draft (create, ~48 spin/pick updates, reads)               |
| Supabase                    | 500 MB Postgres, 1 GB storage, 5 GB egress, 2 free projects; **pauses after 7 days idle** | Two small rows per completed draft + one leaderboard read per page load / 45 s poll   |

Ceilings are taken from each provider's public pricing page at deploy time — re-check
them before relying on a number. When the Web Analytics cap is hit the dashboard just
stops counting; the game keeps working. Upstash's 500k-command budget supports roughly
8,000 completed drafts a month before anything is throttled.

#### What changes if traffic scales past hobby level

Scaling is a deliberate non-goal for v1. This is what would have to change, in the
order it would bite:

1. **Supabase idle pause** — the free project pauses after a week without traffic.
   The leaderboard and magic links depend on Postgres, so a quiet week means the
   first visitor sees an empty leaderboard until the project wakes. Fix is a weekly
   keep-alive ping (GitHub Actions cron, still $0) or Supabase Pro ($25/mo).
2. **Vercel Hobby is personal/non-commercial only.** Any monetization, or sustained
   traffic beyond 100 GB bandwidth / 100 GB-hrs, means Vercel Pro ($20/user/mo) —
   which also lifts log retention and the analytics event cap.
3. **Upstash** — past 500k commands/month the free tier throttles; pay-as-you-go is
   $0.20 per 100k commands with no monthly minimum, so a 10× traffic jump is ≈$10/mo.
4. **Web Analytics** — past the Hobby event cap either stop tracking or move to Pro.
5. **Realtime live drafts** — Supabase Realtime's free tier allows 200 concurrent
   connections and 2M messages/month; multiplayer would be the first feature to push
   toward Pro.

#### Runtime persistence note

Draft and guest-session state live in Upstash Redis when `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` are set (production) and in process memory otherwise (local
dev, tests). Drafts expire from Redis after 7 days, guest sessions after 30 days.
When a season is simulated, the completed draft and its result are also written to
Supabase Postgres (`drafts`, `season_results`) as a fire-and-forget side effect — a
Postgres hiccup never breaks the simulate response — and that is what the leaderboard
reads. Pending "save under my name" claims sit in Redis for one hour until the magic
link is clicked.

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
in-memory stores, and the leaderboard/account endpoints report themselves as not
enabled instead of erroring.

### Environment variables

Copy `.env.example` to `.env.local`. Missing variables fail fast via
`@perfect-season/db`'s `requireEnv` rather than half-working.

| Variable                                             | Needed for                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Persistent drafts/sessions/claims (otherwise in-memory)                  |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`                  | Magic-link accounts                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                          | Leaderboard writes/reads — server-side only, never shipped to the client |
| `CFBD_API_KEY`                                       | Running the CFB ETL only (free key from collegefootballdata.com)         |
| `DATABASE_URL`                                       | Local Postgres when running migrations against a dev database            |

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

## License

Built by [Prad Nanduri](https://www.linkedin.com/in/pradnanduri). Proprietary —
all rights reserved; copying, duplication, or redistribution of the code is not
permitted without written permission. See [LICENSE](LICENSE).
