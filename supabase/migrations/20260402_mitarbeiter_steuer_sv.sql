-- AM-128: Steuer- und Sozialversicherungsdaten
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS steuer_id TEXT;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS steuerklasse INTEGER CHECK (steuerklasse BETWEEN 1 AND 6);
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS kinderfreibetraege NUMERIC(3,1) DEFAULT 0;
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS konfession TEXT CHECK (konfession IN ('ev', 'rk', 'keine', NULL));
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS rv_nummer TEXT;
