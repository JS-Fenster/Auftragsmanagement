-- AM-107: Termin-Historie (kein Loeschen, nur Stornieren + Verschieben)
-- Applied via MCP on 2026-03-30

-- 1. Historie-Tabelle
CREATE TABLE IF NOT EXISTS public.termin_historie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termin_id UUID NOT NULL REFERENCES public.termine(id),
  aktion TEXT NOT NULL CHECK (aktion IN ('erstellt', 'bearbeitet', 'verschoben', 'storniert', 'bestaetigt', 'abgeschlossen', 'ressourcen_geaendert')),
  aenderungen JSONB,
  alte_werte JSONB,
  neue_werte JSONB,
  erstellt_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_termin_historie_termin ON public.termin_historie(termin_id);
CREATE INDEX idx_termin_historie_created ON public.termin_historie(created_at DESC);

-- 2. Verschiebungs-Kette auf termine
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS verschoben_von UUID REFERENCES public.termine(id);
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS verschoben_zu UUID REFERENCES public.termine(id);
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS storno_grund TEXT;

-- 3. RLS Policies
ALTER TABLE public.termin_historie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "termin_historie_anon_all" ON public.termin_historie FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "termin_historie_auth_all" ON public.termin_historie FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Auto-log trigger
CREATE OR REPLACE FUNCTION log_termin_change()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  changes JSONB := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.termin_historie (termin_id, aktion, neue_werte)
    VALUES (NEW.id, 'erstellt', to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      action_type := NEW.status;
      IF NEW.status = 'abgesagt' THEN action_type := 'storniert'; END IF;
      IF NEW.status = 'bestaetigt' THEN action_type := 'bestaetigt'; END IF;
      IF NEW.status = 'abgeschlossen' THEN action_type := 'abgeschlossen'; END IF;
    ELSIF OLD.start_zeit != NEW.start_zeit OR OLD.end_zeit != NEW.end_zeit THEN
      action_type := 'verschoben';
    ELSE
      action_type := 'bearbeitet';
    END IF;

    IF OLD.start_zeit != NEW.start_zeit THEN changes := changes || jsonb_build_object('start_zeit', jsonb_build_array(OLD.start_zeit, NEW.start_zeit)); END IF;
    IF OLD.end_zeit != NEW.end_zeit THEN changes := changes || jsonb_build_object('end_zeit', jsonb_build_array(OLD.end_zeit, NEW.end_zeit)); END IF;
    IF OLD.status != NEW.status THEN changes := changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status)); END IF;
    IF OLD.titel != NEW.titel THEN changes := changes || jsonb_build_object('titel', jsonb_build_array(OLD.titel, NEW.titel)); END IF;

    INSERT INTO public.termin_historie (termin_id, aktion, aenderungen, alte_werte, neue_werte)
    VALUES (NEW.id, action_type, changes,
      jsonb_build_object('start_zeit', OLD.start_zeit, 'end_zeit', OLD.end_zeit, 'status', OLD.status),
      jsonb_build_object('start_zeit', NEW.start_zeit, 'end_zeit', NEW.end_zeit, 'status', NEW.status)
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_termin_historie ON public.termine;
CREATE TRIGGER trg_termin_historie
  AFTER INSERT OR UPDATE ON public.termine
  FOR EACH ROW EXECUTE FUNCTION log_termin_change();

-- 5. Prevent DELETE (use status='abgesagt' instead)
CREATE OR REPLACE FUNCTION prevent_termin_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Termine duerfen nicht geloescht werden. Bitte Status auf abgesagt setzen.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_termin_delete ON public.termine;
CREATE TRIGGER trg_prevent_termin_delete
  BEFORE DELETE ON public.termine
  FOR EACH ROW EXECUTE FUNCTION prevent_termin_delete();
