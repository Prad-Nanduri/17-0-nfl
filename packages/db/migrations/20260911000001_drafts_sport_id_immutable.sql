CREATE OR REPLACE FUNCTION enforce_draft_sport_id_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sport_id IS DISTINCT FROM OLD.sport_id
     AND EXISTS (SELECT 1 FROM draft_picks WHERE draft_id = OLD.id) THEN
    RAISE EXCEPTION 'drafts.sport_id is immutable once draft_picks exist (draft %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_drafts_sport_id_immutable
  BEFORE UPDATE OF sport_id ON drafts
  FOR EACH ROW EXECUTE FUNCTION enforce_draft_sport_id_immutable();
