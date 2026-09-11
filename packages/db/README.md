# Database package

## Local plain Postgres

Start a local Postgres 16 container:

```sh
docker run --name perfect-season-pg -e POSTGRES_PASSWORD=postgres -p 54329:5432 -d postgres:16
```

Set the local-only connection string:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres
```

Apply migrations with the development helper (running it again is idempotent):

```sh
npm run migrate -w @perfect-season/db
npm run seed -w @perfect-season/db
DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres npm test
```

`seed` is development-only. It requires `DATABASE_URL`, refuses `NODE_ENV=production`, and
refuses non-local database hosts unless `ALLOW_REMOTE_SEED=1`. It truncates platform tables before
inserting deterministic fixtures, so do not run it against shared data.

## Supabase CLI

Initialize and start Supabase once:

```sh
supabase init
supabase start
supabase db reset
```

`supabase db reset` applies migrations from the Supabase migrations directory. The repository's
SQL lives in `packages/db/migrations`; point Supabase at that directory with the
`[db.migrations] schema_paths` setting in `supabase/config.toml`, or use a symlink/pointer from
`supabase/migrations` to `packages/db/migrations`. The Docker/plain-Postgres path above was
verified locally; the Supabase path and `schema_paths` configuration are documented from the
Supabase CLI workflow and were not run on this machine.

## Schema scope

| Spec §5.2 platform core                        | NFL domain families                          |
| ---------------------------------------------- | -------------------------------------------- |
| `users`, `sessions`, `drafts`, `draft_picks`   | `nfl_*` tables                               |
| `season_results`, campaign/challenge tables    | `cfb_*` tables                               |
| Multiplayer rooms and participants             | NFL teams, players, stats, ratings           |
| Leaderboards, trophies, user trophies, streaks | CFB domain families and ETL/domain seed data |
| `sport_id_enum` and its immutability trigger   | —                                            |

The platform tables are shared across sports and use `sport_id` where applicable. NFL
domain tables ship in `20260911000002_nfl_domain.sql`; CFB domain tables remain deferred.
