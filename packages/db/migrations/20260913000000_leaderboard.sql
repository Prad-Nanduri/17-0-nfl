-- Leaderboard query support: the API filters season_results joined to drafts
-- on (sport_id, status) and orders by record. Index the join+filter keys.
CREATE INDEX IF NOT EXISTS idx_drafts_leaderboard
  ON drafts (sport_id, status)
  WHERE status = 'complete';

CREATE INDEX IF NOT EXISTS idx_season_results_draft
  ON season_results (draft_id);
