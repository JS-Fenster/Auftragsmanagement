-- AM-156: Personen-Architektur (Unified Data Model)

-- 1. Personen (Kern — jeder Mensch genau einmal)
CREATE TABLE IF NOT EXISTS public.personen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  titel TEXT,
  anrede TEXT CHECK (anrede IN ('herr', 'frau', 'divers')),
  geburtsdatum DATE,
  zeichen TEXT,
  foto_url TEXT,
  notizen TEXT,
  -- Rueckverweise fuer Migration
  w4a_kontakt_person_id UUID,  -- Link zu alter kontakt_personen.id
  mitarbeiter_alt_id UUID,      -- Link zu alter mitarbeiter.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personen_zeichen ON public.personen(zeichen) WHERE zeichen IS NOT NULL AND zeichen != '';
CREATE INDEX IF NOT EXISTS idx_personen_name ON public.personen(nachname, vorname);
CREATE INDEX IF NOT EXISTS idx_personen_w4a ON public.personen(w4a_kontakt_person_id);

-- 2. Person Kontaktdaten (beliebig viele pro Person)
CREATE TABLE IF NOT EXISTS public.person_kontaktdaten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.personen(id) ON DELETE CASCADE,
  typ TEXT NOT NULL CHECK (typ IN ('telefon_fest', 'telefon_mobil', 'email', 'whatsapp', 'fax', 'webseite', 'sonstiges')),
  wert TEXT NOT NULL,
  label TEXT,  -- z.B. "Arbeitshandy", "Privat", "Notfall"
  ist_primaer BOOLEAN NOT NULL DEFAULT false,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_kontaktdaten_person ON public.person_kontaktdaten(person_id);
CREATE INDEX IF NOT EXISTS idx_person_kontaktdaten_typ ON public.person_kontaktdaten(typ);

-- 3. Person Adressen (beliebig viele pro Person)
CREATE TABLE IF NOT EXISTS public.person_adressen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.personen(id) ON DELETE CASCADE,
  typ TEXT NOT NULL DEFAULT 'privat' CHECK (typ IN ('privat', 'arbeit', 'lieferung', 'rechnungsadresse', 'sonstiges')),
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  land TEXT DEFAULT 'Deutschland',
  ist_primaer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_adressen_person ON public.person_adressen(person_id);

-- 4. Kontakt-Adressen (Geschaeftsadressen auf Kontakt-Ebene)
CREATE TABLE IF NOT EXISTS public.kontakt_adressen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL REFERENCES public.kontakte(id) ON DELETE CASCADE,
  typ TEXT NOT NULL DEFAULT 'geschaeft' CHECK (typ IN ('geschaeft', 'lieferung', 'rechnungsadresse', 'lager')),
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  land TEXT DEFAULT 'Deutschland',
  ist_standard BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kontakt_adressen_kontakt ON public.kontakt_adressen(kontakt_id);

-- 5. Kontakt erweitern: anzeigename + kontakt_typ
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS kontakt_typ TEXT DEFAULT 'firma' CHECK (kontakt_typ IN ('firma', 'privat', 'haushalt', 'partnerschaft'));
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS anzeigename TEXT;

