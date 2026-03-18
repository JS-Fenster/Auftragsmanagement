-- LLM-012: Report RPCs for Jess report generation
-- Each returns JSONB with structured data for frontend rendering

-- ── 1. Finanzbericht ────────────────────────────────────────
CREATE OR REPLACE FUNCTION query_report_finanzen(
  p_von DATE,
  p_bis DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kpis JSONB;
  v_monatlich JSONB;
  v_top_rechnungen JSONB;
BEGIN
  -- KPIs: revenue, expenses, invoice counts
  SELECT jsonb_build_object(
    'umsatz_netto', COALESCE(SUM(CASE WHEN kategorie = 'Rechnung_Ausgehend' THEN summe_netto ELSE 0 END), 0),
    'ausgaben_netto', COALESCE(SUM(CASE WHEN kategorie = 'Rechnung_Eingehend' THEN summe_netto ELSE 0 END), 0),
    'anzahl_rechnungen_ein', COUNT(*) FILTER (WHERE kategorie = 'Rechnung_Eingehend'),
    'anzahl_rechnungen_aus', COUNT(*) FILTER (WHERE kategorie = 'Rechnung_Ausgehend')
  ) INTO v_kpis
  FROM documents
  WHERE kategorie IN ('Rechnung_Eingehend', 'Rechnung_Ausgehend')
    AND dokument_datum BETWEEN p_von AND p_bis;

  -- Monthly breakdown
  SELECT COALESCE(jsonb_agg(row_data ORDER BY monat), '[]'::jsonb) INTO v_monatlich
  FROM (
    SELECT
      to_char(dokument_datum, 'YYYY-MM') AS monat,
      COALESCE(SUM(CASE WHEN kategorie = 'Rechnung_Ausgehend' THEN summe_netto ELSE 0 END), 0) AS einnahmen,
      COALESCE(SUM(CASE WHEN kategorie = 'Rechnung_Eingehend' THEN summe_netto ELSE 0 END), 0) AS ausgaben
    FROM documents
    WHERE kategorie IN ('Rechnung_Eingehend', 'Rechnung_Ausgehend')
      AND dokument_datum BETWEEN p_von AND p_bis
    GROUP BY to_char(dokument_datum, 'YYYY-MM')
  ) sub
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('monat', sub.monat, 'einnahmen', sub.einnahmen, 'ausgaben', sub.ausgaben) AS row_data
  ) lat;

  -- Top invoices by amount
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_top_rechnungen
  FROM (
    SELECT
      id, COALESCE(aussteller_firma, empfaenger_firma, 'Unbekannt') AS firma,
      COALESCE(summe_brutto, summe_netto, 0) AS betrag,
      dokument_datum AS datum, kategorie
    FROM documents
    WHERE kategorie IN ('Rechnung_Eingehend', 'Rechnung_Ausgehend')
      AND dokument_datum BETWEEN p_von AND p_bis
    ORDER BY COALESCE(summe_brutto, summe_netto, 0) DESC
    LIMIT 10
  ) sub
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('id', sub.id, 'firma', sub.firma, 'betrag', sub.betrag, 'datum', sub.datum, 'kategorie', sub.kategorie) AS row_data
  ) lat;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'monatlich', v_monatlich,
    'top_rechnungen', v_top_rechnungen
  );
END;
$$;

-- ── 2. Projekt-Zusammenfassung ──────────────────────────────
CREATE OR REPLACE FUNCTION query_report_projekt(
  p_projekt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_projekt JSONB;
  v_timeline JSONB;
  v_dokumente JSONB;
  v_finanzen JSONB;
BEGIN
  -- Project base data
  SELECT jsonb_build_object(
    'id', p.id,
    'titel', p.titel,
    'projekt_nummer', p.projekt_nummer,
    'status', p.status,
    'typ', p.typ,
    'prioritaet', p.prioritaet,
    'verantwortlich', p.verantwortlich,
    'montage_team', p.montage_team,
    'kontakt_id', p.kontakt_id,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_projekt
  FROM projekte p
  WHERE p.id = p_projekt_id;

  IF v_projekt IS NULL THEN
    RETURN jsonb_build_object('error', 'Projekt nicht gefunden');
  END IF;

  -- Timeline from project history
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'datum', ph.erstellt_am,
      'aktion', ph.aktion,
      'details', COALESCE(ph.feld, '') || CASE WHEN ph.alter_wert IS NOT NULL THEN ': ' || ph.alter_wert || ' -> ' || COALESCE(ph.neuer_wert, '') ELSE COALESCE(': ' || ph.neuer_wert, '') END
    ) ORDER BY ph.erstellt_am DESC
  ), '[]'::jsonb) INTO v_timeline
  FROM projekt_historie ph
  WHERE ph.projekt_id = p_projekt_id;

  -- Documents linked via belege
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'typ', b.beleg_typ,
      'status', b.status,
      'datum', b.datum,
      'betrag_netto', b.netto_summe,
      'betrag_brutto', b.brutto_summe
    ) ORDER BY b.datum DESC
  ), '[]'::jsonb) INTO v_dokumente
  FROM belege b
  WHERE b.projekt_id = p_projekt_id;

  -- Financial summary
  SELECT jsonb_build_object(
    'angebots_wert', COALESCE(p.angebots_wert, 0),
    'auftrags_wert', COALESCE(p.auftrags_wert, 0),
    'rechnungs_betrag', COALESCE(p.rechnungs_betrag, 0)
  ) INTO v_finanzen
  FROM projekte p
  WHERE p.id = p_projekt_id;

  RETURN jsonb_build_object(
    'projekt', v_projekt,
    'timeline', v_timeline,
    'dokumente', v_dokumente,
    'finanzen', v_finanzen
  );
