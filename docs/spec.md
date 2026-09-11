# Multi-Sport Football Draft Platform — Full Technical & Product Specification
### NFL + College Football (FBS), one shared platform, $0-cost deployment
*A "38-0"-style dream-draft game, re-architected as a two-sport platform with a pluggable SportEngine layer.*

---

## Table of Contents
0. Shared Platform Architecture
1. NFL Sport Engine
2. College Football (FBS) Sport Engine
   - 2A. Core design
   - 2B. Ranking Lifecycle System (official + internal + projected)
   - 2C. Trophy list & CFB-native features
3. Shared Mechanics That Need Sport-Specific Tuning
4. Data Layer (ETL, both sports)
5. Architecture, DB Schema, Simulation Engines, API Surface, Deployment
6. Build Roadmap
7. README Outline
8. Naming

Throughout, the product is referred to as **"the Platform"** — brand candidates and the final recommendation are in Section 8, so naming doesn't bias the architecture discussion.

---

## 0. Shared Platform Architecture

This section governs everything downstream. Get this wrong and NFL/CFB become two apps sharing a login page; get it right and the abstraction *is* the portfolio story.

### 0.1 The `SportEngine` interface

The platform core (drafting UI, wheel-spin mechanic, session/account management, leaderboards, trophy engine, multiplayer infra, OG-card generation) depends **only** on this interface. It never imports NFL- or CFB-specific logic directly.

```typescript
type SportId = 'nfl' | 'cfb';

interface SportEngine {
  readonly sportId: SportId;
  readonly displayName: string;          // "NFL" / "College Football (FBS)"
  readonly rosterSlotCount: 24;          // both sports standardize on this — see 0.4

  // (a) Resolve a wheel spin into a concrete, real draft-pool unit
  resolveSpinUnit(seed: SpinSeed, filters: SpinFilters): Promise<DraftPoolUnit>;
  // NFL  -> { franchiseId, season }
  // CFB  -> { programId, season, conferenceId, apFinalRank?, cfpResult? }

  // (b) Roster/scheme presets + slot eligibility validation
  getSchemePresets(): SchemePreset[];
  validateSlotEligibility(candidate: PlayerCandidate, slot: RosterSlot): EligibilityResult;

  // (c) Rating formula per position group
  computeRating(candidate: PlayerCandidate, mode: RatingMode): PositionRating;
  // RatingMode = 'career_season' | 'prime'

  // (d) Turn a completed roster into a simulated season outcome
  simulateSeason(
    roster: CompletedRoster,
    mode: SimulationMode,
    opponentContext: OpponentContext
  ): Promise<SeasonResult>;

  // (e) Sport's own mode list + mode-specific rules
  getAvailableModes(): SportMode[];
  getModeRuleset(modeId: string): ModeRuleset;

  // (f) Sport's own trophy/achievement definitions + evaluation
  getTrophyDefinitions(): TrophyDefinition[];
  evaluateTrophies(result: SeasonResult, ctx: TrophyEvalContext): EarnedTrophy[];
}
```

`NflSportEngine` and `CfbSportEngine` each implement this fully and independently — they do not extend a shared base class with sport-specific overrides scattered through it (that pattern is how you get NFL bugs from CFB edits). They *do* share small, genuinely sport-agnostic utility modules (Elo math, RNG/seeding, roster-rating aggregation) imported by both, but the platform core never reaches into those utilities directly.

A `SportEngineRegistry` (a simple `Record<SportId, SportEngine>`) is the single place the platform resolves `sportId -> engine`. Every platform-core code path that needs sport behavior does `registry.get(draft.sportId).methodName(...)` — this is the entire multi-sport dispatch mechanism, and it's the thing to point at in an interview.

### 0.2 Database schema: hybrid, not purely polymorphic

**Decision:** platform-core tables are shared with a `sport_id` discriminator column; sport-domain data (teams, team-seasons, players, stats, ratings) lives in **separate table families** (`nfl_*` / `cfb_*`), not one polymorphic schema with nullable sport-specific columns.

Why domain data gets separate families, not a shared polymorphic table:
- **Column divergence is real, not cosmetic.** CFB team-seasons need `conference_id`, `ap_preseason_rank`, `ap_final_rank`, `cfp_result`, `recruiting_class_rank`. NFL team-seasons need none of those. A shared `team_seasons` table would carry 6+ columns that are permanently `NULL` for every NFL row, which invites exactly the kind of "is this NULL because it's NFL or because data is missing" bug class that a schema should prevent, not launder.
- **Query simplicity.** "All Cowboys team-seasons 1990–99" never needs a `WHERE sport_id = 'nfl'` guard or a defensive check that CFB-only columns are being ignored correctly.
- **Migration isolation.** Adding CFB transfer-portal tracking touches zero NFL tables, indexes, or query plans.
- **Cost is a non-factor either way** at this scale (low millions of rows total on a free-tier Postgres), so this is purely a maintainability call — and separate families win it.

Why platform-core tables *do* stay shared with a discriminator: a draft, a leaderboard entry, a trophy, a multiplayer room are **the same kind of thing** happening in two sports — the application layer already branches on `sport_id` to pick a `SportEngine`, so one extra `WHERE sport_id = ?` is cheap, and it avoids duplicating ~10 platform tables into 20. Full DDL is in Section 5.

### 0.3 Leaderboards & trophy cabinet across two sports

- **Competitive leaderboards are siloed per sport.** An NFL 17-0 and a CFB undefeated-national-title run are not commensurable outcomes, and merging them into one ranked list invites "your sport's trophy is easier than mine" complaints that erode the thing that makes leaderboards fun. Every leaderboard table carries `sport_id` as a hard partition key, not just a filter.
- **The user profile and trophy cabinet span both sports.** Every `trophy` row is tagged `sport_id` (nullable = cross-sport meta-trophy). The profile page shows one combined cabinet with sport badges per trophy, plus a small "cross-sport" shelf at the top.
- **Meta-trophies (cross-sport), minimum 2, shipping with 3:**
  1. **"Two-Sport Manager"** — earn a top-tier trophy (NFL 17-0, or CFB Undefeated & Champion) in *both* sports.
  2. **"Perfect Calendar Year"** — land a perfect/undefeated-tier season in NFL and CFB within the same rolling 12-month window (rewards cadence, not just lifetime completion — pulls users back across sports rather than letting them "complete" one and leave).
  3. **"Both Codes"** — earn a One-Franchise/One-Program mode trophy in both sports.

### 0.4 Roster standardization (both sports)

Both sports use a **24-slot roster**: 11 offense (constant across schemes: QB×1, RB×2, WR×3, TE×1, OL×4), 11 defense (varies by scheme preset), 2 specialists (K×1, P×1). This gives CFB the same "fill an XI"-scale drafting rhythm as the original game while staying realistic to actual football rosters. Scheme presets (4-3, 3-4, Nickel) only reshuffle the defensive 11 — this is shared platform logic; each `SportEngine` just supplies its own eligibility rules against the same slot shape.

### 0.5 Sport selector UX

**Both** a persistent account-level default *and* a per-session toggle — not one or the other:
- Anonymous/guest users (no-signup-required is core DNA, carried forward from the original) get a lightweight per-session toggle, sport preference stored in a cookie / local session record.
- Returning logged-in users get `users.default_sport` pre-selected on landing, with an always-visible header toggle (not a forced modal).
- **Hard rule:** a single draft's `sport_id` is fixed at creation and immutable. The UI grays out the sport toggle once a draft/roster is in progress ("Finish or abandon this draft to switch sports") — a draft or simulated season never mixes sports, by construction (the toggle is disabled, and the API rejects cross-sport pick attempts server-side regardless of UI state).

---

## 1. NFL Sport Engine

### 1.1 Scheme presets & roster

Three presets, all filling the 24-slot roster from §0.4:

| Preset | DL | LB | CB | S | Flavor |
|---|---|---|---|---|---|
| Base 4-3 | 4 (2 DE, 2 DT) | 3 | 2 | 2 | Balanced, classic |
| Base 3-4 | 3 (2 DE, 1 NT) | 4 (2 OLB, 2 ILB) | 2 | 2 | Favors elite pass-rushing OLBs |
| Nickel (sub-package) | 4 | 2 | 3 | 2 | Pass-heavy, favors DB depth |

Offense is fixed across all three: QB×1, RB×2, WR×3, TE×1, OL×4 (2 OT, 2 IOL). Specialists fixed: K×1, P×1. `validateSlotEligibility` checks the candidate's real primary position (from source data) against the slot's eligible-position set (e.g., an OLB can fill either an OLB or a 4-3 LB slot; a strong safety can fill a nickel CB slot only if flagged `versatile: true` from source stats — a deliberate light validation, not a hard block, to avoid punishing users for realistic positional flexibility).

### 1.2 Spin unit & data source

**Spin unit = (franchise, season).** On spin, the wheel resolves to a real franchise-season (e.g., "1985 Chicago Bears") and the drafting UI opens that season's full depth chart, mirroring how the original shows "club, season."

**Data source:**
- **Primary:** `nflverse` / `nfl_data_py` (open-source, free, community-maintained; `nfl_data_py.import_seasonal_data()`, `import_rosters()`, `import_weekly_data()` give play-by-play-derived seasonal stats). Practical full-detail coverage is **1999–present**; pre-1999 seasons exist in nflverse's historical roster/draft tables but with much thinner per-game stat granularity.
- **Decision:** ship **1999–present** as "full-feature" franchise-seasons (complete position-specific rating inputs). Seasons before 1999 are included in the spin pool tagged `era: 'legacy'`, rated with a lighter formula built from whatever nflverse has for that era (career AV-style approximations, Pro Bowl/All-Pro selections, basic box-score totals) plus a visible "Legacy Era" badge on the card so users understand the rating confidence is lower — this mirrors how CFB will need the same legacy-vs-full-feature split (§2), so it's built once as shared platform logic (`RatingConfidenceTier`) and both engines set their own cutoff year.
- **Media assets** (logos, headshots): ESPN's unofficial API (`site.api.espn.com/apis/site/v2/sports/football/nfl/...`) for team logos and player headshots — free, undocumented-but-stable, matches original 38-0's use of unofficial club-crest sources.

### 1.3 Rating formula (0–99, per position group, era-normalized)

General shape: each position group has a weighted stat composite, percentile-ranked **within that player's own season** against all players at that position in that season (not against all-time raw totals), then mapped to 0–99. This is what "era-normalization" means concretely — a 1978 RB's rushing yards aren't compared to a 2023 RB's raw total, they're compared to 1978's positional distribution, so a dominant-for-his-era player rates highly regardless of scheme inflation/deflation across decades.

