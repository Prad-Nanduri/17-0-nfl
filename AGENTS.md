# AGENTS.md — house rules for this repo

These rules apply to every contributor and every automated session working in this repo.
The technical spec in `docs/spec.md` is the source of truth; cite it by section number.

## 1. `packages/sport-engine-core` is shared platform code

- `packages/sport-engine-core` holds the `SportEngine` contract, the `SportEngineRegistry`, and
  genuinely sport-agnostic utilities. It is imported by both sport engines and by platform core.
- An **NFL-only or CFB-only task must never need to touch `packages/sport-engine-core`**. Sport
  behavior belongs in `packages/sport-engine-nfl` or `packages/sport-engine-cfb`, behind the
  existing interface (spec §0.1, §6 V1 checkpoint).
- If a sport-specific task appears to require a change in `sport-engine-core`, **stop and flag it**
  (in the PR description or to the requester) instead of proceeding. That usually means either a
  sport-specific assumption is leaking into the platform, or the interface needs a deliberate,
  separately-reviewed change.

## 2. TypeScript strict mode is non-negotiable

- `tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  and `noImplicitOverride`. Do not loosen these, per-package or otherwise.
- **No `any`** (`@typescript-eslint/no-explicit-any` is an error). If an `any` is truly unavoidable,
  it must carry an inline comment explaining why and an `eslint-disable-next-line` scoped to that
  single line.

## 3. Business logic ships with unit tests in the same PR

- Every function containing business logic — rating formulas, eligibility rules, simulation logic,
  trophy evaluation, ranking/projection math — needs a unit test **in the same PR** that adds or
  changes it.
- Tests live next to the code as `*.test.ts` and run with `npm test` (Vitest).

## 4. Reference spec sections in commit messages

- When implementing a specific spec decision, reference the `docs/spec.md` section number in the
  commit message, e.g. `feat(nfl): era-normalized QB rating formula (spec §1.3)`.
- `docs/spec.md` itself is committed as provided; do not reformat it (it is Prettier-ignored).
