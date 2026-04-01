-- AM-123: Lohnabrechnungen (monatliche Daten aus Steuerberater-PDFs)
-- Applied via MCP on 2026-04-01

CREATE TABLE IF NOT EXISTS public.lohnabrechnungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  monat INTEGER NOT NULL CHECK (monat BETWEEN 1 AND 12),
  jahr INTEGER NOT NULL,
  an_brutto NUMERIC(10,2), an_netto NUMERIC(10,2), ag_brutto NUMERIC(10,2),
  sv_ag NUMERIC(10,2), sv_an NUMERIC(10,2),
  lohnsteuer NUMERIC(10,2), solidaritaetszuschlag NUMERIC(10,2), kirchensteuer NUMERIC(10,2),
  arbeitsstunden_soll NUMERIC(6,2), arbeitsstunden_ist NUMERIC(6,2), ueberstunden NUMERIC(6,2),
  urlaub_genommen NUMERIC(4,1), urlaub_rest NUMERIC(4,1),
  vermoegenswirksame_leistungen NUMERIC(8,2), zuschlaege NUMERIC(8,2), abzuege NUMERIC(8,2),
  auszahlungsbetrag NUMERIC(10,2),
  dokument_id UUID, ocr_rohdaten JSONB, notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mitarbeiter_id, monat, jahr)
);

CREATE INDEX IF NOT EXISTS idx_lohnabrechnungen_ma ON public.lohnabrechnungen(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_lohnabrechnungen_periode ON public.lohnabrechnungen(jahr, monat);

ALTER TABLE public.lohnabrechnungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lohnabrechnungen_anon_all" ON public.lohnabrechnungen FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lohnabrechnungen_auth_all" ON public.lohnabrechnungen FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mittellohn: Durchschnittlicher AG-Brutto-Stundensatz aller aktiven Monteure
CREATE OR REPLACE FUNCTION berechne_mittellohn(p_monat INTEGER DEFAULT NULL, p_jahr INTEGER DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
  v_monat INTEGER := COALESCE(p_monat, EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER);
  v_jahr INTEGER := COALESCE(p_jahr, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_mittellohn NUMERIC;
BEGIN
  SELECT AVG(CASE WHEN l.arbeitsstunden_ist > 0 THEN l.ag_brutto / l.arbeitsstunden_ist ELSE NULL END)
  INTO v_mittellohn
  FROM public.lohnabrechnungen l
  JOIN public.mitarbeiter m ON m.id = l.mitarbeiter_id
  WHERE l.monat = v_monat AND l.jahr = v_jahr AND m.status = 'aktiv' AND m.rolle = 'monteur';
  RETURN ROUND(COALESCE(v_mittellohn, 0), 2);
END;
$$ LANGUAGE plpgsql STABLE;
