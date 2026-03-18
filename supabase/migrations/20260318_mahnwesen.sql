-- Mahnwesen: Spalten fuer belege + View fuer faellige Belege
-- Erweiterung bestehender Tabelle + neue View → MCP deploy OK (isoliert)

-- Neue Spalten in belege
ALTER TABLE public.belege
  ADD COLUMN IF NOT EXISTS mahnstufe INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letzte_mahnung_am DATE;

-- View: Faellige Belege (Rechnungstypen die ueberfaellig sind)
CREATE OR REPLACE VIEW public.v_faellige_belege AS
SELECT
  b.id,
  b.beleg_typ,
  b.beleg_nummer,
  b.datum,
  b.empfaenger_firma,
  b.empfaenger_name,
  b.brutto_summe,
  b.zahlungsziel_tage,
  b.mahnstufe,
  b.letzte_mahnung_am,
  b.status,
  b.projekt_id,
  (b.datum + b.zahlungsziel_tage) AS faellig_am,
  (CURRENT_DATE - (b.datum + b.zahlungsziel_tage)) AS ueberfaellig_tage,
  COALESCE(z.gezahlt, 0) AS gezahlt,
  (b.brutto_summe - COALESCE(z.gezahlt, 0)) AS restbetrag
FROM public.belege b
LEFT JOIN (
  SELECT beleg_id, SUM(betrag) AS gezahlt
  FROM public.beleg_zahlungen
  GROUP BY beleg_id
) z ON z.beleg_id = b.id
WHERE b.beleg_typ IN ('rechnung', 'abschlagsrechnung', 'schlussrechnung')
  AND b.status NOT IN ('bezahlt', 'storniert', 'entwurf')
  AND (b.datum + b.zahlungsziel_tage) < CURRENT_DATE;

-- Kommentar
COMMENT ON VIEW public.v_faellige_belege IS 'Faellige (ueberfaellige) Belege fuer Mahnwesen. Zeigt Rechnungstypen deren Zahlungsziel ueberschritten ist.';
