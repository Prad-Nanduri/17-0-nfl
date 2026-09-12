# Cross-sport regression & QA pass — NFL unchanged, CFB live

Date: 2026-09-12 · Base: `main` @ `3b6aaed` (merge of PR #22) · App: `apps/web` on Next.js 14.2.35, local dev server.
Companion to `walkthrough.md` (NFL MVP hardening baseline, PR #16).

## 1. Repository gates (all workspaces)

| Gate                 | Command                                                        | Result                                                             |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Install              | `npm ci`                                                       | OK — 452 packages                                                  |
| Typecheck            | `npm run typecheck`                                            | OK — every workspace                                               |
| Lint                 | `npm run lint`                                                 | OK — 0 errors, 0 warnings                                          |
| Tests                | `npm test`                                                     | 64 files passed, 1 skipped · 364 tests passed, 6 skipped           |
| Format               | `npm run format:check`                                         | OK                                                                 |
| Build                | `npm run build`                                                | OK — Next.js production build                                      |
| CFB guardrail        | `npm run verify:guardrail -w @perfect-season/sport-engine-cfb` | OK — 80/20 roster-vs-opponent split holds (spec §2B.5)             |
| CFB quick-season e2e | `npm run e2e:quick-season -w @perfect-season/sport-engine-cfb` | OK                                                                 |
| Cross-sport block    | `npx tsx apps/web/scripts/cross-sport-block.ts`                | OK — statuses `201, 200, 200, 409, 409, 409, 200, 201` as scripted |

Baseline for comparison (walkthrough §1): 37 files / 207 tests. The +27 files / +157 tests are the CFB
package, the CFB web routes/adapter/theme tests, the `sport-engine-core` scheme test and the NFL scheme
regression test (see §5).

## 2. Diff-scope accounting for the CFB body of work

Range: `38a25a6..3b6aaed` — from the merge of the NFL MVP hardening PR (#16) to the merge of the last CFB
PR (#22); i.e. PRs #18, #19, #20, #21, #22. `git diff --shortstat 38a25a6 3b6aaed -- <path>` per area:

| Area                         | Files |     + |     − | Nature                                                                                        |
| ---------------------------- | ----: | ----: | ----: | --------------------------------------------------------------------------------------------- |
| `packages/sport-engine-cfb`  |    72 | 6,740 |     4 | The CFB engine, ETL, simulation, trophies, tests, scripts                                     |
| `packages/sport-engine-core` |     3 |   117 |     0 | **Additive only**: `schemes.ts` + test relocated in from the NFL package, 1 re-export         |
| `packages/sport-engine-nfl`  |     3 |   402 |    96 | `schemes.ts` body moved to core (−95, +1 re-export), 1 import line, +400-line regression test |
| `packages/simulation`        |     0 |     0 |     0 | **Untouched**                                                                                 |
| `packages/db`                |     1 |   152 |     0 | New migration `20260912000000_cfb_domain.sql` (`cfb_*` tables only, spec §0.2)                |
| `apps/web`                   |    47 | 2,533 |   935 | 27 new CFB files; 20 existing files modified (see below)                                      |
| root                         |     3 |    11 |     0 | `.env.example` (`CFBD_API_KEY`), `.gitignore`, `package-lock.json`                            |
| **Total**                    |   129 | 9,955 | 1,035 |                                                                                               |

### What the spec §6/§7 claim ("zero changes outside `packages/sport-engine-cfb`") actually holds up to

The claim is **true for `packages/simulation`** and **true in spirit but not literally for
`sport-engine-core`, `sport-engine-nfl` and `apps/web`**. The README should cite the precise version below,
not the absolute one.

1. **`packages/sport-engine-core` (+117 / −0, PR #20).** No interface method, type, or registry line
   changed. The only change is that `SCHEME_PRESETS` (the 4-3 / 3-4 / Nickel 24-slot lineups) moved from
   `sport-engine-nfl/src/schemes.ts` into `sport-engine-core/src/schemes.ts` and is re-exported from
   `index.ts`. The moved file is identical to the NFL original except the type import path and the
   `RangeError` message (`'NFL schemes…'` → `'Scheme presets…'`). Rationale (spec §2A.6): CFB uses the same
   24-slot presets, and the alternative — CFB importing from the NFL package — would be a cross-sport
   dependency, which the contract forbids more strongly. This was flagged as a deliberate core change in
   PR #20 per AGENTS.md §1.
2. **`packages/sport-engine-nfl` (+402 / −96, PR #20).** Behaviour-neutral: `schemes.ts` became a one-line
   re-export from core, `engine.ts` changed one import line, and `schemes.regression.test.ts` (+400) pins
   every slot of every preset to its pre-move value so the relocation can be proven byte-for-byte
   equivalent. No rating, eligibility, spin, simulation, or trophy code changed.
3. **`apps/web` — 20 pre-existing files modified.** Two kinds of change:
   - **Additive/generic (18 files):** the NFL-only route handlers (`app/api/nfl/**`, 7 files, −398 lines)
     were collapsed onto the new sport-generic `lib/server/draft-routes.ts` + `nfl-adapter.ts`;
     `nfl-draft.tsx` (−350) now delegates to the generic `sport-draft.tsx`; `draft-setup.tsx`,
     `draft-board.tsx`, `candidate-card.tsx`, `spin-wheel.tsx`, `types.ts`, `sport-selector.tsx`,
     `lib/sport.ts`, `draft-client.ts`, `draft-store.ts`, `simulate.ts`, `nfl-engine.ts`,
     `play/nfl/results/[id]/page.tsx`, `lib/sport.test.ts` were parameterised on `sportId` /
     `SportEngine`. This is platform-core code becoming sport-agnostic (spec §0.1 — core dispatches via
     `registry.get(draft.sportId)`), which is exactly what the V1 checkpoint is meant to force. NFL
     behaviour is unchanged — proven by §3 below.
   - **Flag flip (1 line):** `lib/sport.ts` `cfb.available: false → true`.
   - `play/cfb/page.tsx` replaced the "coming soon" placeholder.
4. **`packages/db`**: one additive migration creating `cfb_*` tables; no shared or `nfl_*` table touched
   (spec §0.2).
5. **Cross-sport dependency check.** `sport-engine-cfb` lists `@perfect-season/sport-engine-nfl` as a
   `devDependency`, used only by `src/registry.test.ts` to register both engines in one registry. No CFB
   runtime code imports from the NFL package (verified with `rg sport-engine-nfl packages/sport-engine-cfb`).

**Recommended README wording:** "Adding CFB touched zero lines of `packages/simulation` and zero lines of
the `SportEngine` interface/registry. The only non-CFB package changes were relocating the shared 24-slot
scheme presets from the NFL package into `sport-engine-core` (+117, behaviour pinned by a 400-line
regression test) and making the web app's draft routes/components sport-generic so they dispatch through
the registry."

Full per-file listing: `git diff --stat 38a25a6 3b6aaed`.

## 3. NFL regression — end-to-end (baseline: walkthrough §2–§3)

Guest journey: landing → Start drafting → setup → Spin → pick → slot × 24 → Simulate season → results
(17 regular-season rows) → trophies → share card → "Image link copied".

| Run | Viewport | Input             | Outcome                                                                                   |
| --- | -------- | ----------------- | ----------------------------------------------------------------------------------------- |
| 1   | 1440     | pointer           | 24/24, 17 rows, OG 1200×630, copied toast                                                 |
| 2   | 375      | touch             | 24/24, 17 rows, share OK, `scrollWidth === 375` on every screen                           |
| 3   | 1440     | **keyboard only** | 24/24 — arrows jump between eligible slots, Enter places, live region names players/slots |

Ineligible slots still dimmed with `aria-disabled="true"`; setup radio labels still show the focus ring.
No console errors, page errors, or HTTP ≥ 400 in any NFL run. **No regression found.**

## 4. CFB — end-to-end

Journey: landing → sport toggle → `/play/cfb` → setup → program-themed spin reveal → pick → slot × 24 →
Simulate season (Quick Season) → `/play/cfb/results/[id]` (12 game rows) → trophies → share card.

| Run | Viewport | Input             | Outcome                                                  |
| --- | -------- | ----------------- | -------------------------------------------------------- |
| 4   | 1440     | pointer           | 24/24, 12 rows, OG 1200×630 `image/png`, copied toast    |
| 5   | 375      | touch             | 24/24, 12 rows, share OK, no horizontal overflow         |
| 6   | 1440     | **keyboard only** | 24/24, named announcements, eligible-slot arrow movement |

Cross-sport lock: after one CFB pick, clicking NFL shows "Sport locked — Finish or abandon this draft to
switch sports." and stays on the CFB route; a CFB draft id posted to `/api/nfl/...` returns
`409 Draft belongs to a different sport` and the roster stays 1/24; abandoning unlocks NFL.

Screenshots: `screenshots/cfb/results-desktop-theme.png`, `results-12-game-log.png`,
`1440-pointer-11-share-copied.png`, `lock-feedback.png`, `1440-keyboard-02-setup-focus.png`,
`stable-u-fallback-theme.png`.

## 5. Accessibility — CFB screens (bar: walkthrough §3)

- axe-core (WCAG A/AA) on setup, draft room, results: **0 violations** each.
- Keyboard-only CFB draft completes (run 6); focus ring visible on setup controls; live-region
  announcements use player names + slot codes.
- Contrast, measured from computed colours (all AA for normal text; program badges use white or ink text
  chosen per program by `lib/cfb-theme.ts`):

| Surface                  | Foreground / background | Ratio   |
| ------------------------ | ----------------------- | ------- |
| Old Guard badge          | `#FFFFFF` / `#BB0000`   | 6.75:1  |
| Stable U badge           | `#FFFFFF` / `#9E1B32`   | 7.90:1  |
| Champion U badge         | `#FFFFFF` / `#154734`   | 10.59:1 |
| Semifinal State badge    | `#0B0F0D` / `#D6C282`   | 10.93:1 |
| Program / roster eyebrow | `#655B31` / `#FCFDFB`   | 6.65:1  |
| Program / board headings | `#19221C` / `#FCFDFB`   | 15.99:1 |
| Results heading          | `#19221C` / `#F6F7F5`   | 15.18:1 |
| Empty-trophy message     | `#545E57` / `#FCFDFB`   | 6.61:1  |

Not covered: awarded CFB trophy cards (all tested seasons landed on "No trophies this season"); the NFL
17-0 seed-override trick has no CFB equivalent yet.

## 6. Performance — CFB screens (bar: walkthrough §4, 0.6–1.4 s per pick)

| Scenario          | Pick median / p95 | Simulate → results | OG response |
| ----------------- | ----------------- | ------------------ | ----------- |
| NFL 1440 pointer  | 1.21 / 1.85 s     | 1.62 s             | 0.94 s      |
| NFL 375 touch     | 0.68 / 0.89 s     | 1.50 s             | 1.12 s      |
| NFL 1440 keyboard | 1.34 / 1.62 s     | 1.44 s             | 0.45 s      |
| CFB 1440 pointer  | 0.35 / 0.38 s     | 2.92 s (first)     | 1.34 s      |
| CFB 375 touch     | 0.36 / 0.41 s     | 1.57 s             | 0.82 s      |
| CFB 1440 keyboard | 0.64 / 0.80 s     | 1.51 s             | 0.97 s      |

- CFB picks are faster than the NFL baseline (smaller fixture pool). First CFB simulate → results was
  2.9 s in dev mode (cold route compile); subsequent navigations 1.5–2.0 s.
- OG route: 200, `image/png`, 1200×630, `cache-control: public, max-age=0, s-maxage=3600` — same policy
  as the NFL route.
- No repeated successful image URLs within a run; no N+1 (drafts are in-memory, fixtures loaded once).

### Findings (not fixed in this pass — documentation-only PR)

1. **Fixture logo URL fails on every render.** The bundled CFB demo program "Stable U" has
   `logos: ["https://example.com/stable.png"]` in `packages/sport-engine-cfb/etl/fixtures/teams.json`; the
   browser blocks it (`ERR_BLOCKED_BY_ORB`) and re-requests it on each pick where it appears (4–12 times
   per run). `candidate-card.tsx`/`spin-wheel.tsx` fall back to initials so the UI is unaffected, but the
   network log is not clean. Fix options: null the fixture URL, or have the resolver short-circuit
   non-ESPN hosts. Screenshot: `screenshots/cfb/stable-u-fallback-theme.png`.
2. **Duplicate `/api/session` fetches** observed on the results page in dev mode (React strict-mode double
   effects are the likely cause; not confirmed).
3. CFB runs on bundled demo programs (Old Guard, Stable U, Champion U, Semifinal State) with visible
   "Placeholder" / "Team-Level Rating" badges and some generic "Conference opponent" labels — expected until
   the CFBD ETL is run with a real `CFBD_API_KEY`.

## 7. Verdict

NFL: unchanged and passing. CFB: passing. Gates: all green. The §6/§7 scope claim should be cited in the
qualified form in §2 above.
