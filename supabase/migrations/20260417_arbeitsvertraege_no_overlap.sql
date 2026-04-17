-- AM-197 MA-P1b: Verhindert ueberlappende Arbeitsvertraege pro Mitarbeiter
-- Vorher: Zwei Zukunftsvertraege mit sich ueberlappenden Zeitraeumen waren moeglich.
-- Lohnabrechnung konnte nicht entscheiden welcher Vertrag gilt.
-- Audit: _temp/AUDIT_MITARBEITER_2026-04-17.md P1-2
-- Aktuell 10 Vertraege, 0 Ueberlappungen -> risikolose Aktivierung.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.arbeitsvertraege
  ADD CONSTRAINT arbeitsvertraege_no_overlap
  EXCLUDE USING gist (
    mitarbeiter_id WITH =,
    daterange(gueltig_ab, COALESCE(gueltig_bis, 'infinity'::date), '[]') WITH &&
  );
