-- Bestehende 10 Mitarbeiter in neue Struktur migrieren

-- 1. Mitarbeiter → personen
INSERT INTO personen (vorname, nachname, anrede, geburtsdatum, zeichen, foto_url, notizen, mitarbeiter_alt_id)
SELECT vorname, nachname, anrede, geburtsdatum, zeichen, foto_url, notizen, id
FROM mitarbeiter
ON CONFLICT DO NOTHING;

-- 2. Mitarbeiter → mitarbeiter_daten (sensible Felder)
INSERT INTO mitarbeiter_daten (
  person_id, personalnummer, beschaeftigungsart, abteilung, funktion,
  eintrittsdatum, austrittsdatum, status, verguetungsart,
  steuer_id, steuerklasse, kinderfreibetraege, konfession,
  sv_nummer, rv_nummer, krankenkasse, bank, iban, bic,
  lohnsatz_1, lohnsatz_2, lohnsatz_3,
  pausenregel, rundung_taktung, rundung_kommen, rundung_gehen, fruehester_beginn,
  ressource_id, auth_user_id, mitarbeiter_alt_id
)
SELECT
  p.id,  -- person_id (verlinkt ueber mitarbeiter_alt_id)
  m.personalnummer, m.beschaeftigungsart, m.abteilung, m.funktion,
  m.eintrittsdatum, m.austrittsdatum, m.status, m.verguetungsart,
  m.steuer_id, m.steuerklasse, m.kinderfreibetraege, m.konfession,
  m.sv_nummer, m.rv_nummer, m.krankenkasse, m.bank, m.iban, m.bic,
  m.lohnsatz_1, m.lohnsatz_2, m.lohnsatz_3,
  m.pausenregel, m.rundung_taktung, m.rundung_kommen, m.rundung_gehen, m.fruehester_beginn,
  m.ressource_id, m.auth_user_id, m.id
FROM mitarbeiter m
JOIN personen p ON p.mitarbeiter_alt_id = m.id
ON CONFLICT DO NOTHING;

-- 3. Mitarbeiter Privatadressen → person_adressen
INSERT INTO person_adressen (person_id, typ, strasse, plz, ort, ist_primaer)
SELECT p.id, 'privat', m.priv_strasse, m.priv_plz, m.priv_ort, true
FROM mitarbeiter m
JOIN personen p ON p.mitarbeiter_alt_id = m.id
WHERE m.priv_strasse IS NOT NULL OR m.priv_plz IS NOT NULL;

-- 4. Mitarbeiter Kontaktdaten → person_kontaktdaten
-- Email Arbeit
INSERT INTO person_kontaktdaten (person_id, typ, wert, label, ist_primaer)
SELECT p.id, 'email', m.email, 'Arbeit', true
FROM mitarbeiter m JOIN personen p ON p.mitarbeiter_alt_id = m.id
WHERE m.email IS NOT NULL AND m.email != '';

-- Email Privat
INSERT INTO person_kontaktdaten (person_id, typ, wert, label, ist_primaer)
SELECT p.id, 'email', m.priv_email, 'Privat', false
FROM mitarbeiter m JOIN personen p ON p.mitarbeiter_alt_id = m.id
WHERE m.priv_email IS NOT NULL AND m.priv_email != '';

-- Telefon Arbeit
INSERT INTO person_kontaktdaten (person_id, typ, wert, label, ist_primaer)
SELECT p.id, 'telefon_fest', m.telefon, 'Arbeit', true
FROM mitarbeiter m JOIN personen p ON p.mitarbeiter_alt_id = m.id
WHERE m.telefon IS NOT NULL AND m.telefon != '';

-- Privat Telefon
INSERT INTO person_kontaktdaten (person_id, typ, wert, label, ist_primaer)
SELECT p.id, 'telefon_fest', m.priv_telefon, 'Privat', false
FROM mitarbeiter m JOIN personen p ON p.mitarbeiter_alt_id = m.id
WHERE m.priv_telefon IS NOT NULL AND m.priv_telefon != '';

-- Privat Mobil
INSERT INTO person_kontaktdaten (person_id, typ, wert, label, ist_primaer)
SELECT p.id, 'telefon_mobil', m.priv_mobil, 'Privat Mobil', false
FROM mitarbeiter m JOIN personen p ON p.mitarbeiter_alt_id = m.id
WHERE m.priv_mobil IS NOT NULL AND m.priv_mobil != '';

-- 5. Kontakt-Adressen aus bestehenden kontakte migrieren
INSERT INTO kontakt_adressen (kontakt_id, typ, strasse, plz, ort, ist_standard)
SELECT id, 'geschaeft', strasse, plz, ort, true
FROM kontakte
WHERE strasse IS NOT NULL OR plz IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. kontakte.anzeigename befuellen
UPDATE kontakte SET anzeigename = firma1 WHERE firma1 IS NOT NULL AND anzeigename IS NULL;
UPDATE kontakte SET kontakt_typ = 'firma' WHERE kontakt_typ IS NULL;
