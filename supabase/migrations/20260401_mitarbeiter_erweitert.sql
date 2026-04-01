-- AM-122: Erweiterte Mitarbeiter-Felder (komplett wie W4A)
-- Applied via MCP on 2026-04-01

-- Allgemeines
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS anrede TEXT CHECK (anrede IN ('herr', 'frau', 'divers'));
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS verguetungsart TEXT DEFAULT 'gehalt' CHECK (verguetungsart IN ('gehalt', 'stundenlohn'));
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS zeichen TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS abteilung TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS funktion TEXT;

-- Vorgesetzter + Urlaubsgenehmiger
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS vorgesetzter_id UUID REFERENCES public.mitarbeiter(id);
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS urlaubsgenehmiger_id UUID REFERENCES public.mitarbeiter(id);

-- Personaldaten
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS geburtsort TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS staatsangehoerigkeit TEXT DEFAULT 'Deutsch';
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS sv_nummer TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS krankenkasse TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS bank TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS bic TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS lohnsatz_1 NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS lohnsatz_2 NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS lohnsatz_3 NUMERIC(8,2) DEFAULT 0;

-- Privatadresse
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_strasse TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_plz TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_ort TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_land TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_telefon TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_email TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS priv_mobil TEXT;

-- Notfallkontakt
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS notfall_name TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS notfall_telefon TEXT;

-- Zeiterfassung pro Mitarbeiter
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS pausenregel JSONB DEFAULT '{"6":30,"9":45}';
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS rundung_taktung INTEGER DEFAULT 5;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS rundung_kommen TEXT DEFAULT 'aufrunden' CHECK (rundung_kommen IN ('aufrunden', 'abrunden', 'auf_ab'));
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS rundung_gehen TEXT DEFAULT 'abrunden' CHECK (rundung_gehen IN ('aufrunden', 'abrunden', 'auf_ab'));
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS fruehester_beginn TIME;
