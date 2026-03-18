-- ============================================================
-- Belege-System (Angebot → AB → Lieferschein → Rechnung)
-- Neue isolierte Tabellen: belege + beleg_positionen
-- Deploy: MCP (neue Tabellen, kein Impact auf bestehende Daten)
-- ============================================================

-- ── Tabelle: belege ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.belege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID REFERENCES public.projekte(id) ON DELETE SET NULL,

  -- Belegkopf
  beleg_typ TEXT NOT NULL CHECK (beleg_typ IN (
    'angebot', 'auftragsbestaetigung', 'lieferschein',
    'rechnung', 'abschlagsrechnung', 'schlussrechnung', 'gutschrift'
  )),
  beleg_nummer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN (
    'entwurf', 'freigegeben', 'versendet', 'angenommen',
    'abgelehnt', 'bezahlt', 'teilbezahlt', 'storniert'
  )),

  -- Datum
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  liefer_datum DATE,
  leistungs_datum DATE,

  -- Empfaenger (denormalisiert fuer PDF-Snapshot)
  empfaenger_kontakt_id UUID REFERENCES public.kontakte(id) ON DELETE SET NULL,
  empfaenger_firma TEXT,
  empfaenger_name TEXT,
  empfaenger_strasse TEXT,
  empfaenger_plz TEXT,
  empfaenger_ort TEXT,

  -- Texte
  betreff TEXT,
  einleitungstext TEXT,
  schlusstext TEXT,
  kunden_bestellnummer TEXT,

  -- Finanzdaten
  netto_summe NUMERIC(12,2) NOT NULL DEFAULT 0,
  rabatt_prozent NUMERIC(5,2) NOT NULL DEFAULT 0,
  rabatt_betrag NUMERIC(12,2) NOT NULL DEFAULT 0,
  netto_nach_rabatt NUMERIC(12,2) NOT NULL DEFAULT 0,
  mwst_satz NUMERIC(5,2) NOT NULL DEFAULT 19.00,
  mwst_betrag NUMERIC(12,2) NOT NULL DEFAULT 0,
  brutto_summe NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Zahlungsbedingungen (nur bei Rechnungstypen)
  zahlungsbedingungen TEXT,
  zahlungsziel_tage INTEGER DEFAULT 14,
  skonto_prozent NUMERIC(5,2) DEFAULT 0,
  skonto_tage INTEGER DEFAULT 0,

  -- Abschlagsrechnung
  abschlags_nr INTEGER,
  abschlags_prozent NUMERIC(5,2),
  abschlags_betrag NUMERIC(12,2),

  -- Konversionskette
  parent_id UUID REFERENCES public.belege(id) ON DELETE SET NULL,

  -- PDF Cache
  pdf_html TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint auf beleg_nummer
CREATE UNIQUE INDEX IF NOT EXISTS idx_belege_nummer_unique ON public.belege (beleg_nummer);

-- Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_belege_projekt ON public.belege (projekt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_belege_typ ON public.belege (beleg_typ, status);
CREATE INDEX IF NOT EXISTS idx_belege_status ON public.belege (status, datum DESC);
CREATE INDEX IF NOT EXISTS idx_belege_parent ON public.belege (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_belege_empfaenger ON public.belege (empfaenger_kontakt_id) WHERE empfaenger_kontakt_id IS NOT NULL;

-- Auto-Update Trigger
CREATE TRIGGER update_belege_updated_at
  BEFORE UPDATE ON public.belege
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.belege ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_belege" ON public.belege FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_belege" ON public.belege FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_belege" ON public.belege FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_belege" ON public.belege FOR DELETE TO anon USING (true);


-- ── Tabelle: beleg_positionen ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.beleg_positionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beleg_id UUID NOT NULL REFERENCES public.belege(id) ON DELETE CASCADE,

  pos_nr INTEGER NOT NULL,
  bezeichnung TEXT NOT NULL DEFAULT '',
  beschreibung TEXT,
  einheit TEXT NOT NULL DEFAULT 'Stk' CHECK (einheit IN (
    'Stk', 'lfm', 'm2', 'pauschal', 'Std', 'kg'
  )),
  menge NUMERIC(10,3) NOT NULL DEFAULT 1,
  einzelpreis NUMERIC(12,2) NOT NULL DEFAULT 0,
  gesamtpreis NUMERIC(12,2) GENERATED ALWAYS AS (menge * einzelpreis) STORED,

  -- Optional: Masse fuer Fenster/Tueren
  breite NUMERIC(8,1),
  hoehe NUMERIC(8,1),

  -- Gruppierung (z.B. "Erdgeschoss", "Obergeschoss")
  gruppe TEXT,

  -- Sortierung
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_beleg_pos_beleg ON public.beleg_positionen (beleg_id, pos_nr);

-- RLS
ALTER TABLE public.beleg_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_beleg_pos" ON public.beleg_positionen FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_beleg_pos" ON public.beleg_positionen FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_beleg_pos" ON public.beleg_positionen FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_beleg_pos" ON public.beleg_positionen FOR DELETE TO anon USING (true);


-- ── RPC: Naechste Belegnummer ───────────────────────────────

CREATE OR REPLACE FUNCTION public.next_beleg_nummer(p_typ TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_max_nr INTEGER;
  v_next TEXT;
BEGIN
  -- Prefix pro Typ
  v_prefix := CASE p_typ
    WHEN 'angebot' THEN 'A'
    WHEN 'auftragsbestaetigung' THEN 'AB'
    WHEN 'lieferschein' THEN 'LS'
    WHEN 'rechnung' THEN 'R'
    WHEN 'abschlagsrechnung' THEN 'AR'
    WHEN 'schlussrechnung' THEN 'SR'
    WHEN 'gutschrift' THEN 'GS'
    ELSE 'X'
  END;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Hoechste bestehende Nummer fuer diesen Typ + Jahr finden
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(beleg_nummer, '-', 3) AS INTEGER)
  ), 0) INTO v_max_nr
  FROM public.belege
  WHERE beleg_typ = p_typ
    AND beleg_nummer LIKE v_prefix || '-' || v_year || '-%';

  v_next := v_prefix || '-' || v_year || '-' || LPAD((v_max_nr + 1)::TEXT, 4, '0');
  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_beleg_nummer(TEXT) TO anon, authenticated;

COMMENT ON TABLE public.belege IS 'Belege: Angebote, AB, Lieferscheine, Rechnungen (1:n pro Projekt)';
COMMENT ON TABLE public.beleg_positionen IS 'Zeilenposten pro Beleg, gesamtpreis = menge * einzelpreis (GENERATED)';
COMMENT ON FUNCTION public.next_beleg_nummer IS 'Generiert naechste Belegnummer: A-2026-0001, R-2026-0001 etc.';
