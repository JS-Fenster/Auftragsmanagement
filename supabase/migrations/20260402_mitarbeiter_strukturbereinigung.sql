-- AM-127: rolle → beschaeftigungsart, Status bereinigen

-- 1. Neue Spalte beschaeftigungsart
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS beschaeftigungsart TEXT DEFAULT 'vollzeit'
  CHECK (beschaeftigungsart IN ('vollzeit', 'teilzeit', 'minijob', 'azubi', 'praktikant', 'werkstudent'));

-- 2. Daten migrieren: alte rolle → neue beschaeftigungsart
UPDATE mitarbeiter SET beschaeftigungsart = 'teilzeit' WHERE rolle = 'teilzeit';
UPDATE mitarbeiter SET beschaeftigungsart = 'minijob' WHERE rolle = 'minijob';
UPDATE mitarbeiter SET beschaeftigungsart = 'azubi' WHERE rolle = 'azubi';
-- monteur/buero/geschaeftsfuehrung bleiben vollzeit (default)

-- 3. Status CHECK Constraint aktualisieren (Elternzeit/Mutterschutz/Kurzarbeit raus)
ALTER TABLE public.mitarbeiter DROP CONSTRAINT IF EXISTS mitarbeiter_status_check;
ALTER TABLE public.mitarbeiter ADD CONSTRAINT mitarbeiter_status_check
  CHECK (status IN ('aktiv', 'inaktiv', 'ausgeschieden', 'gekuendigt'));

-- Update bestehende Status die nicht mehr gueltig sind
UPDATE mitarbeiter SET status = 'aktiv' WHERE status IN ('elternzeit', 'mutterschutz', 'kurzarbeit');

-- 4. Rolle CHECK Constraint aktualisieren (nur Abteilungs-Rollen)
ALTER TABLE public.mitarbeiter DROP CONSTRAINT IF EXISTS mitarbeiter_rolle_check;
ALTER TABLE public.mitarbeiter ADD CONSTRAINT mitarbeiter_rolle_check
  CHECK (rolle IN ('monteur', 'buero', 'geschaeftsfuehrung', 'lager', 'vertrieb'));
