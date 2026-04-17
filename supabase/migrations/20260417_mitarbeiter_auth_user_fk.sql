-- AM-197 MA-P1g: auth_user_id Foreign Key auf auth.users
-- Verhindert Orphan-Eintraege nach Loeschen eines Auth-Users.
-- ON DELETE SET NULL: Wenn Auth-User geloescht wird, bleibt der Mitarbeiter-Datensatz
-- erhalten (Historie, Abrechnung), aber auth_user_id wird zurueckgesetzt.
-- Audit: _temp/AUDIT_MITARBEITER_2026-04-17.md

ALTER TABLE public.mitarbeiter
  ADD CONSTRAINT mitarbeiter_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
