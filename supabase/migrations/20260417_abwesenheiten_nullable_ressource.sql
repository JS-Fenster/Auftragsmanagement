-- Abwesenheiten: ressource_id nullable
-- Grund: Buerokraefte (rolle='buero') haben keine Ressource, weil ressourcen urspruenglich
-- fuer Einsatzplanung (Monteure) gedacht waren. Abwesenheits-System wurde spaeter auf alle MAs
-- ausgeweitet -> NOT NULL Constraint blockte Bulk-Eintraege fuer Buero-MAs.
-- Kalender-Code ist bereits NULL-safe (faellt auf mitarbeiter.ressource_id zurueck).

ALTER TABLE abwesenheiten ALTER COLUMN ressource_id DROP NOT NULL;
