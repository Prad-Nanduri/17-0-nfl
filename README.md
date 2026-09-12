# Perfect Season

A two-sport (NFL + College Football) draft-and-simulate web platform built around a single
pluggable `SportEngine` abstraction — see `docs/spec.md` for the full technical spec.

## Workspaces

npm workspaces (chosen over pnpm because it needs no extra install and
`npm install && npm run build` works from a bare Node 20).

## Repo layout (docs/spec.md §5.6)

| Directory                    | Package                             | Purpose                                                            |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `apps/web`                   | `@perfect-season/web`               | Next.js 14 App Router frontend, serves both sports off one deploy  |
| `packages/sport-engine-core` | `@perfect-season/sport-engine-core` | `SportEngine` interface + `SportEngineRegistry` (spec §0.1)        |
| `packages/sport-engine-nfl`  | `@perfect-season/sport-engine-nfl`  | NFL `SportEngine` implementation (lands in a later PR)             |
| `packages/sport-engine-cfb`  | `@perfect-season/sport-engine-cfb`  | CFB `SportEngine` implementation (lands in a later PR)             |
| `packages/simulation`        | `@perfect-season/simulation`        | Polymorphic simulation service over `SportEngine.simulateSeason()` |
| `packages/db`                | `@perfect-season/db`                | Supabase + Upstash Redis client factories                          |

## Scripts

| Script                 | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the Next.js dev server (`apps/web`)       |
| `npm run build`        | Build/typecheck all workspaces                  |
| `npm run typecheck`    | `tsc --noEmit` in every workspace               |
| `npm run lint`         | ESLint 9 flat config over the whole repo        |
| `npm test`             | Vitest (passes with no tests while scaffolding) |
| `npm run format`       | Prettier write                                  |
| `npm run format:check` | Prettier check                                  |

## Environment variables

Copy `.env.example` to `.env.local` and fill in Supabase + Upstash credentials.
Missing vars fail fast with a clear error from `@perfect-season/db`'s `requireEnv`.

## 7. Free-tier architecture & cost

Production: **https://17-0-nfl.vercel.app** (Vercel project `17-0-nfl`, root directory `apps/web`,
Node 20.x, install command `npm ci --include-workspace-root --workspaces --include=dev`).

### What is actually provisioned

| Layer                  | Service / tier                                         | Used for today                                                                                      | Monthly cost |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------ |
| Hosting + serverless   | Vercel Hobby                                           | Next.js 14 App Router build, `/play/nfl` + `/api/**` route handlers, OG share-card renderer         | $0           |
| Postgres / Auth / etc. | Supabase Free (project `17-0-nfl`, `us-east-1`)        | Schema from `packages/db/migrations` applied (4 migrations); not yet read by the web app at runtime | $0           |
| Redis                  | Upstash Redis Free (`17-0-nfl`, REST API)              | Draft state + guest sessions (`apps/web/lib/server/redis-store.ts`) so drafts survive cold starts   | $0           |
| Media                  | ESPN CDN team logos (`a.espncdn.com`) via `next/image` | Logo URLs are resolved once per franchise and cached in-process; no ESPN API keys involved          | $0           |
| Analytics / logs       | Vercel Web Analytics + Vercel runtime logs             | `@vercel/analytics` mounted in `apps/web/app/layout.tsx`; function logs in the Vercel dashboard     | $0           |
| ETL                    | GitHub Actions (public repo)                           | `packages/sport-engine-nfl/etl` — fixture JSON is committed, so production does no ETL at all       | $0           |

**Total infrastructure cost at current traffic: $0/month.** Nothing above has a card attached; every
service is on its permanent free tier, not a trial. The fixture data set (~8.6 MB of JSON) is bundled
into the serverless function via `outputFileTracingIncludes`, so the app makes zero paid or metered
data calls per request.

The seed script (`packages/db/seed.ts`) has **not** been run against the production Supabase project —
only the migrations. The database is empty apart from the schema.

### What the free tiers cap us at

| Limit                       | Free-tier ceiling (as of Sept 2026)                                                       | What a hobby-traffic draft costs                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vercel bandwidth            | 100 GB / month                                                                            | A full 24-pick draft transfers ≈1–2 MB (logos cached by the browser after first load) |
| Vercel serverless execution | 100 GB-hours / month, 10 s default duration                                               | Season simulation runs in tens of ms; share-card SVG→PNG render < 1 s                 |
| Vercel Web Analytics        | Hobby event cap (tens of thousands of events / mo)                                        | ~10 page views per draft                                                              |
| Vercel runtime logs         | 1 hour retention on Hobby                                                                 | Debugging only; nothing depends on log retention                                      |
| Upstash Redis               | 500k commands / month, 256 MB, 10k cmds/s                                                 | ≈60 commands per completed draft (create, ~48 spin/pick updates, reads)               |
| Supabase                    | 500 MB Postgres, 1 GB storage, 5 GB egress, 2 free projects; **pauses after 7 days idle** | Schema only today, so ~0                                                              |

Ceilings are taken from each provider's public pricing page at deploy time — re-check them before
relying on a number. When the Web Analytics cap is hit the dashboard just stops counting — the game keeps working. Upstash's
500k-command budget supports roughly 8,000 completed drafts a month before anything is throttled.

### What changes if traffic scales past hobby level

Scaling is a deliberate non-goal for v1; this is what would have to change, in order of when it bites:

1. **Supabase idle pause** — the free project pauses after a week without traffic. Today nothing in the
   request path touches Postgres, so users never notice; once accounts/leaderboards move into Supabase
   this either needs a weekly keep-alive ping (GitHub Actions cron, still $0) or Supabase Pro ($25/mo).
2. **Vercel Hobby is personal/non-commercial only.** Any monetization, or sustained traffic beyond
   100 GB bandwidth / 100 GB-hrs, means Vercel Pro ($20/user/mo) — which also lifts log retention to
   1 day and raises the analytics event cap.
3. **Upstash** — past 500k commands/month the free tier throttles; the pay-as-you-go plan is $0.20 per
   100k commands with no monthly minimum, so a 10× traffic jump costs ≈$10/mo.
4. **Web Analytics** — past the Hobby event cap either stop tracking or move to Vercel Pro.
5. **Realtime live drafts / leaderboards** — Supabase Realtime free tier allows 200 concurrent
   connections and 2M messages/month; a busy live-draft feature would be the first thing to push
   toward Pro.

### Runtime persistence note

Draft and guest-session state live in Upstash Redis when `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` are set (production), and in process memory otherwise (local dev, tests).
Drafts expire from Redis after 7 days and guest sessions after 30 days. Supabase is provisioned and
migrated but is not yet in the request path — accounts, leaderboards and trophies persisting to
Postgres are the next milestone (spec §5.2).

## Further reading

- `docs/spec.md` — full technical spec (the source of truth)
- `AGENTS.md` — contributor/agent conventions