```
rating(player, position, season) =
    percentile_rank(composite_score(player, position), all_players_at(position, season))
    -> mapped to [40, 99] (40 floor keeps replacement-level players draftable, not unusable)

composite_score examples:
  QB:  0.40*ANY/A  + 0.20*TD%  + 0.15*(1-INT%) + 0.15*comp% + 0.10*rush_epa
  RB:  0.35*yards_per_carry + 0.25*rush_yards_share + 0.20*rec_yards + 0.20*broken_tackle_rate*
  WR/TE: 0.30*yards_per_route_run* + 0.25*target_share + 0.25*yards + 0.20*TD
  OL:  0.50*pressure_rate_allowed(inv)* + 0.30*run_block_win_rate* + 0.20*penalties(inv)
  DL/EDGE: 0.35*pressure_rate + 0.25*sacks + 0.20*run_stop_win_rate* + 0.20*tackles_for_loss
  LB:  0.30*tackles + 0.25*run_stop_win_rate* + 0.25*coverage_grade* + 0.20*TFL
  CB/S: 0.35*coverage_grade* + 0.25*INT + 0.20*pass_deflections + 0.20*tackles
  K/P: 0.50*accuracy_by_distance_bucket + 0.30*touchback/net_avg + 0.20*clutch(4Q/OT split)
  (* = nflverse-derived proxy or PFF-style public approximation, not raw box score)
```

### 1.4 Core mode outcome framing

**Chasing 17-0** — explicit nod to the 1972 Miami Dolphins, the only perfect NFL season in the Super Bowl era. **Decision: regular season only for the core/default mode**, with a **"Full Gauntlet" toggle** that extends into a simulated playoff bracket (chasing 17-0 regular season *and* a Super Bowl). Justification: the original game's entire design DNA is a satisfying single-sitting session (11 spins → simulate → share card). A mandatory 4-round playoff bracket after every draft roughly doubles session length and breaks that rhythm for the default/onboarding path. Regular-season-only stays true to the "perfect season" hook (17-0 *is* the famous number), while "Full Gauntlet" is there for engaged/returning users chasing the harder, rarer trophy.

### 1.5 NFL modes (all implemented as this engine's `getAvailableModes()`)

| Mode | Summary |
|---|---|
| **Core Draft** | Squad-First or Position-First draft order; Easy/Normal/Hard difficulty; Career-Season or Prime rating mode; chase 17-0 (or Full Gauntlet). |
| **One-Franchise Mode** | Draft only from one franchise's entire history, one real player per slot, scheme the franchise could genuinely field, rated by season actually played there (Prime disabled — same rationale as original One-Club XI). Own leaderboard per franchise. Mode-exclusive trophies: *Dynasty Season*, *Franchise Record Breaker*, *Worst Season in Franchise History*. |
| **Playoff Draft** | Draft an XI-equivalent 24-man roster only from the **Elite Franchise pool** (franchises with ≥3 Lombardi Trophies: Steelers, Patriots, 49ers, Cowboys, Packers, Giants) — 11 marquee spins for skill positions + full remaining slots. Runs through a league phase (6 games vs. generated elite-tier AI opponents) then a knockout bracket (QF → SF → Final). Persistent, resumable, multi-session (`playoff_draft_campaigns` — see §5). Trophy: **"Drafted Dynasty Champions."** |
| **Daily Challenge** | One shared challenge/day tied to a real current storyline (e.g., a franchise on a playoff-clinching streak: "field 3+ players from a Super Bowl-winning season of [Franchise]"), bonus scoring for exceeding the minimum, countdown to refresh, shared leaderboard. |
| **Conference/Dynasty Trophy** | Build a roster restricted to one conference's (AFC/NFC) history, chase a "conference champion" style outcome — Nations Trophy equivalent. |
| **Multiplayer — Live Draft** | Real-time, up to 4 players, synchronous, shared spin queue. |
| **Multiplayer — Leagues** | Fully async, standings table, points-per-win scoring across a shared window. |
| **Multiplayer — Last One Standing** | Timed-round elimination survival — miss a pick window, you're out. |

### 1.6 NFL-native features (no soccer equivalent) — 4, each tied to a named retention mechanic

1. **The Combine** *(named mechanic: "Skill Gate" — a short, optional mini-game between spins)*. Before locking a skill-position pick, the user plays a 10-second timing mini-game (40-yard-dash-style reaction bar) for a small rating boost (±2 pts) on that pick. Retention lever: gives every spin a tiny moment of agency/skill on top of pure luck, which is what keeps "gacha-adjacent" mechanics feeling fair rather than purely random.
2. **Weather & Injury Event Cards** *(named mechanic: "Game-Day Variance")*. Randomized pre-simulation event cards ("Lambeau Field, -10°F," "Star WR questionable") that apply small, bounded modifiers to that week's simulated game — surfaced with a card-flip animation before results. Retention lever: adds narrative texture to the simulate step (currently the original's quietest moment) so a repeat-play session doesn't feel identical to the last.
3. **"Beat the Champs"** — an optional single extra fixture where the user's finished roster plays a fixed historical Super Bowl-winning roster (e.g., '85 Bears) as a bonus game after the season sim. Retention lever: a fixed, comparable benchmark ("did I beat the '85 Bears") gives a shareable bragging-rights unit independent of leaderboard rank, good for screenshot virality.
4. **Draft-Class Synergy Chemistry** — rostering 2+ players from the same real NFL draft class grants a small team-chemistry bonus in simulation. Retention lever: rewards *knowledge* (recognizing draft classes) rather than pure rating-maximization, which broadens what "good drafting" means and gives veteran players a skill ceiling beyond newcomers.

### 1.7 NFL trophy list (52 trophies)

**Result-based (12)**

| Trophy | Criteria |
|---|---|
| Perfect Season | Go 17-0 regular season |
| The Full Gauntlet | 17-0 regular season + win the Super Bowl (Full Gauntlet mode) |
| Ice in the Veins | Lose 3 of first 4 games, finish 14-3 or better |
| Worst in Show | Finish 0-17 |
| Point Machine | Top 1% points-scored of all simulated seasons (dynamic threshold) |
| Brick Wall | Top 1% fewest points allowed |
| Overtime King | Win 3+ OT games in one season |
| Comeback Kids | Win 3+ games after trailing by 14+ |
| Blowout Artist | Win a game by 40+ points |
| Nail-Biter Season | Win 8+ games by one score (≤8 pts) |
| Bubble Burst | Miss the playoffs at 11-6 or better (Full Gauntlet) |
| Wild Card Miracle | Win the Super Bowl as the lowest playoff seed (Full Gauntlet) |
| **Identity / biography-based (14)** | |
| Mr. Irrelevant | Field 3+ players who were drafted in the final round or went undrafted |
| HBCU Pride | Field 3+ players from Historically Black Colleges and Universities |
| Jersey Retired | Field 5+ eventual Hall of Famers |
| Sunday, Monday, Thursday | Field players spanning 5+ different decades |
| One State, One Squad | Field 8+ players born in the same U.S. state |
| Draft Day Steal | Field 3+ players drafted outside the first two rounds who became All-Pros |
| The Vet | Field a player in their age-37+ season |
| Rookie Wave | Field 5+ players in their rookie season |
| Homegrown | Field 8+ players who spent their entire career with one franchise |
| Double Duty | Field a player who made an All-Pro team at two different positions (career-wide) |
| Walk-On Warrior | Field 3+ undrafted free agents who made a Pro Bowl |
| Number Retired | Field a player wearing a number since retired by their real team |
| Legacy Era | Field 5+ players from pre-1999 "Legacy Era" seasons |
| Coast to Coast | Field players from 6+ different current franchises |
| **Squad-construction novelty (10)** | |
| Out of Position | Start a player at a position they rarely played |
| Class Act | Field 4+ players from the same real NFL draft class |
| Teammates Reunited | Field 5+ players who shared a real season on one real team (outside One-Franchise mode) |
| Position Group Sweep | Field an entire position group (e.g., all 4 OL slots) from the same team-season |
| Small Ball | Field a roster with combined listed weight in the bottom 5% |
| Big Uglies | Field an OL group with combined weight in the top 5% |
| No Names | Field a roster with zero Hall of Famers or All-Pros, still go 12-5+ |
| Throwback | Field a roster entirely from Legacy Era seasons |
| Modern Marvel | Field a roster entirely from the last 5 seasons |
| Position-First Purist | Complete a Position-First draft with zero rerolls |
| **Playoff-Draft-specific (7)** | |
| Drafted Dynasty Champions | Win the Playoff Draft knockout bracket |
| Top-Seed Statement | Win Playoff Draft as the #1 league-phase finisher |
| Cinderella Run | Win Playoff Draft as the lowest-seeded knockout qualifier |
| Back-to-Back | Win 2 consecutive Playoff Draft campaigns |
| Wild Card Special | Reach the knockout stage without a top-2 league-phase finish |
| Group Stage Gauntlet | Finish the league phase undefeated |
| Bowl Consolation | Elite-pool roster misses the knockout bracket but wins 4+ league-phase games |
| **Joke / secret (9)** | |
| Butt Fumble Energy | Lose a game on a turnover returned for a defensive TD |
| Ghost Town | Simulate a game with 0 punts by either side |
| Kicker MVP | Win a game by exactly the margin of your K's total points |
| The Immaculate Deflection | Win a game via a simulated defensive TD as the deciding score |
| 12 Men on the Field | (secret) Trigger by attempting to draft a 25th player via a rules-edge interaction |
| Turf Monster | Lose 2 starters to simulated injury in one season |
| Snow Globe | Play 3+ games under a "blizzard" weather event card |
| Revenge Game | Beat a franchise using a roster drawn partly from that same franchise's history |
| The Belichick Special | Win a title with a defense-first roster rated 15+ points below your offense |

---

## 2. College Football (FBS) Sport Engine

### 2A. Core design

CFB is structurally different enough from both soccer and the NFL that it can't be a reskin — the differences are the point, and they're what makes the abstraction story credible ("we didn't just change team names, we changed the season model, the eligibility rules, and the data confidence tiers").

#### 2A.1 Scope: FBS only, validated per season

FBS membership is **not static** — programs move up from FCS (e.g., a multi-year reclassification process under NCAA rules) and, rarely, move down. **Decision:** filter to FBS using **CFBD's `/teams/fbs?year=YYYY`** endpoint (or equivalent classification field on `/teams` filtered by `year`), called **per season**, not once against a current roster of ~134 programs. This means the spin pool for "FBS programs, 2005" is generated from what was actually FBS in 2005, not today's membership list applied backward — a program that reclassified up in 2018 simply has no pre-2018 FBS team-seasons in the pool, which is correct and also flavor-accurate (their AP-poll and postseason history genuinely starts there).

Reclassifying programs get a `membership_status` enum (`fbs`, `reclassifying`, `fcs`) per season row in `cfb_program_seasons`; only `fbs` rows enter the spin pool. A program mid-transition (NCAA requires a 2-year reclassification window before bowl eligibility) is excluded from postseason-eligible pools even if nominally playing an FBS schedule that year — this detail only matters for Daily Challenges/mode filters that require postseason eligibility, and is a one-line filter once the status enum exists.

#### 2A.2 Conferences matter and change over time

