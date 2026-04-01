-- AM-122: Mitarbeiter-Stamm + Zeiterfassung + Abwesenheiten
-- Komplett-Migration: Neue Tabellen, Erweiterungen, Funktionen
-- Applied via MCP

-- ============================================================
-- 1. MITARBEITER (Kern-Stammdaten)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mitarbeiter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personalnummer TEXT UNIQUE,
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  geburtsdatum DATE,
  eintrittsdatum DATE NOT NULL,
  austrittsdatum DATE,
  probezeit_ende DATE,
  status TEXT NOT NULL DEFAULT 'aktiv'
    CHECK (status IN ('aktiv', 'inaktiv', 'ausgeschieden', 'elternzeit', 'mutterschutz', 'kurzarbeit')),
  rolle TEXT NOT NULL DEFAULT 'monteur'
    CHECK (rolle IN ('monteur', 'buero', 'geschaeftsfuehrung', 'azubi', 'teilzeit', 'minijob')),
  ressource_id UUID REFERENCES public.ressourcen(id),
  auth_user_id UUID,
  notizen TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mitarbeiter_status ON public.mitarbeiter(status);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_rolle ON public.mitarbeiter(rolle);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_ressource ON public.mitarbeiter(ressource_id);

-- ============================================================
-- 2. ARBEITSVERTRAEGE (Zeitliche Vertragsdaten)
-- Eine Zeile pro Vertragsperiode. Bei Aenderung: alte Zeile gueltig_bis setzen, neue anlegen.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.arbeitsvertraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  gueltig_ab DATE NOT NULL,
  gueltig_bis DATE,
  wochenstunden NUMERIC(4,1) NOT NULL DEFAULT 40.0,
  arbeitstage_pro_woche INTEGER NOT NULL DEFAULT 5
    CHECK (arbeitstage_pro_woche BETWEEN 1 AND 7),
  urlaubstage_jahr INTEGER NOT NULL DEFAULT 30,
  wochentage JSONB NOT NULL DEFAULT '{"mo":true,"di":true,"mi":true,"do":true,"fr":true}',
  tagesarbeitszeit JSONB,
  -- Format: {"mo":{"start":"07:00","ende":"16:00"},"di":{"start":"07:00","ende":"16:00"},...}
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arbeitsvertraege_ma ON public.arbeitsvertraege(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_arbeitsvertraege_gueltig ON public.arbeitsvertraege(gueltig_ab, gueltig_bis);

-- ============================================================
-- 3. ABWESENHEITSARTEN (Erweiterbar, Admin-pflegbar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.abwesenheitsarten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  kategorie TEXT NOT NULL DEFAULT 'sonstiges'
    CHECK (kategorie IN ('urlaub', 'krankheit', 'sonstiges')),
  reduziert_urlaub BOOLEAN NOT NULL DEFAULT false,
  bezahlt BOOLEAN NOT NULL DEFAULT true,
  farbe TEXT DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: Standard-Abwesenheitsarten (wie W4A + deutsche Arbeitsrecht-Typen)
INSERT INTO public.abwesenheitsarten (name, slug, kategorie, reduziert_urlaub, bezahlt, farbe, sort_order) VALUES
  ('Ganzer Urlaubstag', 'urlaub_ganz', 'urlaub', true, true, '#3B82F6', 1),
  ('Halber Urlaubstag (vormittags)', 'urlaub_halbtag_vm', 'urlaub', true, true, '#60A5FA', 2),
  ('Halber Urlaubstag (nachmittags)', 'urlaub_halbtag_nm', 'urlaub', true, true, '#60A5FA', 3),
  ('Sonderurlaub', 'sonderurlaub', 'urlaub', false, true, '#8B5CF6', 4),
  ('Ueberstundenausgleich', 'ueberstunden_ausgleich', 'urlaub', false, true, '#F59E0B', 5),
  ('Unbezahlter Urlaub', 'unbezahlter_urlaub', 'urlaub', false, false, '#9CA3AF', 6),
  ('Freistellung', 'freistellung', 'sonstiges', false, true, '#6366F1', 7),
  ('Krankheit', 'krankheit', 'krankheit', false, true, '#EF4444', 10),
  ('Krankheit (ohne AU)', 'krankheit_ohne_au', 'krankheit', false, true, '#F87171', 11),
  ('Kind krank', 'kind_krank', 'krankheit', false, true, '#FB923C', 12),
  ('Kurzarbeit', 'kurzarbeit', 'sonstiges', false, false, '#78716C', 15),
  ('Mutterschutz', 'mutterschutz', 'sonstiges', false, true, '#EC4899', 16),
  ('Elternzeit', 'elternzeit', 'sonstiges', false, false, '#A855F7', 17),
  ('Bildungsurlaub', 'bildungsurlaub', 'sonstiges', false, true, '#14B8A6', 18),
  ('1/2 Feiertag (Weihnachten/Silvester)', 'halber_feiertag', 'sonstiges', false, true, '#D97706', 20)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. ABWESENHEITEN erweitern (bestehende Tabelle)
-- ============================================================
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS mitarbeiter_id UUID REFERENCES public.mitarbeiter(id);
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS abwesenheitsart_id UUID REFERENCES public.abwesenheitsarten(id);
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS bis_datum DATE;
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS halbtag TEXT CHECK (halbtag IN ('vm', 'nm'));
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS stunden NUMERIC(4,1);
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'genehmigt'
  CHECK (status IN ('beantragt', 'genehmigt', 'abgelehnt', 'storniert'));
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS genehmigt_von UUID REFERENCES public.mitarbeiter(id);
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS genehmigt_am TIMESTAMPTZ;
ALTER TABLE public.abwesenheiten ADD COLUMN IF NOT EXISTS vertretung_id UUID REFERENCES public.mitarbeiter(id);

CREATE INDEX IF NOT EXISTS idx_abwesenheiten_mitarbeiter ON public.abwesenheiten(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_abwesenheiten_status ON public.abwesenheiten(status);

-- ============================================================
-- 5. ZEITSTEMPEL (Event-basierte Zeiterfassung)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zeitstempel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  zeitpunkt TIMESTAMPTZ NOT NULL DEFAULT now(),
  typ TEXT NOT NULL
    CHECK (typ IN ('kommen', 'gehen', 'pause_start', 'pause_ende', 'rauchen_start', 'rauchen_ende')),
  quelle TEXT NOT NULL DEFAULT 'dashboard'
    CHECK (quelle IN ('dashboard', 'mobile', 'rfid', 'manuell', 'korrektur')),
  gps_lat NUMERIC(10,7),
  gps_lon NUMERIC(10,7),
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zeitstempel_ma ON public.zeitstempel(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_zeitstempel_zeitpunkt ON public.zeitstempel(zeitpunkt DESC);
CREATE INDEX IF NOT EXISTS idx_zeitstempel_ma_tag ON public.zeitstempel(mitarbeiter_id, (zeitpunkt::date));

-- ============================================================
-- 6. FEIERTAGE (Bayern)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feiertage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datum DATE NOT NULL,
  name TEXT NOT NULL,
  bundesland TEXT DEFAULT 'BY',
  UNIQUE(datum, bundesland)
);

-- Seed: Bayern Feiertage 2026 + 2027
INSERT INTO public.feiertage (datum, name) VALUES
  -- 2026
  ('2026-01-01', 'Neujahr'),
  ('2026-01-06', 'Heilige Drei Koenige'),
  ('2026-04-03', 'Karfreitag'),
  ('2026-04-06', 'Ostermontag'),
  ('2026-05-01', 'Tag der Arbeit'),
  ('2026-05-14', 'Christi Himmelfahrt'),
  ('2026-05-25', 'Pfingstmontag'),
  ('2026-06-04', 'Fronleichnam'),
  ('2026-08-15', 'Mariae Himmelfahrt'),
  ('2026-10-03', 'Tag der Deutschen Einheit'),
  ('2026-11-01', 'Allerheiligen'),
  ('2026-12-25', '1. Weihnachtsfeiertag'),
  ('2026-12-26', '2. Weihnachtsfeiertag'),
  -- 2027
  ('2027-01-01', 'Neujahr'),
  ('2027-01-06', 'Heilige Drei Koenige'),
  ('2027-03-26', 'Karfreitag'),
  ('2027-03-29', 'Ostermontag'),
  ('2027-05-01', 'Tag der Arbeit'),
  ('2027-05-06', 'Christi Himmelfahrt'),
  ('2027-05-17', 'Pfingstmontag'),
  ('2027-05-27', 'Fronleichnam'),
  ('2027-08-15', 'Mariae Himmelfahrt'),
  ('2027-10-03', 'Tag der Deutschen Einheit'),
  ('2027-11-01', 'Allerheiligen'),
  ('2027-12-25', '1. Weihnachtsfeiertag'),
  ('2027-12-26', '2. Weihnachtsfeiertag')
ON CONFLICT (datum, bundesland) DO NOTHING;

-- ============================================================
-- 7. RLS Policies
-- ============================================================
ALTER TABLE public.mitarbeiter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arbeitsvertraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abwesenheitsarten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zeitstempel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feiertage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mitarbeiter_anon_all" ON public.mitarbeiter FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mitarbeiter_auth_all" ON public.mitarbeiter FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "arbeitsvertraege_anon_all" ON public.arbeitsvertraege FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "arbeitsvertraege_auth_all" ON public.arbeitsvertraege FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "abwesenheitsarten_anon_all" ON public.abwesenheitsarten FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "abwesenheitsarten_auth_all" ON public.abwesenheitsarten FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "zeitstempel_anon_all" ON public.zeitstempel FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "zeitstempel_auth_all" ON public.zeitstempel FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "feiertage_anon_all" ON public.feiertage FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "feiertage_auth_all" ON public.feiertage FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. DB-FUNKTIONEN: Urlaubsberechnung
-- ============================================================

-- Berechnet anteiligen Urlaubsanspruch fuer ein Jahr basierend auf Arbeitsvertraegen
CREATE OR REPLACE FUNCTION berechne_urlaubsanspruch(p_mitarbeiter_id UUID, p_jahr INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  v_anspruch NUMERIC := 0;
  v_vertrag RECORD;
  v_start DATE;
  v_ende DATE;
  v_tage_im_jahr INTEGER;
  v_tage_in_periode INTEGER;
BEGIN
  v_tage_im_jahr := (make_date(p_jahr, 12, 31) - make_date(p_jahr, 1, 1)) + 1;

  FOR v_vertrag IN
    SELECT * FROM public.arbeitsvertraege
    WHERE mitarbeiter_id = p_mitarbeiter_id
      AND gueltig_ab <= make_date(p_jahr, 12, 31)
      AND (gueltig_bis IS NULL OR gueltig_bis >= make_date(p_jahr, 1, 1))
    ORDER BY gueltig_ab
  LOOP
    v_start := GREATEST(v_vertrag.gueltig_ab, make_date(p_jahr, 1, 1));
    v_ende := LEAST(COALESCE(v_vertrag.gueltig_bis, make_date(p_jahr, 12, 31)), make_date(p_jahr, 12, 31));
    v_tage_in_periode := (v_ende - v_start) + 1;

    v_anspruch := v_anspruch + (v_vertrag.urlaubstage_jahr::NUMERIC * v_tage_in_periode / v_tage_im_jahr);
  END LOOP;

  RETURN ROUND(v_anspruch, 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Berechnet Urlaubskonto (Anspruch + Uebertrag - genommen)
CREATE OR REPLACE FUNCTION berechne_urlaubskonto(p_mitarbeiter_id UUID, p_jahr INTEGER)
RETURNS TABLE(anspruch NUMERIC, uebertrag NUMERIC, genommen NUMERIC, rest NUMERIC) AS $$
DECLARE
  v_anspruch NUMERIC;
  v_uebertrag NUMERIC := 0;
  v_genommen NUMERIC := 0;
BEGIN
  v_anspruch := berechne_urlaubsanspruch(p_mitarbeiter_id, p_jahr);

  -- Uebertrag: Rest vom Vorjahr (nur bis 31.03)
  IF CURRENT_DATE <= make_date(p_jahr, 3, 31) THEN
    v_uebertrag := GREATEST(0,
      berechne_urlaubsanspruch(p_mitarbeiter_id, p_jahr - 1) -
      COALESCE((
        SELECT SUM(CASE
          WHEN aa.slug IN ('urlaub_ganz', 'ueberstunden_ausgleich') THEN 1
          WHEN aa.slug IN ('urlaub_halbtag_vm', 'urlaub_halbtag_nm') THEN 0.5
          ELSE 0
        END)
        FROM public.abwesenheiten a
        JOIN public.abwesenheitsarten aa ON aa.id = a.abwesenheitsart_id
        WHERE a.mitarbeiter_id = p_mitarbeiter_id
          AND EXTRACT(YEAR FROM a.datum) = p_jahr - 1
          AND aa.reduziert_urlaub = true
          AND a.status = 'genehmigt'
      ), 0)
    );
  END IF;

  -- Genommene Urlaubstage dieses Jahr
  SELECT COALESCE(SUM(CASE
    WHEN aa.slug IN ('urlaub_ganz', 'ueberstunden_ausgleich') THEN 1
    WHEN aa.slug IN ('urlaub_halbtag_vm', 'urlaub_halbtag_nm') THEN 0.5
    ELSE 0
  END), 0)
  INTO v_genommen
  FROM public.abwesenheiten a
  JOIN public.abwesenheitsarten aa ON aa.id = a.abwesenheitsart_id
  WHERE a.mitarbeiter_id = p_mitarbeiter_id
    AND EXTRACT(YEAR FROM a.datum) = p_jahr
    AND aa.reduziert_urlaub = true
    AND a.status = 'genehmigt';

  RETURN QUERY SELECT v_anspruch, v_uebertrag, v_genommen, (v_anspruch + v_uebertrag - v_genommen);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 9. Updated_at Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mitarbeiter_updated ON public.mitarbeiter;
CREATE TRIGGER trg_mitarbeiter_updated
  BEFORE UPDATE ON public.mitarbeiter
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
