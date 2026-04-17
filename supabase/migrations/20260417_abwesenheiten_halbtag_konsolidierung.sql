-- AM-194: Halbtag-Konsolidierung (Teil 2 — Daten-Migration)
-- Stellt alle abwesenheiten mit Halbtag-Slug (_vm/_nm) auf das neue Modell um:
--   Art-ID -> Basis-Art (z.B. urlaub_ganz, ueberstunden_ausgleich)
--   halbtag-Spalte -> 'vm' / 'nm'
--   ganztaegig -> false
-- Anschliessend werden die redundanten Halbtag-Arten auf aktiv=false gesetzt.
-- Frontend-Helpers (isHalbtagAbw, getHalbtagSeiteAbw) haben einen Fallback auf
-- den Slug-Suffix, falls jemals ein Eintrag durchrutscht — kein Breaking Change.

-- Urlaub halbtag vormittags -> urlaub_ganz + halbtag=vm
UPDATE abwesenheiten
SET abwesenheitsart_id = 'cd7ed19a-8f06-4d01-bd56-ccb834c8342c'::uuid,
    halbtag = 'vm',
    ganztaegig = false
WHERE abwesenheitsart_id = '3907a1ae-12a5-4609-b41d-b1c456db2617'::uuid;

-- Urlaub halbtag nachmittags -> urlaub_ganz + halbtag=nm
UPDATE abwesenheiten
SET abwesenheitsart_id = 'cd7ed19a-8f06-4d01-bd56-ccb834c8342c'::uuid,
    halbtag = 'nm',
    ganztaegig = false
WHERE abwesenheitsart_id = '0ca82ef3-3515-4693-a4ff-0077b40049d7'::uuid;

-- Ueberstundenausgleich halbtag vormittags -> ueberstunden_ausgleich + halbtag=vm
UPDATE abwesenheiten
SET abwesenheitsart_id = 'de7c08fd-e14f-4855-bfe9-5fa3294767dd'::uuid,
    halbtag = 'vm',
    ganztaegig = false
WHERE abwesenheitsart_id = '803c93bb-a622-419c-be29-5c4c01ac913e'::uuid;

-- Ueberstundenausgleich halbtag nachmittags -> ueberstunden_ausgleich + halbtag=nm
UPDATE abwesenheiten
SET abwesenheitsart_id = 'de7c08fd-e14f-4855-bfe9-5fa3294767dd'::uuid,
    halbtag = 'nm',
    ganztaegig = false
WHERE abwesenheitsart_id = 'eaae63b9-6b4b-434a-8e58-ae75fe3a1229'::uuid;

-- Halbtag-Arten deaktivieren (nicht loeschen — Foreign-Key-Referenzen in historischen Daten bleiben gueltig)
UPDATE abwesenheitsarten
SET aktiv = false
WHERE slug IN ('urlaub_halbtag_vm', 'urlaub_halbtag_nm', 'ueberstunden_halbtag_vm', 'ueberstunden_halbtag_nm');
