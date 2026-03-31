-- Actor tracking: Wer hat die Aenderung gemacht?
-- Format: "AS" (User), "Jess" (KI), "Jess:RH" (KI durch User)
-- Applied via CLI

-- 1. Spalte auf termine fuer den aktuellen Bearbeiter (wird bei jedem Update gesetzt)
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS bearbeitet_von TEXT;

-- 2. Trigger aktualisieren: liest bearbeitet_von und schreibt in Historie
CREATE OR REPLACE FUNCTION log_termin_change()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  changes JSONB := '{}';
  actor TEXT;
BEGIN
  -- Actor from the row (client sets this before each update)
  actor := COALESCE(NEW.bearbeitet_von, 'System');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.termin_historie (termin_id, aktion, neue_werte, erstellt_von)
    VALUES (NEW.id, 'erstellt', to_jsonb(NEW), actor);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      action_type := NEW.status;
      IF NEW.status = 'abgesagt' THEN action_type := 'storniert'; END IF;
      IF NEW.status = 'bestaetigt' THEN action_type := 'bestaetigt'; END IF;
      IF NEW.status = 'abgeschlossen' THEN action_type := 'abgeschlossen'; END IF;
    ELSIF OLD.start_zeit IS DISTINCT FROM NEW.start_zeit OR OLD.end_zeit IS DISTINCT FROM NEW.end_zeit THEN
      action_type := 'verschoben';
    ELSE
      action_type := 'bearbeitet';
    END IF;

    IF OLD.start_zeit IS DISTINCT FROM NEW.start_zeit THEN changes := changes || jsonb_build_object('start_zeit', jsonb_build_array(OLD.start_zeit, NEW.start_zeit)); END IF;
    IF OLD.end_zeit IS DISTINCT FROM NEW.end_zeit THEN changes := changes || jsonb_build_object('end_zeit', jsonb_build_array(OLD.end_zeit, NEW.end_zeit)); END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN changes := changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status)); END IF;
    IF OLD.titel IS DISTINCT FROM NEW.titel THEN changes := changes || jsonb_build_object('titel', jsonb_build_array(OLD.titel, NEW.titel)); END IF;

    INSERT INTO public.termin_historie (termin_id, aktion, aenderungen, alte_werte, neue_werte, erstellt_von)
    VALUES (NEW.id, action_type, changes,
      jsonb_build_object('start_zeit', OLD.start_zeit, 'end_zeit', OLD.end_zeit, 'status', OLD.status),
      jsonb_build_object('start_zeit', NEW.start_zeit, 'end_zeit', NEW.end_zeit, 'status', NEW.status),
      actor
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
