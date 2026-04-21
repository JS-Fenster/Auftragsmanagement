-- Migration: kontakte um Buchhaltungs-/Zahlungsfelder erweitern
-- Welle 1 der Dokumentenkette-Architektur (wissen/DOKUMENTENKETTE_ARCHITEKTUR.md)
-- Zweck: Default-Werte am Geschaeftspartner, die spaeter beim Erzeugen von Belegen/
--        Bestellungen/Eingangsrechnungen automatisch gezogen werden (Welle 2+).
--
-- Risiko: niedrig — rein additive ALTER TABLE ADD COLUMN, alle NULLABLE, keine
--         Daten-Migration, keine RLS-Aenderung. Bestehende Queries bleiben valide.

-- Steuer
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS ust_id text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS steuernummer text;

COMMENT ON COLUMN public.kontakte.ust_id IS 'Umsatzsteuer-Identifikationsnummer (z.B. DE123456789). Fuer B2B-Rechnungen + Reverse Charge.';
COMMENT ON COLUMN public.kontakte.steuernummer IS 'Nationale Steuernummer (falls vorhanden, z.B. Privatpersonen oder Kleinunternehmer).';

-- Bank
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS bic text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS kontoinhaber text;

COMMENT ON COLUMN public.kontakte.iban IS 'IBAN des Geschaeftspartners. Bei Lieferanten: wohin wir zahlen. Bei Kunden: woher Einzug (SEPA) oder Referenz.';
COMMENT ON COLUMN public.kontakte.bic IS 'BIC/SWIFT (optional bei SEPA-DE).';
COMMENT ON COLUMN public.kontakte.bank_name IS 'Name der Bank (z.B. Sparkasse Amberg).';
COMMENT ON COLUMN public.kontakte.kontoinhaber IS 'Kontoinhaber falls abweichend vom Firma/Privat-Namen.';

-- DATEV
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS debitoren_konto text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS kreditoren_konto text;

COMMENT ON COLUMN public.kontakte.debitoren_konto IS 'DATEV-Debitoren-Kontonummer (Kunden-Sachkonto, 10000-69999).';
COMMENT ON COLUMN public.kontakte.kreditoren_konto IS 'DATEV-Kreditoren-Kontonummer (Lieferanten-Sachkonto, 70000-99999).';

-- Zahlungs-Defaults (werden beim Erzeugen neuer Belege/Bestellungen/EN vorausgefuellt)
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS default_zahlungsziel_tage integer;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS default_skonto_prozent numeric(5,2);
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS default_skonto_tage integer;

COMMENT ON COLUMN public.kontakte.default_zahlungsziel_tage IS 'Default Zahlungsziel in Tagen fuer neue Belege (14, 30, 60). NULL = Firmen-Default 14 verwenden.';
COMMENT ON COLUMN public.kontakte.default_skonto_prozent IS 'Default Skonto-Prozentsatz fuer Frueh-Zahlung (z.B. 2.00). NULL = kein Skonto.';
COMMENT ON COLUMN public.kontakte.default_skonto_tage IS 'Skonto-Frist in Tagen (z.B. 14). Zusammen mit default_skonto_prozent aktiv.';

-- E-Rechnung / Kommunikation
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS leitweg_id text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS rechnungs_email text;
ALTER TABLE public.kontakte ADD COLUMN IF NOT EXISTS bestell_email text;

COMMENT ON COLUMN public.kontakte.leitweg_id IS 'Leitweg-ID fuer E-Rechnung B2G (Behoerden). Format: 991-XXXXX-XX. Pflicht ab 2025 bei oeffentlichen Auftraggebern.';
COMMENT ON COLUMN public.kontakte.rechnungs_email IS 'Email-Adresse speziell fuer Rechnungsversand (haeufig buchhaltung@..., abweichend vom Hauptkontakt).';
COMMENT ON COLUMN public.kontakte.bestell_email IS 'Email-Adresse fuer Bestellungen an diesen Lieferanten (einkauf@..., bestellungen@...). Nur relevant wenn ist_lieferant=true.';

-- Check-Constraints (optional, weich)
ALTER TABLE public.kontakte DROP CONSTRAINT IF EXISTS kontakte_zahlungsziel_check;
ALTER TABLE public.kontakte ADD CONSTRAINT kontakte_zahlungsziel_check
  CHECK (default_zahlungsziel_tage IS NULL OR default_zahlungsziel_tage BETWEEN 0 AND 365);

ALTER TABLE public.kontakte DROP CONSTRAINT IF EXISTS kontakte_skonto_check;
ALTER TABLE public.kontakte ADD CONSTRAINT kontakte_skonto_check
  CHECK (
    (default_skonto_prozent IS NULL AND default_skonto_tage IS NULL) OR
    (default_skonto_prozent BETWEEN 0 AND 20 AND default_skonto_tage BETWEEN 0 AND 90)
  );