END;
$$;

-- ── 3. Kunden-Historie ──────────────────────────────────────
CREATE OR REPLACE FUNCTION query_report_kunde(
  p_kunde_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kontakt JSONB;
  v_projekte JSONB;
  v_dokumente JSONB;
  v_kommunikation JSONB;
  v_firma TEXT;
BEGIN
  -- Contact base data
  SELECT jsonb_build_object(
    'id', k.id,
    'firma1', k.firma1,
    'firma2', k.firma2,
    'strasse', k.strasse,
    'plz', k.plz,
    'ort', k.ort,
    'ist_kunde', k.ist_kunde,
    'ist_lieferant', k.ist_lieferant,
    'typ', k.typ
  ), k.firma1
  INTO v_kontakt, v_firma
  FROM kontakte k
  WHERE k.id = p_kunde_id;

  IF v_kontakt IS NULL THEN
    RETURN jsonb_build_object('error', 'Kontakt nicht gefunden');
  END IF;

  -- Projects for this contact
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'titel', p.titel,
      'status', p.status,
      'angebots_wert', COALESCE(p.angebots_wert, 0),
      'auftrags_wert', COALESCE(p.auftrags_wert, 0),
      'created_at', p.created_at
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb) INTO v_projekte
  FROM projekte p
  WHERE p.kontakt_id = p_kunde_id;

  -- Documents linked to this customer (by firma name)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'kategorie', d.kategorie,
      'datum', d.dokument_datum,
      'betreff', d.email_betreff,
      'betrag', COALESCE(d.summe_brutto, d.summe_netto)
    ) ORDER BY d.dokument_datum DESC
  ), '[]'::jsonb) INTO v_dokumente
  FROM documents d
  WHERE (d.aussteller_firma ILIKE '%' || v_firma || '%'
    OR d.empfaenger_firma ILIKE '%' || v_firma || '%')
    AND v_firma IS NOT NULL
  LIMIT 50;

  -- Communication (emails)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'datum', d.dokument_datum,
      'typ', d.kategorie,
      'betreff', d.email_betreff
    ) ORDER BY d.dokument_datum DESC
  ), '[]'::jsonb) INTO v_kommunikation
  FROM documents d
  WHERE d.kategorie = 'Email'
    AND (d.aussteller_firma ILIKE '%' || v_firma || '%'
      OR d.empfaenger_firma ILIKE '%' || v_firma || '%')
    AND v_firma IS NOT NULL
  LIMIT 20;

  RETURN jsonb_build_object(
    'kontakt', v_kontakt,
    'projekte', v_projekte,
    'dokumente', v_dokumente,
    'kommunikation', v_kommunikation
  );
END;
$$;

-- ── 4. Pipeline-Analyse ─────────────────────────────────────
CREATE OR REPLACE FUNCTION query_report_pipeline()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nach_status JSONB;
  v_conversion JSONB;
BEGIN
  -- Group projects by status
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'status', status,
      'anzahl', cnt,
      'wert', COALESCE(wert, 0)
    ) ORDER BY cnt DESC
  ), '[]'::jsonb) INTO v_nach_status
  FROM (
    SELECT status, COUNT(*) AS cnt, SUM(COALESCE(auftrags_wert, angebots_wert, 0)) AS wert
    FROM projekte
    WHERE status NOT IN ('storniert', 'erledigt')
    GROUP BY status
  ) sub;

  -- Conversion rate
  SELECT jsonb_build_object(
    'anfragen_gesamt', COUNT(*) FILTER (WHERE status IS NOT NULL),
    'auftraege_gesamt', COUNT(*) FILTER (WHERE status NOT IN ('anfrage', 'angebot', 'storniert')),
    'rate', CASE
      WHEN COUNT(*) > 0
      THEN ROUND(100.0 * COUNT(*) FILTER (WHERE status NOT IN ('anfrage', 'angebot', 'storniert'))::numeric / COUNT(*)::numeric, 1)
      ELSE 0
    END
  ) INTO v_conversion
  FROM projekte;

  RETURN jsonb_build_object(
    'nach_status', v_nach_status,
    'conversion', v_conversion
  );
