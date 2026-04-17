-- AM-197 MA-P1f: Lohnsatz_2 + Lohnsatz_3 entfernen
-- W4A-Erbe, nirgends mit sinnvoller Semantik verwendet (AS 2026-04-17: "kein Sinn").
-- Falls spaeter Zuschlaege/Prämien gebraucht werden -> separate Tabelle lohnsaetze.

ALTER TABLE public.mitarbeiter DROP COLUMN IF EXISTS lohnsatz_2;
ALTER TABLE public.mitarbeiter DROP COLUMN IF EXISTS lohnsatz_3;
ALTER TABLE public.mitarbeiter_daten DROP COLUMN IF EXISTS lohnsatz_2;
ALTER TABLE public.mitarbeiter_daten DROP COLUMN IF EXISTS lohnsatz_3;