-- 6. Kontakt-Personen-Zuordnung (N:M, ersetzt spaeter kontakt_personen)
CREATE TABLE IF NOT EXISTS public.kontakt_personen_zuordnung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL REFERENCES public.kontakte(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.personen(id) ON DELETE CASCADE,
  rolle TEXT,
  ist_hauptkontakt BOOLEAN NOT NULL DEFAULT false,
  ist_rechnungsempfaenger BOOLEAN NOT NULL DEFAULT false,
  seit DATE,
  bis DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kontakt_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_kpz_kontakt ON public.kontakt_personen_zuordnung(kontakt_id);
CREATE INDEX IF NOT EXISTS idx_kpz_person ON public.kontakt_personen_zuordnung(person_id);

-- 7. Mitarbeiter-Daten (sensibel, getrennt von personen)
CREATE TABLE IF NOT EXISTS public.mitarbeiter_daten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL UNIQUE REFERENCES public.personen(id),
  personalnummer TEXT UNIQUE,
  beschaeftigungsart TEXT DEFAULT 'vollzeit' CHECK (beschaeftigungsart IN ('vollzeit', 'teilzeit', 'minijob', 'azubi', 'praktikant', 'werkstudent')),
  abteilung TEXT,
  funktion TEXT,
  eintrittsdatum DATE NOT NULL,
  austrittsdatum DATE,
  probezeit_monate INTEGER,
  status TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'inaktiv', 'ausgeschieden', 'gekuendigt')),
  verguetungsart TEXT DEFAULT 'gehalt' CHECK (verguetungsart IN ('gehalt', 'stundenlohn')),
  -- Steuer/SV
  steuer_id TEXT,
  steuerklasse INTEGER CHECK (steuerklasse BETWEEN 1 AND 6),
  kinderfreibetraege NUMERIC(3,1) DEFAULT 0,
  konfession TEXT CHECK (konfession IN ('ev', 'rk', 'keine')),
  sv_nummer TEXT,
  rv_nummer TEXT,
  krankenkasse TEXT,
  -- Bank
  bank TEXT,
  iban TEXT,
  bic TEXT,
  -- Lohn
  lohnsatz_1 NUMERIC(8,2) DEFAULT 0,
  lohnsatz_2 NUMERIC(8,2) DEFAULT 0,
  lohnsatz_3 NUMERIC(8,2) DEFAULT 0,
  -- Zeiterfassung
  pausenregel JSONB DEFAULT '{"6":30,"9":45}',
  rundung_taktung INTEGER DEFAULT 5,
  rundung_kommen TEXT DEFAULT 'aufrunden',
  rundung_gehen TEXT DEFAULT 'abrunden',
  fruehester_beginn TIME,
  -- Links
  vorgesetzter_id UUID REFERENCES public.mitarbeiter_daten(id),
  urlaubsgenehmiger_id UUID REFERENCES public.mitarbeiter_daten(id),
  ressource_id UUID REFERENCES public.ressourcen(id),
  auth_user_id UUID,
  -- Referenz zum alten System
  mitarbeiter_alt_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mitarbeiter_daten_person ON public.mitarbeiter_daten(person_id);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_daten_status ON public.mitarbeiter_daten(status);

-- 8. RLS Policies
ALTER TABLE public.personen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_kontaktdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_adressen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kontakt_adressen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kontakt_personen_zuordnung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitarbeiter_daten ENABLE ROW LEVEL SECURITY;

-- Anon + Auth policies (werden spaeter bei AM-035 Auth verschaerft)
CREATE POLICY "personen_anon_all" ON public.personen FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "personen_auth_all" ON public.personen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "person_kontaktdaten_anon_all" ON public.person_kontaktdaten FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "person_kontaktdaten_auth_all" ON public.person_kontaktdaten FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "person_adressen_anon_all" ON public.person_adressen FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "person_adressen_auth_all" ON public.person_adressen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "kontakt_adressen_anon_all" ON public.kontakt_adressen FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "kontakt_adressen_auth_all" ON public.kontakt_adressen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "kontakt_personen_zuordnung_anon_all" ON public.kontakt_personen_zuordnung FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "kontakt_personen_zuordnung_auth_all" ON public.kontakt_personen_zuordnung FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mitarbeiter_daten_anon_all" ON public.mitarbeiter_daten FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mitarbeiter_daten_auth_all" ON public.mitarbeiter_daten FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Updated_at Trigger
DROP TRIGGER IF EXISTS set_updated_at_personen ON public.personen;
CREATE TRIGGER set_updated_at_personen BEFORE UPDATE ON public.personen FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_mitarbeiter_daten ON public.mitarbeiter_daten;
CREATE TRIGGER set_updated_at_mitarbeiter_daten BEFORE UPDATE ON public.mitarbeiter_daten FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
