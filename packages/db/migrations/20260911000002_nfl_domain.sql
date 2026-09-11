-- NFL domain data and ratings (spec §5.2).

CREATE TABLE nfl_franchises (
  id BIGSERIAL PRIMARY KEY,
  franchise_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  current_name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  nflverse_team_id SMALLINT NOT NULL,
  logo_url TEXT
);

CREATE TABLE nfl_franchise_seasons (
  id BIGSERIAL PRIMARY KEY,
  franchise_id BIGINT NOT NULL REFERENCES nfl_franchises(id),
  season SMALLINT NOT NULL,
  wins SMALLINT NOT NULL,
  losses SMALLINT NOT NULL,
  ties SMALLINT NOT NULL DEFAULT 0,
  era_tier TEXT NOT NULL CHECK (era_tier IN ('full_feature', 'legacy')),
  UNIQUE (franchise_id, season)
);
CREATE INDEX idx_nfl_franchise_seasons_season_era
  ON nfl_franchise_seasons (season, era_tier);

CREATE TABLE nfl_players (
  id BIGSERIAL PRIMARY KEY,
  gsis_id TEXT UNIQUE NOT NULL,
  pfr_id TEXT,
  espn_id TEXT,
  full_name TEXT NOT NULL,
  primary_position TEXT NOT NULL,
  position_group TEXT NOT NULL,
  birth_date DATE,
  college TEXT,
  draft_year SMALLINT,
  draft_round SMALLINT,
  draft_number SMALLINT,
  rookie_year SMALLINT,
  headshot_url TEXT
);

CREATE TABLE nfl_player_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES nfl_players(id),
  franchise_season_id BIGINT NOT NULL REFERENCES nfl_franchise_seasons(id),
  position TEXT NOT NULL,
  position_group TEXT NOT NULL,
  games SMALLINT NOT NULL,
  era_tier TEXT NOT NULL CHECK (era_tier IN ('full_feature', 'legacy')),
  stats_jsonb JSONB NOT NULL,
  is_team_level_proxy BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (player_id, franchise_season_id)
);
CREATE INDEX idx_nfl_player_season_stats_franchise_position
  ON nfl_player_season_stats (franchise_season_id, position_group);

CREATE TABLE nfl_ratings (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES nfl_players(id),
  franchise_season_id BIGINT NOT NULL REFERENCES nfl_franchise_seasons(id),
  rating_mode TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL,
  percentile REAL,
  composite_score REAL,
  qualified BOOLEAN NOT NULL DEFAULT TRUE,
  confidence_tier TEXT NOT NULL CHECK (confidence_tier IN ('full_feature', 'legacy')),
  is_team_level_proxy BOOLEAN NOT NULL DEFAULT FALSE,
  model_version TEXT NOT NULL,
  UNIQUE (player_id, franchise_season_id, rating_mode)
);

CREATE TABLE nfl_legacy_player_careers (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES nfl_players(id),
  pfr_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  position_group TEXT NOT NULL,
  draft_year SMALLINT,
  draft_round SMALLINT,
  draft_pick SMALLINT,
  franchise_id BIGINT REFERENCES nfl_franchises(id),
  hof BOOLEAN NOT NULL DEFAULT FALSE,
  career_from_season SMALLINT,
  career_through_season SMALLINT,
  stats_jsonb JSONB NOT NULL
);

CREATE TABLE nfl_legacy_ratings (
  id BIGSERIAL PRIMARY KEY,
  legacy_career_id BIGINT NOT NULL REFERENCES nfl_legacy_player_careers(id),
  rating_mode TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL,
  percentile REAL,
  composite_score REAL,
  qualified BOOLEAN NOT NULL DEFAULT TRUE,
  confidence_tier TEXT NOT NULL DEFAULT 'legacy'
    CHECK (confidence_tier = 'legacy'),
  model_version TEXT NOT NULL,
  UNIQUE (legacy_career_id, rating_mode)
);
