-- CFB domain data and ratings (spec §5.2 CFB DOMAIN, §2B.3 ground-truth polls).

CREATE TABLE cfb_conferences (
  id BIGSERIAL PRIMARY KEY,
  conference_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  abbreviation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  founded_year SMALLINT,
  dissolved_year SMALLINT
);

CREATE TABLE cfb_teams (
  id BIGSERIAL PRIMARY KEY,
  cfbd_team_id INT UNIQUE NOT NULL,
  school TEXT NOT NULL,
  current_name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  mascot TEXT,
  logo_url TEXT,
  is_blue_blood BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE cfb_program_seasons (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES cfb_teams(id),
  season SMALLINT NOT NULL,
  conference_id BIGINT REFERENCES cfb_conferences(id),
  membership_status TEXT NOT NULL
    CHECK (membership_status IN ('fbs', 'reclassifying', 'fcs')),
  wins SMALLINT,
  losses SMALLINT,
  ap_preseason_rank SMALLINT,
  ap_final_rank SMALLINT,
  peak_rank_this_season SMALLINT,
  cfp_result TEXT
    CHECK (cfp_result IS NULL OR cfp_result IN
      ('missed', 'r1', 'quarterfinal', 'semifinal', 'runner_up', 'champion')),
  bowl_result TEXT CHECK (bowl_result IS NULL OR bowl_result IN ('won', 'lost')),
  recruiting_rank SMALLINT,
  recruiting_points REAL,
  era_tier TEXT NOT NULL CHECK (era_tier IN ('full_feature', 'legacy')),
  team_line_stats_jsonb JSONB,
  UNIQUE (team_id, season)
);
CREATE INDEX idx_cfb_program_seasons_season_membership
  ON cfb_program_seasons (season, membership_status);

CREATE TABLE cfb_games (
  id BIGSERIAL PRIMARY KEY,
  cfbd_game_id INT UNIQUE NOT NULL,
  season SMALLINT NOT NULL,
  week SMALLINT NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('regular', 'postseason')),
  home_team_id BIGINT REFERENCES cfb_teams(id),
  away_team_id BIGINT REFERENCES cfb_teams(id),
  home_score SMALLINT,
  away_score SMALLINT,
  neutral_site BOOLEAN NOT NULL DEFAULT FALSE,
  game_type TEXT NOT NULL CHECK (game_type IN
    ('regular', 'conference_championship', 'bowl', 'cfp', 'national_championship')),
  notes TEXT
);

CREATE TABLE cfb_players (
  id BIGSERIAL PRIMARY KEY,
  cfbd_player_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  primary_position TEXT NOT NULL,
  position_group TEXT NOT NULL,
  home_state TEXT,
  home_town TEXT,
  recruiting_class_year SMALLINT,
  recruit_stars SMALLINT,
  recruit_rating REAL,
  heisman_winner_season SMALLINT
);

CREATE TABLE cfb_player_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES cfb_players(id),
  program_season_id BIGINT NOT NULL REFERENCES cfb_program_seasons(id),
  position TEXT NOT NULL,
  position_group TEXT NOT NULL,
  games SMALLINT,
  games_started SMALLINT,
  era_tier TEXT NOT NULL CHECK (era_tier IN ('full_feature', 'legacy')),
  stats_jsonb JSONB NOT NULL,
  is_transfer_this_season BOOLEAN NOT NULL DEFAULT FALSE,
  all_conference BOOLEAN NOT NULL DEFAULT FALSE,
  all_american BOOLEAN NOT NULL DEFAULT FALSE,
  is_team_level_proxy BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (player_id, program_season_id)
);
CREATE INDEX idx_cfb_player_season_stats_program_position
  ON cfb_player_season_stats (program_season_id, position_group);

CREATE TABLE cfb_ratings (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES cfb_players(id),
  program_season_id BIGINT NOT NULL REFERENCES cfb_program_seasons(id),
  rating_mode TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL,
  percentile REAL,
  composite_score REAL,
  confidence_tier TEXT NOT NULL CHECK (confidence_tier IN ('full_feature', 'legacy')),
  is_team_level_proxy BOOLEAN NOT NULL DEFAULT FALSE,
  model_version TEXT NOT NULL,
  UNIQUE (player_id, program_season_id, rating_mode)
);

-- Ground-truth poll tables, imported verbatim (spec §2B.3).
CREATE TABLE cfb_ap_rankings_weekly (
  id BIGSERIAL PRIMARY KEY,
  season INT NOT NULL,
  week INT NOT NULL,
  team_id BIGINT NOT NULL REFERENCES cfb_teams(id),
  ap_rank SMALLINT,
  points INT,
  first_place_votes INT DEFAULT 0,
  is_final BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season, week, team_id)
);

CREATE TABLE cfb_cfp_rankings_weekly (
  id BIGSERIAL PRIMARY KEY,
  season INT NOT NULL,
  week INT NOT NULL,
  team_id BIGINT NOT NULL REFERENCES cfb_teams(id),
  cfp_rank SMALLINT,
  points INT,
  first_place_votes INT DEFAULT 0,
  is_final BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season, week, team_id)
);

CREATE TABLE cfb_recruits (
  id BIGSERIAL PRIMARY KEY,
  cfbd_recruit_id TEXT UNIQUE NOT NULL,
  athlete_id TEXT,
  year SMALLINT NOT NULL,
  name TEXT NOT NULL,
  committed_to TEXT,
  position TEXT,
  stars SMALLINT,
  rating REAL,
  ranking INT,
  state_province TEXT
);
