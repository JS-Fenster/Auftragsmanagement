-- AM-197 MA-P1c + MA-P1d: Zeichen-Sperrliste (System + Historisch + Manuell)
-- Loest hardcoded BLOCKED_ZEICHEN in MitarbeiterDetail.jsx ab.
-- Zeichen gelten als gesperrt wenn sie hier eingetragen sind — Vergabe blockiert.
-- Quellen:
--   'system'   — Nazi/politisch-belastete Codes (SS, HH, etc.) — hart gesetzt beim Seed
--   'historic' — Ehemals von einem Mitarbeiter benutzt (ex_mitarbeiter_id gesetzt)
--   'manual'   — Admin-gesperrt (z.B. reservierte Kuerzel)

CREATE TABLE IF NOT EXISTS public.zeichen_sperrliste (
  zeichen TEXT PRIMARY KEY,
  grund TEXT,
  quelle TEXT NOT NULL CHECK (quelle IN ('system', 'historic', 'manual')),
  ex_mitarbeiter_id UUID REFERENCES mitarbeiter(id) ON DELETE SET NULL,
  gesperrt_ab DATE,
  gesperrt_bis DATE,
  gesperrt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gesperrt_von UUID,
  notiz TEXT
);

-- RLS einschalten (wird spaeter mit Rollen-Modell verfeinert, AM-197 ZE-P1b/MA-P1a)
ALTER TABLE public.zeichen_sperrliste ENABLE ROW LEVEL SECURITY;
-- Uebergangsweise: authenticated darf lesen/schreiben (wie andere MA-Tabellen)
CREATE POLICY zeichen_sperrliste_authenticated_all ON public.zeichen_sperrliste
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: System-Sperren (Nazi/politisch-belastete Codes)
INSERT INTO public.zeichen_sperrliste (zeichen, grund, quelle) VALUES
  ('SS', 'Nazi-Abkuerzung (Schutzstaffel)', 'system'),
  ('SA', 'Nazi-Abkuerzung (Sturmabteilung)', 'system'),
  ('HH', 'Nazi-Abkuerzung (Heil Hitler)', 'system'),
  ('KZ', 'Nazi-Abkuerzung (Konzentrationslager)', 'system'),
  ('NS', 'Nazi-Abkuerzung (Nationalsozialismus)', 'system'),
  ('SD', 'Nazi-Abkuerzung (Sicherheitsdienst)', 'system'),
  ('AH', 'Nazi-Name (Adolf Hitler)', 'system'),
  ('HJ', 'Nazi-Abkuerzung (Hitlerjugend)', 'system')
ON CONFLICT (zeichen) DO NOTHING;
