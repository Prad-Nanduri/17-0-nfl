# Sport engine boundary

## Dispatch (§0.1)

Platform features import `SportEngine` and the DTOs from
`@perfect-season/sport-engine-core`. The application's composition root supplies
fully initialized engines once:

```ts
const registry = createSportEngineRegistry({ nfl: nflEngine, cfb: cfbEngine });
const engine = registry.get(draft.sportId);
const result = await engine.simulateSeason(roster, mode, opponents);
```

The registry is a `Record<SportId, SportEngine>` plus `.get()`. It checks the
engine's sport and 24-slot contract, copies/freezes bindings, and dispatches without
transforming inputs or suppressing errors. Only the composition root imports
concrete engines; there is no global singleton or shared engine base class.
Engines independently implement all nine methods and may import
`@perfect-season/sport-engine-core/utils`. Platform features call the interface.
The unexported mock in `test/` supplies typed, canned responses to every method.

## Data decisions and review points

§0.1 leaves most DTO fields open. Assumptions to review before real engines:

- **IDs:** decimal strings preserve BIGINT precision in JSON. Pool units retain
  the spec's franchise/program fields with a `sportId` discriminant; independent
  programs have a null conference, and absent ranking fields mean unavailable.
- **Ratings:** candidates carry season history, numeric stats and typed traits.
  Engines own metric names and must preload reference populations to implement
  the specified synchronous `computeRating`.
- **Rosters:** readonly 24-entry tuples enforce length in TypeScript. Engines/API
  boundaries must still validate JSON, player/season ownership, eligibility,
  player uniqueness and positional composition.
- **Extensions:** mode IDs, constraint codes and option/trait keys are engine-owned.
  `EngineFacts` permits serializable scalars/flat arrays; engines validate their
  semantics. Campaign options do not become sport-specific core branches.
- **Results:** ordered named stages represent differing season/bracket paths.
  Top-level records/points mean **regular season**, with postseason totals in
  stages. §5.3 also mutates a record after a title game: this scope is ambiguous
  and needs confirmation before persistence/leaderboard adapters.
- **Trophies:** evaluation receives dated history, awards and an explicit clock
  value. Null sport means meta-trophy; null user means guest. Bronze/silver/gold
  tiers are represented, but their persistence is absent from §5.2's DDL.

## Shared math and reproducibility (§0.1, §2B.2, §5.3)

Elo uses the standard base-10, 400-point scale. Home advantage defaults to zero;
engines supply adjustments and effective K-factors, including any margin or stage
effects. No sport's rating model is embedded in these utilities.

`aggregateRosterRating` computes `sum(slotWeight * rating) / sum(slotWeight)`.
Weights apply to the **filled slot**. §5.3 leaves numbers open: provisional defaults
are 1.1 for QB/RB/WR/TE, 1 for other non-specialists, 0.9 for K/P; explicit maps
are supported. It rejects malformed counts, duplicate slots, mixed sports/rating
modes and invalid numeric inputs. Eligibility remains an engine concern.
The 0–99-to-Elo conversion and §2B.5's 80/20 game simulation are future decisions;
roster aggregation has no opponent-strength input.

`createSeed(season, teamId, modelVersion, ...streamLabels)` encodes typed, ordered
JSON components. RNG v1 uses FNV-1a over UTF-16 code units followed by Mulberry32.
`next()` yields [0, 1); bounded integers use rejection sampling to avoid bias.
Each stream owns its state, with no clock or global randomness. ASCII/Unicode
reference vectors pin the algorithm. It is non-cryptographic, with a 32-bit state.

Replay requires the seed **and** identical roster/options, ordered opponent/data
snapshot, model/RNG version and draw order. Context and results carry model/data
versions. Preserve RNG v1 if adding a successor; use separate stream labels for
independent stochastic subsystems. A seed cannot freeze changing data or rules.

## Verification

From the repository root (use `npm.cmd` in Windows Git Bash):

```sh
npm run test:coverage -w @perfect-season/sport-engine-core
npm run typecheck
npm run lint
npm test
```

Coverage requires 100% statements, branches, functions and lines **per utility
file and registry file**. The tests also exercise all nine methods through both
registry entries, using one mock with two fixture identities. No real engine,
database, UI or service credentials are needed.