END;
$$;

-- ── 5. Offene Posten ────────────────────────────────────────
CREATE OR REPLACE FUNCTION query_report_offene_posten()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ueberfaellig JSONB;
  v_gesamt_offen NUMERIC;
  v_altersanalyse JSONB;
BEGIN
  -- Overdue outgoing invoices (belege with status not 'bezahlt')
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'firma', COALESCE(b.empfaenger_firma, 'Unbekannt'),
      'betrag', COALESCE(b.brutto_summe, b.netto_summe, 0),
      'faellig_seit', b.gueltig_bis,
      'tage', EXTRACT(DAY FROM CURRENT_DATE - COALESCE(b.gueltig_bis, b.datum))::int
    ) ORDER BY COALESCE(b.gueltig_bis, b.datum) ASC
  ), '[]'::jsonb) INTO v_ueberfaellig
  FROM belege b
  WHERE b.beleg_typ IN ('rechnung', 'abschlagsrechnung', 'schlussrechnung')
    AND b.status NOT IN ('bezahlt', 'storniert', 'entwurf')
    AND COALESCE(b.gueltig_bis, b.datum) < CURRENT_DATE;

  -- Total open amount
  SELECT COALESCE(SUM(COALESCE(b.brutto_summe, b.netto_summe, 0)), 0)
  INTO v_gesamt_offen
  FROM belege b
  WHERE b.beleg_typ IN ('rechnung', 'abschlagsrechnung', 'schlussrechnung')
    AND b.status NOT IN ('bezahlt', 'storniert', 'entwurf');

  -- Age analysis
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('bereich', bereich, 'anzahl', anzahl, 'summe', summe)
    ORDER BY sort_order
  ), '[]'::jsonb) INTO v_altersanalyse
  FROM (
    SELECT
      CASE
        WHEN tage <= 30 THEN '0-30 Tage'
        WHEN tage <= 60 THEN '31-60 Tage'
        WHEN tage <= 90 THEN '61-90 Tage'
        ELSE 'Ueber 90 Tage'
      END AS bereich,
      CASE
        WHEN tage <= 30 THEN 1
        WHEN tage <= 60 THEN 2
        WHEN tage <= 90 THEN 3
        ELSE 4
      END AS sort_order,
      COUNT(*) AS anzahl,
      COALESCE(SUM(betrag), 0) AS summe
    FROM (
      SELECT
        EXTRACT(DAY FROM CURRENT_DATE - COALESCE(b.gueltig_bis, b.datum))::int AS tage,
        COALESCE(b.brutto_summe, b.netto_summe, 0) AS betrag
      FROM belege b
      WHERE b.beleg_typ IN ('rechnung', 'abschlagsrechnung', 'schlussrechnung')
        AND b.status NOT IN ('bezahlt', 'storniert', 'entwurf')
    ) inner_sub
    GROUP BY bereich, sort_order
  ) sub;

  RETURN jsonb_build_object(
    'ueberfaellig', v_ueberfaellig,
    'gesamt_offen', v_gesamt_offen,
    'altersanalyse', v_altersanalyse
  );
END;
$$;

-- ── 6. Montage-Uebersicht ──────────────────────────────────
CREATE OR REPLACE FUNCTION query_report_montage(
  p_von DATE,
  p_bis DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_geplant JSONB;
  v_team_auslastung JSONB;
BEGIN
  -- Planned assemblies from documents (Montageauftrag)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'titel', COALESCE(d.empfaenger_nachname, d.email_betreff, 'Montage'),
      'datum', d.montage_datum,
      'team', d.montageteam,
      'ort', COALESCE(d.montageort_ort, d.montageort_strasse)
    ) ORDER BY d.montage_datum ASC
  ), '[]'::jsonb) INTO v_geplant
  FROM documents d
  WHERE d.kategorie = 'Montageauftrag'
    AND d.montage_datum BETWEEN p_von AND p_bis;

  -- Team workload
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('team', team, 'anzahl', anzahl)
    ORDER BY anzahl DESC
  ), '[]'::jsonb) INTO v_team_auslastung
  FROM (
    SELECT COALESCE(d.montageteam, 'Nicht zugewiesen') AS team, COUNT(*) AS anzahl
    FROM documents d
    WHERE d.kategorie = 'Montageauftrag'
      AND d.montage_datum BETWEEN p_von AND p_bis
    GROUP BY COALESCE(d.montageteam, 'Nicht zugewiesen')
  ) sub;

  RETURN jsonb_build_object(
    'geplant', v_geplant,
    'team_auslastung', v_team_auslastung
  );
END;
$$;