Every `cfb_program_seasons` row carries `conference_id` **for that season specifically** — not a lookup against the program's current conference. This is modeled once at ingestion (§4) and surfaced everywhere a team-season appears: the spin-reveal card shows **"Program X (Conference Y · Season Z)"**, directly mirroring how the original shows "Club (Season)." Realignment becomes flavor text rather than a bug to work around — a spin-reveal for a 2010 program shows its 2010 conference even if that conference doesn't exist today, with a small "Conference no longer exists / program has since moved to [current conference]" footnote sourced from the same table.

#### 2A.3 AP rankings as flavor and mode input

Every full-feature-era team-season stores `ap_preseason_rank`, `ap_final_rank`, and `peak_rank_this_season` (nullable — unranked teams have all three null). On the spin card, a ranked team-season shows a ranking badge (e.g., "Final AP: #4"). A dedicated mode variant (**"Ranked Only Draft"**) restricts the spin pool to team-seasons that finished ranked (or peaked Top 25), giving a higher-floor, higher-difficulty variant of the core draft.

#### 2A.4 Season structure: regular season → conference championship → bowl/CFP

CFB's actual season shape (~12–13 regular-season games → conference championship game for qualifying programs → bowl game *or* CFP bracket, expanded format since 2024, → National Championship) is modeled directly rather than reusing NFL's flat 17-game model. Concretely, for a **drafted (synthetic) roster**, since it isn't a real program with real conference-mates:

1. **Regular season**: 12 generated games against AI opponents drawn from a realistic strength distribution (calibrated off real historical team-strength data — see §2B — so the schedule *feels* like a real slate: a couple of rivalry-flavored games, a tougher non-conference matchup, several winnable conference games), difficulty curve set by mode/difficulty.
2. **Conference title eligibility gate**: win ≥10 of 12 regular-season games → earn a 13th game, the **Conference Championship**, against a stronger generated opponent.
3. **Postseason branch**:
   - Win the conference title (or finish undefeated) → earn a **CFP bid** at a seed determined by final simulated strength.
   - CFP: single-elimination bracket (seed-dependent: 1–4 games) culminating in the **National Championship**.
   - Miss the CFP → **bowl game** (still played in Full Campaign mode — a real result, not a dead end; ties into the bowl-flavored consolation trophy in §2C).

**Decision — offer both "Quick Season" and "Full Campaign":** Quick Season (regular season only, ~12 games, default mode, matches the original's single-sitting design ethos) vs. **Full Campaign** (regular season + conference championship + bowl/CFP, opt-in, for users chasing the true "perfect season"). Same reasoning as NFL's Full Gauntlet toggle — a mandatory 4-extra-game postseason roughly 30% lengthens every session, so it's opt-in, not default.

#### 2A.5 The CFB "perfect season" — the true north for the core mode

**Decision:** the CFB perfect-season equivalent is **undefeated regular season + conference championship + CFP title (Full Campaign)** — explicitly framed in-product as rarer and more prestigious than NFL's 17-0, because it genuinely is: an undefeated, untied, national-champion season is historically uncommon. Two real, credible examples used for flavor copy and onboarding: **2019 LSU (15-0, national champion)** and **1995 Nebraska (12-0, national champion, part of a rare back-to-back title run)**. In-product framing: NFL users chase **"17-0,"** CFB users chase **"Undefeated & Untied."**

#### 2A.6 Roster/eligibility: mirrors NFL, with an explicit OL/DL proxy

Same 24-slot roster and scheme presets as §0.4/§1.1 (Base 4-3, Base 3-4, Nickel — CFB flavor-renamed "Nickel" as "Spread Defense" in UI copy only, same slot shape underneath). **Gap called out explicitly, as required:** individual offensive-line (and to a lesser extent interior defensive-line) stats are much sparser in public CFB data than skill-position stats — CFBD simply doesn't have play-level pressure/block-win data for most historical seasons the way advanced NFL charting does.

**Fallback rating approach for OL/DL:** a **team-level proxy composite**, not an individual-stat composite:
```
ol_proxy_rating(player, team_season) =
    0.40 * team_line_efficiency_percentile   // team sack rate allowed & stuff rate allowed, percentile within era
  + 0.35 * All_Conference_or_All_American_selection_bonus   // discrete bump if the player earned one
  + 0.25 * games_started_share                              // durability/starter signal, still individual
```
This is disclosed on the player card with a small "Team-Level Rating" badge so users understand an OL pick's rating reflects the team's line performance more than an isolated individual stat, which is an honest data-availability limitation rather than a hidden approximation.

#### 2A.7 CFB modes

| Mode | Summary |
|---|---|
| **Core Draft** | Squad-First/Position-First; Easy/Normal/Hard; Career-Season or Prime; Quick Season (default) or Full Campaign; chase "Undefeated & Untied." |
| **One-Program Mode** | Draft only from one FBS program's history, one real player per slot, rated by the season actually played there, Prime **enabled** (see §3 for the explicit reasoning — short careers don't disqualify it). Own per-program leaderboard. Mode-exclusive trophies: *Program's Golden Season*, *Program's Worst Season*, **"Undefeated and Untied"** (mode-specific version). |
| **Blue-Blood Bracket** (Playoff Draft equivalent) | Draft only from the **Blue-Blood pool** — programs with ≥1 AP-era consensus national championship or ≥3 AP final Top-5 finishes (≈16 programs: Alabama, Ohio State, Michigan, Notre Dame, Oklahoma, USC, Texas, Nebraska, Miami (FL), Florida, LSU, Florida State, Penn State, Georgia, Clemson, Tennessee). League phase (6 games vs. generated blue-blood-tier AI opponents) → knockout bracket mirroring the CFP (semifinal → national championship). Persistent, resumable. Trophy: **"Drafted National Champions."** |
| **Daily Challenge** | Tied to real current storylines: Rivalry Week ("field a roster of players who played in [Rivalry]"), Ranked Matchup ("field 3+ players from a team that beat a Top-10 opponent"), Bowl Bubble ("field a roster from programs that finished exactly 6-6 that season"). Same countdown/bonus-scoring/shared-leaderboard mechanic as NFL. |
| **Conference Trophy** (Nations Trophy equivalent) | Build a roster restricted to one conference's history, chase a conference-championship-style trophy run — a very natural translation since conference identity is already core to the sport's flavor. |
| **Multiplayer — Live Draft** | Identical format to NFL: real-time, up to 4 players. |
| **Multiplayer — Leagues** | **Scoring changes from NFL's**: see below. |
| **Multiplayer — Last One Standing** | Identical format to NFL. |

