-- Platform core (spec §5.2). Sport-domain nfl_*/cfb_* families ship in separate migrations.

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
