# NFL Core Draft — MVP hardening & QA walkthrough

Date: 2026-09-12 · Branch: `devin/1789214273-mvp-hardening-qa` · App: `apps/web` on Next.js 14.2.35, local dev server.

## 1. Repository gates

| Gate      | Command                | Result                                                                               |
| --------- | ---------------------- | ------------------------------------------------------------------------------------ |
| Install   | `npm ci`               | OK (snapshot had missing deps: `satori`, `@resvg/resvg-js`, `@dnd-kit/*`)            |
| Typecheck | `npm run typecheck`    | OK                                                                                   |
| Lint      | `npm run lint`         | OK — the single `@next/next/no-img-element` warning in `season-results.tsx` is fixed |
| Tests     | `npm test`             | 37 files passed, 1 skipped · 207 tests passed, 6 skipped                             |
| Format    | `npm run format:check` | OK                                                                                   |
| Build     | `npm run build`        | OK                                                                                   |

## 2. End-to-end journeys

Six full guest journeys were driven through the real UI (Playwright over CDP), each
one clicking/keying every step: landing → "Start drafting" → guest session (`/api/session` returns
`guest: true`) → setup → Spin → pick → slot × 24 → Simulate season → results → trophies → share card → back to landing.

| Run | Viewport   | Order / difficulty                  | Input             | Outcome                                                                          |
| --- | ---------- | ----------------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| 1   | 1440       | Squad-First / Normal                | pointer           | 24/24, 10-5-2, 17 game rows, OG 1200×630, "Image link copied" — **before fixes** |
| 2   | 375        | Position-First / Easy (reroll used) | touch             | 24/24, 15-1-1, 17 rows, share OK — **before fixes**                              |
| 3   | 1440       | Squad-First / Normal                | **keyboard only** | failed before fix (see §3); after fix 24/24, 12-4-1, share OK                    |
| 4   | 1440       | Squad-First / Hard (ratings hidden) | pointer           | 24/24, 3-13-1, share OK — after fixes                                            |
| 5   | 375        | Squad-First / Normal                | touch             | 24/24, 14-3, share OK, no horizontal overflow — after fixes                      |
| 6   | 1440 + 375 | Squad-First / Normal, seeded 17-0   | pointer           | Perfect Season trophy rendered at both widths                                    |

No console errors, page errors, or HTTP ≥ 400 responses occurred in any run. Mobile `scrollWidth` stayed at 375
on every screen. Per-pick round trip (spin + place) was 0.6–1.4 s locally.

Run 6 uses the existing `PERFECT_SEASON_ALLOW_SEED_OVERRIDE=1` dev switch (same mechanism as
`apps/web/scripts/perfect-season-e2e.ts`) to land a 17-0 seed after a UI-completed draft — the trophy card
cannot otherwise be reached deterministically.

### Screenshots — 1440px (run 4)

1. Landing — `screenshots/1440/01-landing.png`
2. Guest session / setup — `screenshots/1440/02-guest-session-setup.png`
3. Setup filled (Hard) — `screenshots/1440/03-setup-filled.png`
4. Empty draft room — `screenshots/1440/04-draft-room-empty.png`
5. First spin revealed — `screenshots/1440/05-first-spin-revealed.png`
6. After first pick — `screenshots/1440/06-after-first-pick.png`
7. Mid-draft (12/24) — `screenshots/1440/07-mid-draft-12.png`
8. Draft complete (24/24) — `screenshots/1440/08-draft-complete-24.png`
9. Results — `screenshots/1440/09-results.png`
10. Trophy check — `screenshots/1440/10-trophy-check.png`
11. Share card + copied toast — `screenshots/1440/11-share-card.png`

### Screenshots — 375px (run 5)

Same 11 steps under `screenshots/375/`.

### Trophy (run 6)

- `screenshots/trophy/trophy-closeup-1440.png` — 17-0, "Perfect season!", trophy card, MVP
- `screenshots/trophy/trophy-results-375.png`

### Bugs found and fixed during the walkthroughs

