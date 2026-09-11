ALTER TABLE nfl_franchises
  ADD COLUMN conference TEXT CHECK (conference IN ('AFC', 'NFC'));

ALTER TABLE nfl_franchise_seasons
  ALTER COLUMN wins DROP NOT NULL,
  ALTER COLUMN losses DROP NOT NULL,
  ALTER COLUMN ties DROP NOT NULL;

ALTER TABLE nfl_players
  ADD COLUMN versatile BOOLEAN NOT NULL DEFAULT false;
