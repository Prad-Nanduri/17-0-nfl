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

## Further reading

- `docs/spec.md` — full technical spec (the source of truth)
- `AGENTS.md` — contributor/agent conventions