1. **Ineligible slots looked eligible.** With a candidate click-selected, every open slot was highlighted
   (`eligible={draggingId === null || eligible}`) and clicking an ineligible one silently did nothing.
   Now only the selected/dragged candidate's eligible open slots are highlighted; the rest are dimmed with
   `aria-disabled="true"`. (`draft-board.tsx`)
2. **Keyboard-only draft could not be completed** — see §3.
3. **No visible focus on setup radios** — see §3.

## 3. Accessibility

**Keyboard-only draft (real fix).** Before: Enter/Space on a candidate card starts a dnd-kit keyboard drag,
the default coordinate getter moves the card 25 px per arrow press, so a slot is never reached and Enter
drops with `over === null`. Run 3 (pre-fix) needed 15–147 s per pick and only landed by accident.
Fix: `keyboard-coordinates.ts` — arrow keys now jump between the _enabled_ (eligible, open) droppable slots in
DOM order; Enter places. Live-region announcements use player names and slot codes instead of GSIS ids
("Picked up Lamar Jackson…", "Lamar Jackson over slot QB1", "…placed in QB1"), plus screen-reader
instructions. Post-fix run 3 completed all 24 picks by keyboard alone in ~1 s each.
`screenshots/keyboard/07-kbd-drag-over-slot.png`.

**Setup radio focus (real fix).** The radio inputs are `sr-only` and the label had no focus style — computed
`outline: none; box-shadow: none` when focused (`screenshots/keyboard/00-setup-focus-before-fix.png`). Added
`has-[:focus-visible]:ring-*` to the label; focused label now shows the 2 px sport ring with offset.

**Trophy / badge contrast (no fix needed).** Measured against the palette in `globals.css`:

| Component                                                               | Text / background         | Ratio  |
| ----------------------------------------------------------------------- | ------------------------- | ------ |
| Trophy title `text-ink` on `bg-subtle` (rendered `#19221c` / `#edf0ec`) | 14.9:1                    | AA/AAA |
| Trophy description `text-muted` on `bg-subtle` (`#545e57` / `#edf0ec`)  | 5.9:1                     | AA     |
| Badge sport / warning / error / info (10 % tint, light)                 | 5.1 / 5.5 / 5.5 / 5.5 : 1 | AA     |
| Badge sport / warning / error / info (dark theme)                       | 7.3 / 8.0 / 6.4 / 7.4 : 1 | AA     |
| Badge neutral `text-muted` on `bg-subtle` (light / dark)                | 5.9 / 6.6 : 1             | AA     |

All pass WCAG AA for normal text; no palette changes were made.

## 4. Performance

**Draft board re-renders (real fix).** Every render ran `candidates.find(...)` once per slot (24 linear scans
over ~100 candidates) and every `SlotTile` (each owning a `useDroppable`) re-rendered on every selection
change because its `onPlace` closure was recreated. Now the active candidate and its eligible slot set are
computed once with `useMemo`, `SlotTile` is `memo`'d and receives a stable `useCallback` handler.

**Candidate rebuilds on the server (real fix).** `buildCandidates()` rebuilt a Map of all players and scanned
all `playerSeasonStats` per call; `completedRoster()` called it once per pick (24×) each time a completed
draft was serialised, and the spin/pick routes per request. Fixture data is immutable, so results are now
memoised in a `WeakMap<NflFixtureData, Map<"franchise:season", PlayerCandidate[]>>` (tests added).

**ESPN logo fetches — none found.** `createLogoResolver()` already has normalised keys, a 24 h success TTL,
5 min failure TTL, in-flight de-duplication, 3 s timeout with `AbortController`; and `getFranchiseLogo()`
short-circuits to the fixture `logoUrl` for all 32 franchises, so the resolver is only hit for unknown keys.
Client logos are `next/image unoptimized` from the ESPN CDN. No change made.

**N+1 queries — none found.** The MVP has no database on the hot path: drafts live in `InMemoryDraftStore`,
fixture data is loaded once via `getNflData()`/`getNflEngine()` globals, and the OG image route caches fonts
and sets `s-maxage=3600`. No change made.
