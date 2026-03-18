-- beleg_zahlungen: Zahlungseingaenge fuer Belege
-- Neue isolierte Tabelle → MCP deploy OK

-- Tabelle
CREATE TABLE IF NOT EXISTS public.beleg_zahlungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beleg_id UUID NOT NULL REFERENCES public.belege(id) ON DELETE CASCADE,
  betrag NUMERIC(12,2) NOT NULL CHECK (betrag > 0),
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  zahlungsart TEXT NOT NULL DEFAULT 'ueberweisung'
    CHECK (zahlungsart IN ('ueberweisung', 'bar', 'scheck', 'lastschrift')),
  referenz TEXT,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index fuer schnelles Lookup
CREATE INDEX IF NOT EXISTS idx_beleg_zahlungen_beleg_id ON public.beleg_zahlungen(beleg_id);

-- RLS aktivieren
ALTER TABLE public.beleg_zahlungen ENABLE ROW LEVEL SECURITY;

-- RLS Policies (anon CRUD — konsistent mit belege-Tabelle)
CREATE POLICY "beleg_zahlungen_select" ON public.beleg_zahlungen FOR SELECT TO anon USING (true);
CREATE POLICY "beleg_zahlungen_insert" ON public.beleg_zahlungen FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "beleg_zahlungen_update" ON public.beleg_zahlungen FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "beleg_zahlungen_delete" ON public.beleg_zahlungen FOR DELETE TO anon USING (true);

-- Trigger-Funktion: Nach INSERT/DELETE auf beleg_zahlungen
-- Summe berechnen und belege.status aktualisieren
CREATE OR REPLACE FUNCTION public.update_beleg_zahlungsstatus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_beleg_id UUID;
  v_gezahlt NUMERIC(12,2);
  v_brutto NUMERIC(12,2);
  v_neuer_status TEXT;
  v_aktueller_status TEXT;
BEGIN
  -- beleg_id je nach Operation
  IF TG_OP = 'DELETE' THEN
    v_beleg_id := OLD.beleg_id;
  ELSE
    v_beleg_id := NEW.beleg_id;
  END IF;

  -- Summe aller Zahlungen
  SELECT COALESCE(SUM(betrag), 0) INTO v_gezahlt
  FROM public.beleg_zahlungen
  WHERE beleg_id = v_beleg_id;

  -- Brutto-Summe des Belegs + aktuellen Status holen
  SELECT brutto_summe, status INTO v_brutto, v_aktueller_status
  FROM public.belege
  WHERE id = v_beleg_id;

  -- Nur Rechnungstypen automatisch aktualisieren
  -- Nicht bei storniert oder entwurf
  IF v_aktueller_status IN ('storniert', 'entwurf') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Neuen Status bestimmen
  IF v_gezahlt >= v_brutto THEN
    v_neuer_status := 'bezahlt';
  ELSIF v_gezahlt > 0 THEN
    v_neuer_status := 'teilbezahlt';
  ELSE
    -- Zurueck auf vorherigen Status (freigegeben/versendet) — belassen wie es ist
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Status aktualisieren
  UPDATE public.belege
  SET status = v_neuer_status, updated_at = now()
  WHERE id = v_beleg_id AND status != v_neuer_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger auf beleg_zahlungen
CREATE TRIGGER trg_beleg_zahlungen_status
  AFTER INSERT OR DELETE ON public.beleg_zahlungen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beleg_zahlungsstatus();

-- Kommentar
COMMENT ON TABLE public.beleg_zahlungen IS 'Zahlungseingaenge fuer Belege (Rechnungen). Trigger aktualisiert belege.status automatisch.';