**Multiplayer reasoning, explicit:** Live Draft and Last One Standing are format-level mechanics (turn-taking, timers) that don't depend on season *structure*, so they carry over unchanged. **Leagues is different**: NFL Leagues uses points-per-win across a flat 17-game async table, which works because every NFL roster plays the same *shape* of season. CFB's postseason branches (conference title → CFP vs. bowl) mean a flat win-count table would under-reward a roster that "did the hard thing" (won a title game, advanced in the CFP) versus one that padded a 12-0 regular season against weak generated opponents and stopped at Quick Season. **Decision: CFB Leagues uses bracket-advancement-weighted scoring** — regular-season wins count at base value, but conference championship wins, CFP-round wins, and the national title carry escalating point multipliers (e.g., 1x / 1x / 2x / 3x / 4x / 6x), and only Full Campaign entries are eligible for a CFB league (Quick Season rosters can't compete in Leagues, they can in Daily Challenge/solo modes) — this keeps the league table meaningfully ordered by "how far did you actually go," which is the sport-accurate notion of success in CFB.

### 2B. College Football Ranking Lifecycle System

This is the single most complex subsystem in the CFB engine, and it's treated as a first-class, fully-integrated system — not a bolt-on. Four ranking concepts exist in the product and must **never be visually or semantically merged**:

| # | Ranking | Source | Nature |
|---|---|---|---|
| 1 | **Official AP Top 25** | Imported verbatim from CFBD (`/rankings`) | Ground truth, human-voted, read-only |
| 2 | **Official CFP Committee Rankings** | Imported verbatim from CFBD (`/rankings`, poll=`playoff committee rankings`) | Ground truth, committee-voted, read-only, only exists in-season from ~week 9 onward and only 2014+ |
| 3 | **Internal Team-Strength Rating** | Computed by the Platform, continuously | The Platform's own Elo-style model — drives simulation, opponent generation, schedule-strength display |
| 4 | **Projected Ranking Movement** | Derived from #3 | Entertainment-only "if AP voted today" delta, explicitly labeled as unofficial |

The UI and README both state this distinction in plain language: **"AP and CFP rankings are the sport's real, human-voted rankings. The Platform's team-strength rating is our own simulation model, used to generate fair opponents and power the draft-pool flavor — it is never a substitute for or a prediction that overrides the real poll."**

#### 2B.1 In-season: internal team-strength model

An Elo-style continuous rating (centered at 1500, roughly ±400 in normal range), updated **after every completed real game** (during ETL ingestion, not live/instantly — see §4) for every FBS team-season:

```
Expected(team) = 1 / (1 + 10^((Rating_opp_adj - Rating_team) / 400))

Rating_opp_adj = Rating_opp - HFA_adjustment
  HFA_adjustment = +55 if team is home, -55 if team is away, 0 if neutral site

MOV_multiplier = ln(|point_margin| + 1) * (2.2 / (0.001 * |Rating_team - Rating_opp| + 2.2))
  // standard diminishing-returns MOV multiplier (prevents running up the score from
  // inflating rating gains disproportionately) — same family of formula used by
  // public NFL/soccer Elo models, tuned for CFB's higher-variance scoring environment

K_base = 30
K_effective = K_base
            * MOV_multiplier
            * (1.20 if game_type == 'conference_championship' else 1.0)
            * (1.50 if game_type in ('bowl', 'cfp', 'national_championship') else 1.0)

Rating_team_new = Rating_team + K_effective * (ActualResult - Expected(team))
  // ActualResult = 1 for win, 0 for loss (no ties in modern CFB)
```

This produces `cfb_team_strength_ratings` rows keyed `(season, week, team_id)`, written once per completed game, giving a full weekly time series usable for historical replay.

**Ranking-movement explanations** are generated deterministically from the same inputs that drove the Elo update — not a separate LLM call, not freeform text generation. A small rules engine picks the dominant driver and fills a template:

```
if |MOV_multiplier - 1| is the largest contributing factor -> "blowout win/loss"
elif opponent's pre-game rating was in the team's own top-quartile -> "quality win" / "bad loss"
elif game_type in (conference_championship, cfp, bowl) -> "postseason result"
else -> "result vs. [opponent]"

explanation_text = template.format(team, opponent, result, primary_driver, rating_delta)
// e.g. "Rose 41 pts — quality road win at #9 [Opponent]"
// e.g. "Fell 18 pts — home loss to an unranked opponent"
```

Stored per team/week in `cfb_ranking_movements` with the numeric `delta` and the categorical `primary_driver` so the UI can render a consistent icon set (▲ quality win, ▼ bad loss, etc.) without re-deriving anything.

#### 2B.2 Offseason: preseason projection model

Generated once per season, before any games are played, from a **deterministic weighted composite** plus a small bounded uncertainty term:

```
RegressedBase(team) = 0.65 * FinalRating_prevSeason(team) + 0.35 * ConferenceMeanRating_prevSeason(team.conference)
  // regression-to-mean is standard practice for carrying an Elo-style rating across a season
  // boundary — prevents a small-sample hot/cold final rating from being taken at full value

Factor weights (sum to 1.00, each Factor_k normalized to a z-score within that season's
FBS-wide distribution, then scaled to Elo points via *100):

  w_returning_production   = 0.35   -- % of prev-season offensive+defensive production returning
  w_qb_starter_continuity  = 0.20   -- returning starting QB (or equivalent-experience QB1) = full weight
  w_transfer_portal_net    = 0.12   -- net talent delta from portal additions minus losses
  w_recruiting_class_rank  = 0.10   -- composite recruiting class ranking (CFBD recruiting endpoint)
  w_coaching_continuity    = 0.10   -- HC + coordinator continuity
  w_conference_strength    = 0.08   -- prior-season conference-wide mean rating, relative to FBS mean
  w_schedule_context       = 0.05   -- informational only; feeds "projected SOS" display, not the
                                        rating itself (kept separate to avoid circularity)

PreseasonPower(team) = RegressedBase(team)
                      + Σ(w_k * zscore(Factor_k, team) * 100)     [k over the 6 rating-affecting factors]
                      + Uncertainty(team)

Uncertainty(team) ~ Uniform(-40, +40)
  seed = deterministic_hash(season, team_id, model_version)   // same seed -> same output, always
  // ±40 on a ~1500-centered, ~100-stdev scale is a deliberately small, bounded surprise layer:
  // enough to keep preseason projections from being perfectly predictable, never enough to
  // override the evidence-based composite

PreseasonPower(team) = clamp(PreseasonPower(team), min=1000, max=2200)
```

**Every input factor, the resulting score, the model version, and the seed are stored** in `cfb_preseason_projections` (see schema below) — reproducible by design: re-running the generator for a past season with the same `model_version` and seed reproduces the identical output, which matters both for debugging and for the "explain this ranking" UI requirement.

**Explanation generation** (offseason) follows the same deterministic-template approach as in-season movements: the largest-magnitude weighted factor becomes the headline driver — `"Rose in preseason projections — elite returning production (78% of offensive snaps return)"` / `"Fell in preseason projections — starting QB departed to the transfer portal."`

**Preseason Prediction feature:** before rankings/projections are revealed, users submit predictions for (a) preseason #1, (b) biggest riser vs. last season's final rating, (c) biggest faller, (d) first team to enter the Top 25 from unranked. Predictions lock at a fixed cutoff (first game kickoff of the season) and are scored against the *official* AP preseason poll once released (not against the internal model) — correct predictions award rerolls, chemistry-boost tokens, cosmetic badges, and a seasonal **"Crystal Ball"** trophy tier (bronze/silver/gold by number correct).

#### 2B.3 Database schema — ranking subsystem

```sql
-- Ground-truth, imported verbatim, read-only from the app's perspective
CREATE TABLE cfb_ap_rankings_weekly (
  id            BIGSERIAL PRIMARY KEY,
  season        INT NOT NULL,
  week          INT NOT NULL,        -- 0 = preseason, 1..15ish = regular season weeks, 99 = final
  team_id       BIGINT NOT NULL REFERENCES cfb_teams(id),
  ap_rank       SMALLINT,            -- NULL if unranked but received votes
  points        INT,
  first_place_votes INT DEFAULT 0,
  is_final      BOOLEAN DEFAULT FALSE,
  imported_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season, week, team_id)
);

CREATE TABLE cfb_cfp_rankings_weekly (
  id            BIGSERIAL PRIMARY KEY,
  season        INT NOT NULL,
  week          INT NOT NULL,
  team_id       BIGINT NOT NULL REFERENCES cfb_teams(id),
  cfp_rank      SMALLINT,
  imported_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season, week, team_id)
);

-- Internal model output, computed by the Platform
CREATE TABLE cfb_team_strength_ratings (
  id            BIGSERIAL PRIMARY KEY,
  season        INT NOT NULL,
  week          INT NOT NULL,
  team_id       BIGINT NOT NULL REFERENCES cfb_teams(id),
  power_rating  NUMERIC(7,2) NOT NULL,
  model_version TEXT NOT NULL REFERENCES cfb_ranking_model_versions(version),
  computed_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season, week, team_id, model_version)
);

CREATE TABLE cfb_ranking_movements (
  id              BIGSERIAL PRIMARY KEY,
  season          INT NOT NULL,
  week            INT NOT NULL,
  team_id         BIGINT NOT NULL REFERENCES cfb_teams(id),
  delta           NUMERIC(6,2) NOT NULL,
  primary_driver  TEXT NOT NULL,        -- enum-like: 'quality_win','bad_loss','blowout','postseason', etc.
  explanation_text TEXT NOT NULL,
  model_version   TEXT NOT NULL REFERENCES cfb_ranking_model_versions(version),
  game_id         BIGINT REFERENCES cfb_games(id)
);

CREATE TABLE cfb_preseason_projections (
  id                    BIGSERIAL PRIMARY KEY,
  season                INT NOT NULL,
  team_id               BIGINT NOT NULL REFERENCES cfb_teams(id),
  model_version         TEXT NOT NULL REFERENCES cfb_ranking_model_versions(version),
  preseason_power_rating NUMERIC(7,2) NOT NULL,
  projected_rank        SMALLINT,
  regressed_base        NUMERIC(7,2) NOT NULL,
  input_factors         JSONB NOT NULL,   -- raw + z-scored factor values, for auditability
  uncertainty_seed      TEXT NOT NULL,
  uncertainty_applied    NUMERIC(6,2) NOT NULL,
  explanation_text       TEXT NOT NULL,
  generated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season, team_id, model_version)
);

CREATE TABLE cfb_ranking_model_versions (
  version         TEXT PRIMARY KEY,       -- e.g. 'v1.2.0'
  description     TEXT NOT NULL,
  formula_params  JSONB NOT NULL,         -- weights, K-factor, uncertainty bounds — full config snapshot
  created_at      TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT FALSE
);

CREATE TABLE cfb_ranking_predictions (
  id                          BIGSERIAL PRIMARY KEY,
  user_id                     BIGINT REFERENCES users(id),
  season                      INT NOT NULL,
  predicted_no1_team_id       BIGINT REFERENCES cfb_teams(id),
  predicted_biggest_riser_id  BIGINT REFERENCES cfb_teams(id),
  predicted_biggest_faller_id BIGINT REFERENCES cfb_teams(id),
  predicted_first_unranked_entrant_id BIGINT REFERENCES cfb_teams(id),
  submitted_at                TIMESTAMPTZ DEFAULT now(),
  locked_at                   TIMESTAMPTZ NOT NULL,
  score                       SMALLINT,          -- 0-4, filled in once real AP data confirms/denies
  scored_at                   TIMESTAMPTZ
);

CREATE TABLE cfb_prediction_rewards (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT REFERENCES users(id),
  prediction_id  BIGINT REFERENCES cfb_ranking_predictions(id),
  season         INT NOT NULL,
  reward_type    TEXT NOT NULL,   -- 'reroll','chemistry_boost','badge','trophy'
  reward_value   TEXT,
  awarded_at     TIMESTAMPTZ DEFAULT now()
);
```

#### 2B.4 Integration map — how rankings touch every other system

| System | How rankings are used |
|---|---|
| **Spin screen** | Team-season card shows official `ap_final_rank`/`ap_preseason_rank` when present, never the internal rating as if it were an official rank. |
| **Ranked-only / Top-10 draft pools** | Filtered directly off `cfb_ap_rankings_weekly.is_final = true AND ap_rank <= N`. |
| **Schedule strength (drafted roster's opponents)** | Opponent-generation draws from the real historical `power_rating` distribution for that era/conference tier to keep the synthetic schedule "feeling" realistic — see §2B.5 guardrail below on exactly how much this can matter. |
| **Opponent generation** | Each generated AI opponent for a simulated game is assigned a `power_rating` sampled from a realistic distribution (informed by §2B.1's historical rating spread), not from the user's own roster — this is what makes Ranked Only / Blue-Blood Bracket modes feel appropriately harder. |
| **Simulation strength** | See guardrail below — the roster's own aggregate rating dominates; opponent `power_rating` is a bounded modifier. |
| **Daily Challenges** | Ranked Matchup / Bowl Bubble challenge templates query directly against `cfb_ap_rankings_weekly` and real final records for that in-game "current" week. |
| **Shareable results cards** | Can show "drafted a roster that would have out-graded a final-AP-#7 team" style flavor stats, computed by comparing final roster rating to the historical rating distribution — clearly labeled as Platform-model flavor, not an official comparison. |
| **Leaderboards & trophies** | Ranked-Only mode leaderboard is its own silo (§0.3); "Crystal Ball" prediction trophies key off `cfb_ranking_predictions.score`. |

#### 2B.5 Guardrail: the roster remains the primary determinant of outcome

Ranking/rating data must never overpower the user's own draft skill. **Concretely enforced in the simulation formula** (full pseudocode in §5.5): a game outcome is a function of `(0.80 * roster_aggregate_rating) vs. (0.20-weighted opponent power_rating as variance injection + baseline randomness)`. The historical team-strength model informs *who you're playing and how tough the schedule looks*, not a direct multiplier on your win probability outside that bounded 20% band. This 80/20 split, and the reasoning behind it, is stated explicitly in both the in-app "How simulation works" explainer and the README (§7) — it's the answer to "can I just draft high-ranked-team players and win regardless of position fit," and the honest answer the product gives is no.

### 2C. CFB trophy list & native features

#### 2C.1 CFB-native features (4, no NFL or soccer equivalent) — each tied to a named retention mechanic

1. **Rivalry Week** *(named mechanic: "Themed Rotation")*. One week per month, spins are restricted to historic rivalry pairs (Michigan–Ohio State, Alabama–Auburn, Army–Navy, etc.) — every player drafted that week comes from one side of a real rivalry game. Retention lever: a recurring, calendar-anchored event gives players a reason to return on a schedule rather than only when they remember the app exists — the same job Daily Challenge does, at a longer cadence with a distinct flavor.
2. **Recruiting Class Synergy** *(named mechanic: "Class Bond")*. Rostering 3+ players from the same real signing class (available via CFBD recruiting data) grants a chemistry bonus in simulation, with a small on-card badge ("2016 Signing Class — 3 rostered"). Retention lever: rewards *research-driven* drafting, giving experienced users a deeper skill layer that isn't visible to first-time players — a classic soft-onboarding-to-mastery curve.
3. **Transfer Portal Wildcard** *(named mechanic: "One Portal Move"*). Once per draft, the user may use a limited-use ability to swap in one player who transferred programs mid-career, drafting them under either program they played for. Retention lever: leans into a real, extremely current CFB storyline (portal era), and a single-use resource-management choice ("do I save my wildcard for a better slot later?") is a proven small-decision retention hook.
4. **Heisman House Bonus** — rostering 2+ Heisman Trophy winners grants a simulation bonus and unlocks the **"Heisman House"** trophy tier (bronze 2, silver 3, gold 4+). Retention lever: Heisman winners are the most recognizable names in the sport to a casual audience, so this is a low-friction "chase the famous name" hook that doesn't require deep CFB knowledge to understand or want.

*(Conference-realignment trivia flavor text on spin cards, and a "Cinderella Run" narrative overlay when a Group-of-Five-heavy roster advances deep in the Blue-Blood Bracket, ship as lightweight copy/UI layers on top of the above rather than standalone systems.)*

#### 2C.2 CFB trophy list (49 trophies)

**Result-based (11)**

| Trophy | Criteria |
|---|---|
| Undefeated & Untied | Full Campaign, 0 losses, regular season |
| The Natty | Undefeated & Untied + win the National Championship |
| Conference Champions | Win the conference championship game |
| CFP Bound | Earn a CFP bid |
| One Loss Wonder | Win the National Championship with exactly 1 loss |
| Bowl Miss | Full Campaign, finish 5-7 or worse (no bowl eligibility) |
| Highest Scoring Season | Top 1% points scored (dynamic threshold) |
| Lockdown Defense | Top 1% fewest points allowed |
| Statement Win | Beat a generated Top-5-strength opponent |
| Signature Loss | Lose to a generated unranked-tier opponent while ranked yourself |
| Overtime Classic | Win 2+ overtime games in one season |
| **Identity / biography-based (13)** | |
| All-Conference XI | Field a roster entirely from one conference's history |
| Cinderella | Field a roster entirely from Group-of-Five programs, still win 10+ games |
| Blue Blood Roster | Field a roster entirely from Blue-Blood-pool programs (outside Blue-Blood Bracket mode) |
| Heisman House | Field 2+ Heisman Trophy winners (bronze/silver/gold tiers at 2/3/4+) |
| Border War | Field a roster built entirely from one in-state rivalry pair |
| First-Round Factory | Field 5+ eventual first-round NFL draft picks |
| Walk-On Wonders | Field 3+ former walk-ons or unranked recruits |
| Four Decades | Field players spanning 4+ different decades |
| Hometown Heroes | Field 5+ players from the same real hometown or metro area |
| Same Cleats | Field 3+ players from the same real high school |
| Legacy Era Lineup | Field a roster entirely from pre-2005 "Legacy Era" seasons |
| Portal Power | Use the Transfer Portal Wildcard and win the National Championship |
| Preseason Nobody | Field a roster of players whose team-seasons were all preseason-unranked, still finish Top 10 |
| **Squad-construction novelty (9)** | |
| Out of Position | Start a player at a position they rarely played |
| Class Bond | Field 3+ players from the same real signing class |
| Reunion Tour | Field 5+ players who shared a real season together on one program (outside One-Program mode) |
| All-Transfer XI | Field a roster where every player transferred programs at least once in their career |
| Trench Warfare | Field an OL/DL group with combined Team-Level Rating in the top 5% |
| No Blue Bloods | Win the National Championship with zero Blue-Blood-pool players rostered |
| Legacy Meets Modern | Field a roster mixing Legacy Era and current-era players 50/50 |
| Position-First Purist | Complete a Position-First draft with zero rerolls |
| Ranked-Only Perfect | Complete Ranked Only mode with an Undefeated & Untied result |
| **Blue-Blood-Bracket-specific (7)** | |
| Drafted National Champions | Win the Blue-Blood Bracket knockout stage |
| Top-Seed Statement | Win Blue-Blood Bracket as the #1 league-phase finisher |
| Cinderella Run | Win Blue-Blood Bracket knockout as the lowest-seeded qualifier |
| Back-to-Back | Win 2 consecutive Blue-Blood Bracket campaigns |
| Bowl Consolation | Blue-Blood-pool roster misses the knockout stage but wins 4+ league-phase games |
| Group Stage Gauntlet | Finish the Blue-Blood Bracket league phase undefeated |
| At-Large Special | Reach the knockout stage without a top-2 league-phase finish |
| **Ranking-lifecycle-specific (4)** | |
| Crystal Ball | Correctly predict 3+ of 4 preseason prediction categories (bronze/silver/gold by count) |
| Riser | Field a roster whose average team-season rose 20+ internal rating points across its year |
| Preseason Prophet | Correctly predict the preseason #1 team in 3 consecutive seasons |
| From Unranked | Field a team-season that finished ranked despite being preseason-unranked |
| **Joke / secret (5)** | |
| Kick Six Energy | Win a game on a simulated defensive/special-teams touchdown as the deciding score |
| The Horns Down | (secret) Trigger via a rules-edge interaction referencing a well-known in-game rivalry gesture controversy |
| Fourth and Forever | Win a game via a successful simulated 4th-down conversion inside the final 2 minutes |
| Toilet Bowl | Field a roster that wins its bowl game despite a losing regular-season record entering it |
| The Committee Disagrees | Finish with an internal power rating higher than your official CFP seed would suggest |

---

## 3. Shared Mechanics That Need Sport-Specific Tuning

| System | NFL implementation | CFB implementation | Why they differ |
|---|---|---|---|
| **Chemistry bonuses** | Same-team-era bonus (players who overlapped real seasons on one franchise) + Draft-Class Synergy (§1.6) | Same-program bonus + **same-conference bonus** (new) + Recruiting-Class-Bond (§2C.1) | CFB's conference identity is flavor-central in a way NFL's isn't (no "same-division" bonus in the original either) — adding a same-conference tier gives CFB a chemistry axis NFL doesn't need. |
| **Difficulty / reroll rules** | Easy: 1 reroll. Normal: 0. Hard: 0 rerolls + ratings hidden. | Identical reroll counts, **plus** on Hard, the preseason projected ranking badge is also hidden (not just the 0-99 rating) | In CFB, a visible AP/projected rank is itself a strong proxy for player quality (ranked-team players skew better), so Hard mode has to hide that too or it leaks the same information the rating-hide is meant to remove. |
| **Prime Mode eligibility** | Enabled — career-long players, "prime" vs. "career-average" is a meaningful, well-separated choice | **Enabled, explicit reasoning below** | See discussion — decision is to keep it, not disable it. |
| **Shareable results card** | Shows: final record, point differential, MVP pick, Combine mini-game score, weather-event flavor line | Shows: final record, conference championship result, CFP/bowl result, ranking movement arc (preseason rank → final rank), Heisman winners rostered, Rivalry Week badge if applicable | Each card leads with the stat that's the sport's actual bragging-rights currency — a record for NFL, a postseason story arc for CFB. |

**Prime Mode for CFB — explicit reasoning:** a college career is short (typically 3–5 years including redshirt/COVID-eligibility seasons), which could argue *against* Prime Mode (not much time for a "prime" distinct from the whole career). The decision is the opposite: **keep it, unchanged**, because the swing between a true freshman season and a breakout junior/senior season is usually *larger* in college than an NFL player's swing between a rookie year and career-best year — physical and system development happens fast in college ball, so "Career-Season" (whichever real season you land on) vs. "Prime" (that player's best season at that program) is arguably a *more* strategically meaningful choice in CFB than in NFL, not less. Short careers don't remove the distinction, they compress it — which if anything raises the stakes of picking the right season.

**Ranking lifecycle, side by side:**

| | NFL | CFB |
|---|---|---|
| Official ranking source | None (standings + playoff seeding only) | AP Top 25 + CFP committee rankings (imported, read-only) |
| Platform-computed model | Simple opponent-strength rating for schedule generation only (no public-facing "power rankings" feature) | Full Elo-style internal team-strength model (§2B), publicly surfaced with clear "not official" labeling |
| Drives simulation | Roster rating vs. generated opponent strength | Roster rating (80%) vs. generated opponent strength informed by internal model (20% band) — §2B.5 |
| Drives Daily Challenges | Real current storylines picked editorially/by template | Real current storylines + direct queries against live AP/rank tables (Ranked Matchup, Bowl Bubble) |
| Drives leaderboards/trophies | Standard record-based | Record-based + ranking-lifecycle-specific trophies (Crystal Ball, Riser, etc. — §2C.2) |

---

## 4. Data Layer (Both Sports)

### 4.1 Sources, finalized

| Sport | Primary data | Media assets |
|---|---|---|
| NFL | `nflverse` / `nfl_data_py` (free, open-source) — full-feature coverage 1999–present, Legacy Era tagging before that | ESPN unofficial API for logos/headshots |
| CFB | `collegefootballdata.com` (CFBD) free public API — teams, rosters, player stats, game results, rankings (`/rankings`), recruiting (`/recruiting`), postseason (`/games` with `seasonType=postseason`) | ESPN unofficial CFB endpoints for logos/headshots |

**CFB historical coverage decision:** CFBD's deep play-by-play and advanced-stat coverage is strongest from **roughly the mid-2000s (play-by-play-derived advanced stats solidify around 2005+) and fully robust 2013+ (recruiting, transfer-portal, and detailed player-season data all present)**. **Decision:** full-feature CFB coverage starts at **season 2005**; earlier seasons (back to CFBD's basic-box-score floor, roughly 1990s) ship as **Legacy Era** with the same lighter rating approach used for pre-1999 NFL (§1.2) — box-score totals, All-Conference/All-American selections, and AP-poll standing substituting for the fuller composite. This mirrors the NFL Legacy Era mechanism exactly, which is why `RatingConfidenceTier` was built as a shared platform concept rather than an NFL-only one.

### 4.2 Unified ETL pipeline

One pipeline, two extractors, one shared transform/rate/load stage — this is the concrete embodiment of the SportEngine abstraction at the data layer, not just the application layer.

```
GitHub Actions (scheduled cron, free — public repo = unlimited Actions minutes)
│
├── Job: extract-nfl        (runs Tue mornings, post-MNF, during NFL season;
│                             monthly during NFL off-season for roster/draft-class updates)
│     -> nfl_data_py pulls: rosters, seasonal stats, weekly stats, draft data
│     -> writes raw JSON/parquet to a staging area (e.g., a private GH repo or R2/Supabase Storage bucket)
│
├── Job: extract-cfb        (runs Sun/Mon mornings, post-Saturday-slate, during CFB season;
│                             monthly during CFB off-season for recruiting/portal updates)
│     -> CFBD client pulls: games, rosters, player-season stats, /rankings (AP + CFP),
│        /recruiting, conference membership per season, FBS classification per season
│     -> writes raw JSON to the same staging area, namespaced cfb/
│
└── Job: transform-rate-load   (runs after either extractor completes; shared code, sport-agnostic
                                 entrypoint that dispatches to sport-specific rating modules)
      1. Normalize raw payloads into the sport-scoped domain schema (§5.2)
      2. Compute ratings via each SportEngine's computeRating() (career_season + prime)
      3. NFL: update franchise-season aggregate tables
         CFB: update program-season aggregates AND run the full ranking-lifecycle update
              (Elo pass over newly completed games -> cfb_team_strength_ratings,
               cfb_ranking_movements; import new cfb_ap_rankings_weekly /
               cfb_cfp_rankings_weekly rows verbatim)
      4. Upsert into Postgres (idempotent — safe to re-run a week's job)
      5. Invalidate/refresh any cached leaderboard or spin-pool materialized views
```

### 4.3 Conference-per-season & AP-poll ingestion (CFB-specific, no NFL equivalent)

- **Conference membership**: CFBD's `/teams` endpoint accepts a `year` parameter and returns each program's conference **for that year** — ingested directly into `cfb_program_seasons.conference_id` per season, no manual mapping table needed. A separate `cfb_conferences` dimension table stores conference metadata (name, whether it's still active, founding/dissolution years) so a defunct conference (e.g., one absorbed in realignment) still renders correctly on old team-season cards.
- **AP/CFP rankings**: CFBD's `/rankings` endpoint returns weekly poll data (`week`, `poll`, `ranks[]`) — the transform stage filters `poll == 'AP Top 25'` into `cfb_ap_rankings_weekly` and `poll == 'Playoff Committee Rankings'` into `cfb_cfp_rankings_weekly`, tagging `is_final = true` on the last regular-season-week row per season.
- **FBS classification per season**: CFBD's `/teams/fbs?year=YYYY` (or the classification field on `/teams`) is queried per season, not once, and written into `cfb_program_seasons.membership_status` — this is the mechanism behind §2A.1's per-season FBS filtering.

### 4.4 Cost confirmation

nflverse/nfl_data_py: free, open-source, no API key. CFBD: free tier (API key required, generous rate limits sufficient for a scheduled batch job, not live traffic). ESPN unofficial endpoints: free, no key. GitHub Actions on a public repo: unlimited minutes. Staging storage: a few hundred MB of JSON/parquet, well within any free object-storage tier (Supabase Storage free tier or a GH repo itself). **Total ETL cost: $0.**

---

## 5. Architecture, DB Schema, Simulation Engines, API Surface, Deployment

### 5.1 Free-tier tech stack

| Layer | Choice | Why / free-tier limit |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | Deploys natively on Vercel, SSR + edge-friendly, one framework for marketing pages + app |
| Styling | Tailwind CSS | Fast iteration, no build-cost concerns |
| Animation | Framer Motion | Wheel-spin, card-flip reveals, drag-and-drop draft board polish |
| Drag-and-drop | `dnd-kit` | Touch-friendly — matters for mobile draft-board ergonomics (see 5.6 note) |
| PWA | `next-pwa` | Installable, offline shell for cached share cards |
| Hosting | **Vercel Hobby (free)** | Single deployment serves both sports; generous free bandwidth/build minutes for hobby traffic |
| Database | **Supabase (free tier: Postgres + Realtime + Auth + Storage)** | Bundling DB, real-time channels, optional auth, and object storage (share-card images) in one free service minimizes the number of independent free-tier accounts/failure points — a deliberate simplicity choice over, say, Neon+Pusher+Clerk+R2 separately |
| Real-time (Live Draft) | Supabase Realtime (Postgres-replication-based channels) | Already on Supabase; free at hobby-scale concurrency (Live Draft rooms cap at 4 players, short-lived) |
| Cache / rate limiting / ephemeral state | **Upstash Redis (free tier)** | Serverless-friendly pay-per-request pricing fits sporadic hobby traffic; used for leaderboard sorted sets, live-draft turn-state, rate limiting |
| Simulation service | One polymorphic Node/TypeScript package implementing `SportEngine.simulateSeason()` for both sports, deployed as a Vercel Serverless Function | See 5.4 for the one-vs-two justification |
| Media assets | ESPN unofficial endpoints (both sports) | Free, no key |
| ETL | GitHub Actions (public repo) | Unlimited minutes |
| Monitoring | Vercel's built-in analytics/logs (free tier) | No added cost |

**Total infrastructure cost: $0**, using only each provider's free tier, at hobby-project traffic levels.

### 5.2 Full Postgres DDL

```sql
-- ============ PLATFORM CORE (shared, sport_id discriminator) ============

CREATE TYPE sport_id_enum AS ENUM ('nfl', 'cfb');

CREATE TABLE users (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT UNIQUE,               -- nullable: guest accounts allowed
  display_name      TEXT NOT NULL,
  default_sport     sport_id_enum,
  created_at        TIMESTAMPTZ DEFAULT now(),
  is_guest          BOOLEAN DEFAULT TRUE
);

CREATE TABLE sessions (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT REFERENCES users(id),
  guest_token       TEXT,                       -- cookie-based identity for no-signup play
  created_at        TIMESTAMPTZ DEFAULT now(),
  last_seen_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drafts (
  id                BIGSERIAL PRIMARY KEY,
  sport_id          sport_id_enum NOT NULL,     -- IMMUTABLE once picks exist — enforced at app layer + trigger
  user_id           BIGINT REFERENCES users(id),
  mode              TEXT NOT NULL,              -- 'core','one_team','playoff_draft','daily_challenge','conference_trophy', etc.
  draft_order       TEXT NOT NULL,              -- 'squad_first' | 'position_first'
  difficulty        TEXT NOT NULL,              -- 'easy'|'normal'|'hard'
  rating_mode       TEXT NOT NULL,              -- 'career_season'|'prime'
  scheme_preset     TEXT NOT NULL,              -- '4-3'|'3-4'|'nickel'
  campaign_mode     TEXT,                       -- CFB only: 'quick_season'|'full_campaign'; NULL for NFL
  status            TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress'|'complete'|'abandoned'
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE TABLE draft_picks (
  id                BIGSERIAL PRIMARY KEY,
  draft_id          BIGINT NOT NULL REFERENCES drafts(id),
  slot_code         TEXT NOT NULL,              -- e.g. 'QB1','OL2','CB3'
  sport_player_ref  BIGINT NOT NULL,            -- FK resolved to nfl_players.id or cfb_players.id at app layer
                                                  -- (kept as a plain bigint, not a DB FK, since it points to
                                                  --  one of two different tables depending on drafts.sport_id —
                                                  --  the one deliberate polymorphic reference in the schema,
                                                  --  scoped to a single narrow column rather than a whole table)
  spin_seed         TEXT NOT NULL,
  picked_at         TIMESTAMPTZ DEFAULT now(),
  used_combine_gate BOOLEAN DEFAULT FALSE        -- NFL-only flavor field, harmlessly unused for CFB rows
);

CREATE TABLE season_results (
  id                BIGSERIAL PRIMARY KEY,
  draft_id          BIGINT NOT NULL REFERENCES drafts(id),
  record_wins       SMALLINT NOT NULL,
  record_losses     SMALLINT NOT NULL,
  points_for        INT NOT NULL,
  points_against    INT NOT NULL,
  postseason_result TEXT,                        -- NFL: 'missed'|'wild_card'|...|'super_bowl_champion'
                                                    -- CFB: 'missed'|'bowl'|'cfp_r1'|...|'national_champion'
  simulated_at      TIMESTAMPTZ DEFAULT now(),
  detail_jsonb      JSONB                         -- game-by-game log, event cards triggered, etc.
);

CREATE TABLE one_team_drafts (
  id                BIGSERIAL PRIMARY KEY,
  draft_id          BIGINT NOT NULL REFERENCES drafts(id),
  sport_id          sport_id_enum NOT NULL,
  team_ref          BIGINT NOT NULL              -- nfl_franchises.id or cfb_programs.id, per sport_id
);

CREATE TABLE playoff_draft_campaigns (
  id                BIGSERIAL PRIMARY KEY,
  draft_id          BIGINT NOT NULL REFERENCES drafts(id),
  sport_id          sport_id_enum NOT NULL,
  stage             TEXT NOT NULL,               -- 'drafting'|'league_phase'|'knockout'|'complete'
  state_jsonb       JSONB NOT NULL,               -- full resumable state: league standings so far,
                                                    -- bracket position, remaining fixtures
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE daily_challenges (
  id                BIGSERIAL PRIMARY KEY,
  sport_id          sport_id_enum NOT NULL,
  challenge_date    DATE NOT NULL,
  template_id       TEXT NOT NULL,               -- e.g. 'rivalry_week','ranked_matchup','bowl_bubble'
  requirement_jsonb JSONB NOT NULL,               -- fielding requirement + bonus-scoring rule, template-driven
  refreshes_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (sport_id, challenge_date)
);

CREATE TABLE daily_challenge_entries (
  id                BIGSERIAL PRIMARY KEY,
  daily_challenge_id BIGINT NOT NULL REFERENCES daily_challenges(id),
  draft_id          BIGINT NOT NULL REFERENCES drafts(id),
  user_id           BIGINT REFERENCES users(id),
  score             INT NOT NULL,
  met_minimum       BOOLEAN NOT NULL,
  bonus_applied     INT DEFAULT 0,
  submitted_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE multiplayer_rooms (
  id                BIGSERIAL PRIMARY KEY,
  sport_id          sport_id_enum NOT NULL,
  format            TEXT NOT NULL,               -- 'live_draft'|'leagues'|'last_one_standing'
  state_jsonb       JSONB NOT NULL,               -- turn order, timers, current spin queue, standings, etc.
  status            TEXT NOT NULL DEFAULT 'open', -- 'open'|'in_progress'|'complete'
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE multiplayer_participants (
  id                BIGSERIAL PRIMARY KEY,
  room_id           BIGINT NOT NULL REFERENCES multiplayer_rooms(id),
  user_id           BIGINT REFERENCES users(id),
  draft_id          BIGINT REFERENCES drafts(id),
  seat_index        SMALLINT,
  joined_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE leaderboards (
  id                BIGSERIAL PRIMARY KEY,
  sport_id          sport_id_enum NOT NULL,       -- hard partition key, not just a filter
  scope             TEXT NOT NULL,                -- 'global'|'one_team'|'daily_challenge'|'ranked_only'
  scope_ref         BIGINT,                        -- e.g. franchise/program id for 'one_team' scope, or
                                                     -- daily_challenge id for 'daily_challenge' scope
  draft_id          BIGINT NOT NULL REFERENCES drafts(id),
  user_id           BIGINT REFERENCES users(id),
  score             INT NOT NULL,
  ranked_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_leaderboards_scope ON leaderboards (sport_id, scope, scope_ref, score DESC);

CREATE TABLE trophies (
  id                BIGSERIAL PRIMARY KEY,
  sport_id          sport_id_enum,                 -- NULL = cross-sport meta-trophy
  code              TEXT UNIQUE NOT NULL,           -- 'nfl_perfect_season','cfb_undefeated_untied','two_sport_manager'
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,                  -- 'result'|'identity'|'novelty'|'playoff_draft'|'joke'|'ranking'|'meta'
  is_secret         BOOLEAN DEFAULT FALSE,
  mode_exclusive_to TEXT                             -- NULL, or a specific mode id if locked to it
);

CREATE TABLE user_trophies (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  trophy_id         BIGINT NOT NULL REFERENCES trophies(id),
  draft_id          BIGINT REFERENCES drafts(id),    -- the season that earned it, where applicable
  earned_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, trophy_id, draft_id)
);

CREATE TABLE streaks (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  sport_id          sport_id_enum,                   -- NULL = cross-sport streak (e.g. "played N days running")
  streak_type       TEXT NOT NULL,                    -- 'play_streak'|'unbeaten_run'|'title_run'|'on_the_up'
  current_count     INT NOT NULL DEFAULT 0,
  best_count        INT NOT NULL DEFAULT 0,
  last_incremented_at TIMESTAMPTZ,
  UNIQUE (user_id, sport_id, streak_type)
);

-- ============ NFL DOMAIN (sport-scoped family) ============

CREATE TABLE nfl_franchises (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, current_name TEXT NOT NULL, abbreviation TEXT NOT NULL
);
CREATE TABLE nfl_franchise_seasons (
  id BIGSERIAL PRIMARY KEY,
  franchise_id BIGINT NOT NULL REFERENCES nfl_franchises(id),
  season SMALLINT NOT NULL,
  wins SMALLINT, losses SMALLINT, ties SMALLINT,
  era_tier TEXT NOT NULL,                 -- 'full_feature' (1999+) | 'legacy' (pre-1999)
  UNIQUE (franchise_id, season)
);
CREATE TABLE nfl_players (
  id BIGSERIAL PRIMARY KEY, full_name TEXT NOT NULL, primary_position TEXT NOT NULL,
  birth_state TEXT, college TEXT, draft_year SMALLINT, draft_round SMALLINT, hbcu BOOLEAN DEFAULT FALSE
);
CREATE TABLE nfl_player_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES nfl_players(id),
  franchise_season_id BIGINT NOT NULL REFERENCES nfl_franchise_seasons(id),
  position TEXT NOT NULL, stats_jsonb JSONB NOT NULL,
  UNIQUE (player_id, franchise_season_id)
);
CREATE TABLE nfl_ratings (
  id BIGSERIAL PRIMARY KEY,
  player_season_stat_id BIGINT NOT NULL REFERENCES nfl_player_season_stats(id),
  rating_mode TEXT NOT NULL,             -- 'career_season'|'prime'
  overall_rating SMALLINT NOT NULL,
  model_version TEXT NOT NULL,
  UNIQUE (player_season_stat_id, rating_mode)
);

-- ============ CFB DOMAIN (sport-scoped family) ============

CREATE TABLE cfb_conferences (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, is_active BOOLEAN DEFAULT TRUE,
  founded_year SMALLINT, dissolved_year SMALLINT
);
CREATE TABLE cfb_teams (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, current_name TEXT NOT NULL, abbreviation TEXT NOT NULL,
  is_blue_blood BOOLEAN DEFAULT FALSE
);
CREATE TABLE cfb_program_seasons (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES cfb_teams(id),
  season SMALLINT NOT NULL,
  conference_id BIGINT REFERENCES cfb_conferences(id),
  membership_status TEXT NOT NULL,        -- 'fbs'|'reclassifying'|'fcs'
  wins SMALLINT, losses SMALLINT,
  ap_preseason_rank SMALLINT, ap_final_rank SMALLINT, peak_rank_this_season SMALLINT,
  cfp_result TEXT,                        -- NULL|'missed'|'r1'|'semifinal'|'champion', 2014+ only
  bowl_result TEXT,
  era_tier TEXT NOT NULL,                 -- 'full_feature' (2005+) | 'legacy'
  UNIQUE (team_id, season)
);
CREATE TABLE cfb_games (
  id BIGSERIAL PRIMARY KEY,
  season SMALLINT NOT NULL, week SMALLINT NOT NULL,
  home_team_id BIGINT REFERENCES cfb_teams(id), away_team_id BIGINT REFERENCES cfb_teams(id),
  home_score SMALLINT, away_score SMALLINT, neutral_site BOOLEAN DEFAULT FALSE,
  game_type TEXT NOT NULL                  -- 'regular'|'conference_championship'|'bowl'|'cfp'|'national_championship'
);
CREATE TABLE cfb_players (
  id BIGSERIAL PRIMARY KEY, full_name TEXT NOT NULL, primary_position TEXT NOT NULL,
  home_state TEXT, home_town TEXT, high_school TEXT, recruiting_class_year SMALLINT,
  heisman_winner_season SMALLINT           -- NULL unless applicable
);
CREATE TABLE cfb_player_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES cfb_players(id),
  program_season_id BIGINT NOT NULL REFERENCES cfb_program_seasons(id),
  position TEXT NOT NULL, stats_jsonb JSONB NOT NULL,
  is_transfer_this_season BOOLEAN DEFAULT FALSE,
  all_conference BOOLEAN DEFAULT FALSE, all_american BOOLEAN DEFAULT FALSE,
  UNIQUE (player_id, program_season_id)
);
CREATE TABLE cfb_ratings (
  id BIGSERIAL PRIMARY KEY,
  player_season_stat_id BIGINT NOT NULL REFERENCES cfb_player_season_stats(id),
  rating_mode TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL,
  is_team_level_proxy BOOLEAN DEFAULT FALSE,   -- true for OL/DL proxy-rated players, §2A.6
  model_version TEXT NOT NULL,
  UNIQUE (player_season_stat_id, rating_mode)
);

-- ============ CFB RANKING SUBSYSTEM ============
-- (cfb_ap_rankings_weekly, cfb_cfp_rankings_weekly, cfb_team_strength_ratings,
--  cfb_ranking_movements, cfb_preseason_projections, cfb_ranking_model_versions,
--  cfb_ranking_predictions, cfb_prediction_rewards — full DDL in §2B.3, not repeated here)
```

### 5.3 Simulation engine pseudocode — shared abstraction, sport-specific bodies

Both engines implement the same `simulateSeason()` contract; they diverge in what "a season" means structurally.

```
// SHARED ABSTRACTION (platform utility, imported by both engines)
function aggregateRosterRating(roster: CompletedRoster): number {
  // position-weighted average of the 24 drafted ratings; skill positions weighted
  // slightly higher than specialists, consistent across both sports
  return weightedAverage(roster.picks, POSITION_WEIGHTS);
}

function simulateGame(rosterRating: number, opponentRating: number, homeAway: Site): GameResult {
  // shared possession/drive-outcome sampler used by both sports —
  // only the number of possessions per game and the scoring-event
  // probability table differ by sport (set via config, not code)
  const effRosterRating = 0.80 * rosterRating + 0.20 * varianceInjection(opponentRating); // §2B.5 guardrail
  const winProb = eloWinProbability(effRosterRating, opponentRating, homeAway);
  return sampleDriveByDrive(winProb, sportConfig.possessionsPerGame, sportConfig.scoringTable);
}
```

```
// NFL: NflSportEngine.simulateSeason()
function simulateNFLSeason(roster, mode, opponentContext) {
  const rosterRating = aggregateRosterRating(roster);
  const schedule = generateSchedule({ games: 17, difficultyCurve: mode.difficulty });
  const results = schedule.map(g => simulateGame(rosterRating, g.opponentRating, g.site));
  const record = tally(results);

  let postseason = null;
  if (mode.fullGauntlet && qualifiesForPlayoffs(record)) {
    postseason = simulatePlayoffBracket(rosterRating, seedFrom(record));  // up to 4 rounds, single elim
  }
  return buildSeasonResult(record, postseason, results);
}
```

```
// CFB: CfbSportEngine.simulateSeason()
function simulateCFBSeason(roster, mode, opponentContext) {
  const rosterRating = aggregateRosterRating(roster);
  const regularSeason = generateSchedule({ games: 12, difficultyCurve: mode.difficulty,
                                            flavor: 'rivalry_and_conference_weighted' });
  const results = regularSeason.map(g => simulateGame(rosterRating, g.opponentRating, g.site));
  const record = tally(results);

  if (mode.campaignMode === 'quick_season') {
    return buildSeasonResult(record, null, results);   // stops here — no conf title, no postseason
  }

  // Full Campaign only, from here down:
  let confChampionship = null, cfpBracket = null, bowlResult = null;
  if (record.wins >= 10) {
    confChampionship = simulateGame(rosterRating, strongerGeneratedOpponent(), 'neutral');
    record.applyConferenceChampionship(confChampionship);
  }
  if (earnedCfpBid(record, confChampionship)) {
    cfpBracket = simulateCfpBracket(rosterRating, seedFromStrength(rosterRating, opponentContext));
    // 1-4 rounds depending on seed, single elimination, culminating in National Championship
  } else {
    bowlResult = simulateGame(rosterRating, bowlTierOpponent(record), 'neutral');
  }
  return buildSeasonResult(record, { confChampionship, cfpBracket, bowlResult }, results);
}
```

**Where they share vs. diverge:** `aggregateRosterRating`, `simulateGame`, and the underlying Elo/possession sampler are 100% shared code. `generateSchedule` shares its engine but is configured with different game counts and a different opponent-flavor weighting. Everything from "conference championship eligibility" downward is CFB-only branching with no NFL analog — this is the concrete, demoable proof that the `SportEngine` interface generalizes to a structurally different season shape, not just different team names.

### 5.4 One polymorphic simulation service, not two

**Decision: one service**, implementing `simulateSeason()` for both sports behind the same deployed endpoint (`POST /api/simulate`, sport resolved from the request body via `SportEngineRegistry`). Deployed as a Vercel Serverless Function within the same project (kept as a logically separate package — own folder, own test suite, own narrow contract — so it's independently extractable later, without being a *physically* separate deployment today).

**Justification against $0-cost and code-reuse:**
- The shared `simulateGame`/Elo/possession-sampler code (§5.3) is the actual reusable core — splitting into two services would either duplicate that code across two deployments or force a shared-package dependency between two services anyway, with none of the benefit.
- Two services means two cold starts, two sets of environment variables/secrets, two monitoring surfaces — for a hobby-scale deployment that's pure overhead with no scaling justification (neither sport's simulation is remotely close to a serverless function's compute/time budget: a full CFB Full Campaign sim, worst case ~17 simulated games including a 4-round CFP bracket, is a handful of Elo/RNG calculations — well under a second of compute).
- **Most importantly:** the whole point of the `SportEngine` abstraction is "one platform, pluggable sport behavior." Splitting simulation into two services undercuts that story for zero practical gain — it would be optimizing for a scaling problem this project doesn't have, at the cost of the architecture's central thesis.

### 5.5 API surface

Every relevant endpoint takes a `:sport` path segment (`nfl` | `cfb`), resolved server-side to a `SportEngine` via the registry.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/:sport/spin` | Resolve a wheel spin to a `DraftPoolUnit`, given draft filters |
| `POST` | `/api/:sport/drafts` | Create a draft (mode, difficulty, scheme, rating mode, campaign mode for CFB) |
| `POST` | `/api/:sport/drafts/:id/picks` | Submit a pick for an open slot |
| `POST` | `/api/:sport/drafts/:id/simulate` | Trigger `simulateSeason()` once roster is complete |
| `GET` | `/api/:sport/drafts/:id/result` | Fetch season result + trophies earned |
| `GET` | `/api/:sport/leaderboards/:scope` | `scope` = global / one_team / daily_challenge / ranked_only |
| `GET` | `/api/:sport/daily-challenge` | Today's challenge + countdown |
| `POST` | `/api/:sport/daily-challenge/entries` | Submit a completed daily-challenge draft |
| `POST` | `/api/:sport/playoff-draft-campaigns` | Start/resume a persistent Playoff Draft / Blue-Blood Bracket campaign |
| `GET` | `/api/:sport/playoff-draft-campaigns/:id` | Fetch resumable campaign state |
| `POST` | `/api/multiplayer/rooms` | Sport-tagged room creation, all 3 formats |
| `POST` | `/api/multiplayer/rooms/:id/join` | Join a room (Live Draft / Leagues / Last One Standing) |
| `GET` | `/api/profile/:userId/trophies` | Cross-sport trophy cabinet |
| `GET` | `/api/profile/:userId/streaks` | Cross-sport + per-sport streaks |
| **CFB-only** | | |
| `GET` | `/api/cfb/conferences/:id/standings` | Conference standings for a given historical season |
| `GET` | `/api/cfb/rankings/ap?season=&week=` | Official AP snapshot, read-only passthrough |
| `GET` | `/api/cfb/rankings/cfp?season=&week=` | Official CFP committee snapshot |
| `GET` | `/api/cfb/rankings/internal?season=&week=` | Internal team-strength rating, explicitly labeled unofficial |
| `GET` | `/api/cfb/rankings/movements/:teamSeasonId` | Ranking-movement explanations |
| `GET` | `/api/cfb/playoff-draft-campaigns/:id/bracket` | CFP-style bracket state for a Blue-Blood Bracket campaign |
| `POST` | `/api/cfb/rankings/predictions` | Submit preseason predictions |
| `GET` | `/api/cfb/rankings/predictions/:userId` | User's prediction history + scores |

### 5.6 Deployment plan

Single GitHub repo (monorepo: `apps/web`, `packages/sport-engine-core`, `packages/sport-engine-nfl`, `packages/sport-engine-cfb`, `packages/simulation`, `packages/db`), single Vercel project, single production domain serving both sports at `/play/nfl` and `/play/cfb` routes off the same deployment — **both sports ship at zero incremental hosting cost**, since it's one Next.js app, one Supabase project, one Upstash instance, regardless of how many sports are plugged into the `SportEngineRegistry`. Adding a third sport later would cost $0 in new infrastructure, only engineering time to implement a third `SportEngine` — which is the strongest practical demonstration of the abstraction paying for itself.

One mobile-ergonomics note worth flagging here since it affects the frontend choice above: the drag-and-drop draft board (`dnd-kit`) is built touch-first from day one, not retrofitted — the original product's virality was heavily mobile/social-driven, and a drag interaction that only works well with a mouse would undercut that.

---

## 6. Build Roadmap

| Phase | Scope | Purpose |
|---|---|---|
| **MVP** | NFL Core Draft only (Squad-First/Position-First, Easy/Normal/Hard, Career-Season/Prime, 17-0 chase, share card). Full `SportEngine` interface exists but only `NflSportEngine` is implemented. | Prove the core loop is fun before proving the abstraction — no point generalizing an interface for a game that isn't sticky yet. |
| **V1** | Add `CfbSportEngine` as the second implementation of the exact same interface — core draft, spin resolution against (program, season, conference), rating formulas with the OL/DL proxy, Quick Season simulation. **No new platform features in this phase** — the deliverable *is* proving the abstraction generalizes to a structurally different sport (different season shape, different roster-data confidence, different metadata) without touching platform core. | **This is the checkpoint that makes the system-design story credible.** Anyone can claim an abstraction works with one implementation; shipping a second, meaningfully different sport against the same interface with zero platform-core changes is the actual proof, and it's a natural, demoable git-history artifact ("here's the diff where CFB was added — zero lines changed outside `packages/sport-engine-cfb`"). |
| **V2** | One-Franchise/One-Program Mode + Daily Challenge + full trophy cabinet, both sports. CFB ranking-lifecycle system (§2B) ships here — it's a substantial subsystem in its own right and depends on having a full season of ingested game data to be meaningful. | Depth and retention mechanics, now that both sports share a proven core. |
| **V3** | Playoff Draft / Blue-Blood Bracket resumable campaigns + Leagues multiplayer, both sports (including CFB's bracket-advancement-weighted Leagues scoring, §2A.7). | Multi-session engagement — the hardest state-management problem in the product (resumable campaign state across two different postseason structures), deliberately sequenced after the simpler systems are stable. |
| **V4** | Live Draft real-time + Last One Standing + sport-native feature additions (Combine mini-game, Weather/Injury cards, Beat the Champs, Draft-Class Synergy for NFL; Rivalry Week, Class Bond, Transfer Portal Wildcard, Heisman House for CFB). | Real-time infra is the highest-risk, highest-cost-to-get-wrong layer (Supabase Realtime concurrency, turn-timer edge cases) — sequenced last so it's built on a fully proven, already-generalized platform rather than being the thing the abstraction has to prove itself around. |

**Why prove the abstraction early (V1) rather than building out every NFL feature first:** the alternative — NFL Core + One-Franchise + Daily Challenge + Playoff Draft + Live Draft, fully built, *then* start CFB — risks discovering late that "sport-specific" assumptions leaked into platform code (a hardcoded 17-game season length in a leaderboard query, a trophy-evaluation function that assumes ties can't happen, a share-card template with NFL-only stat fields) after those assumptions are load-bearing across five features instead of one. Adding the second sport right after the simplest possible first slice (Core Draft only) means any leaked assumption surfaces immediately, against a small surface area, while it's still cheap to fix — and it's also just the more interesting thing to walk an interviewer through: "I didn't build two football games, I built one platform and proved it twice."

---

## 7. README Outline

```
# [Platform Name] — README

## 1. What this is
  One-paragraph pitch. Explicitly frame as: "a two-sport draft-and-simulate platform
  built around a single pluggable SportEngine abstraction" — lead with the
  architecture, not just the game.

## 2. The core abstraction (primary engineering talking point)
  - The SportEngine interface, why each of its 6 responsibilities exists
  - The V1 checkpoint: "CFB was added with zero changes outside packages/sport-engine-cfb"
    (link the actual diff/PR if this is a portfolio repo)
  - DB schema philosophy: shared platform-core + sport_id discriminator vs.
    separate domain-data table families, and why (§0.2 reasoning, condensed)

## 3. Simulation methodology
  - Shared possession/Elo sampler, per-sport config (possessions/game, scoring table)
  - NFL: 17-game (+ optional Full Gauntlet playoff bracket) model
  - CFB: regular season -> conference championship gate -> CFP bracket / bowl model
  - The 80/20 roster-vs-ranking guardrail (§2B.5) and why it exists
  - Rating-formula rationale per position group, per sport, including the explicit
    OL/DL team-level proxy for CFB and why individual-stat rating isn't viable there

## 4. Data sourcing
  - nflverse/nfl_data_py + ESPN unofficial (NFL); CFBD + ESPN unofficial (CFB)
  - FBS-only filtering logic, validated per season (not a static current list) — §2A.1
  - Conference-per-season modeling, why it's a first-class column not a lookup — §2A.2
  - Legacy Era / full-feature era split and its rationale for both sports
  - ETL pipeline diagram (two extractors -> one shared transform/rate/load stage)

## 5. The CFB ranking lifecycle system
  - The 4-way distinction: official AP, official CFP, internal model, projected movement
  - Elo formula, weights, K-factor, MOV multiplier, home-field adjustment
  - Preseason projection formula, weights, uncertainty bounds, reproducible seeds
  - Full integration map (§2B.4) — explicitly state it touches spin screen, draft
    pools, schedule strength, simulation, Daily Challenges, share cards, leaderboards,
    trophies, so a reader doesn't mistake it for a disconnected feature

## 6. Modes & trophies (full taxonomy per sport)
  - Mode list, both sports, with the deliberate structural differences called out
    (Quick Season vs Full Campaign; Leagues scoring divergence; Prime Mode kept
    for both, with the short-career reasoning stated explicitly)
  - Trophy taxonomy by category, both sports, plus cross-sport meta-trophies

## 7. Free-tier architecture & cost
  - Full stack table (§5.1), explicit $0 confirmation, what would need to change
    to scale past hobby traffic (and that this is a deliberate non-goal for v1)

## 8. Roadmap
  - MVP -> V1 -> V2 -> V3 -> V4, with the "why CFB came second, not last" rationale
    reproduced from §6 of this spec

## 9. Local setup / running the ETL / running tests
  (standard developer-onboarding content)
```

---

## 8. Naming

The original's hook — a specific scoreline, "38-0" — works because soccer's perfect record *is* a specific memorable number. NFL's equivalent (17-0) is similarly specific and memorable. **CFB's "perfect season" is not a scoreline at all** — it's "undefeated, untied, and national champion," a phrase, not a number. A score-specific umbrella brand therefore stops working the moment a second sport with a non-numeric perfect-season hook is added — the brand needs to sit *above* both hooks, not be one of them.

**Five candidates, evaluated:**

| Candidate | Read | Verdict |
|---|---|---|
| **Perfect Season** | Sport-neutral, plainly describes the core fantasy in both sports without borrowing either one's specific framing | **Strong** — works as an umbrella with each sport's in-product chase-phrase living underneath it ("Chase 17-0" / "Chase Undefeated & Untied") |
| **Gridiron Draft** | Sport-neutral (both are gridiron football), descriptive of the mechanic | Solid, if a little generic/functional — reads more like a category name than a brand |
| **Franchise Zero** | Plays on "zero losses," NFL-flavored word ("franchise") | Leans NFL in connotation even though "zero" is sport-neutral — risks reading as NFL-first with CFB bolted on, which is exactly the wrong signal for a genuinely two-sport platform |
| **Draft Dynasty** | Sport-neutral, but "dynasty" already means something specific and different in fantasy-sports culture (dynasty leagues = persistent multi-year keeper leagues) | Risks misleading returning-user expectations about what the product actually is |
| **Undrafted** | Clever wordplay (nobody drafts *you*, you draft history), sport-neutral | Cute but ambiguous on first exposure — doesn't communicate "football draft game" to a cold visitor the way the others do, which matters for a no-signup, share-driven virality model where the name itself needs to carry context |

**Recommendation: "Perfect Season."** It's the only candidate that's genuinely sport-neutral *in structure* (not just in wording) — it describes the fantasy both sports are selling (an unbeaten, best-possible outcome) without smuggling in either sport's specific framing the way "Franchise Zero" or "Draft Dynasty" do. It also composes cleanly with the two-track chase-phrase pattern already built into the product: the brand is "Perfect Season," and inside the app an NFL user chases **17-0** while a CFB user chases **Undefeated & Untied** — the umbrella never has to pick a side, and the specific numbers/phrases stay where they belong, as each sport's own in-product hook rather than the whole brand's identity.

*Suggested tagline: "Draft it. Play it. Chase perfection."*
