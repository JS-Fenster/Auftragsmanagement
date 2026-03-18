-- LLM-021: Analytics RPCs for Jess — predefined metrics only, no free SQL

-- 1. Monthly revenue
CREATE OR REPLACE FUNCTION analytics_umsatz_monatlich(
  p_von DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::DATE,
  p_bis DATE DEFAULT CURRENT_DATE,
  p_gruppierung TEXT DEFAULT 'monat'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'labels', COALESCE(jsonb_agg(m.label ORDER BY m.label), '[]'),
    'values', COALESCE(jsonb_agg(m.total ORDER BY m.label), '[]')
  ) INTO v_result
  FROM (
    SELECT
      to_char(dokument_datum, 'YYYY-MM') AS label,
      COALESCE(SUM(summe_netto), 0) AS total
    FROM documents
    WHERE kategorie = 'Rechnung_Ausgehend'
      AND dokument_datum BETWEEN p_von AND p_bis
    GROUP BY to_char(dokument_datum, 'YYYY-MM')
  ) m;
  RETURN COALESCE(v_result, '{"labels":[],"values":[]}');
END;
$$;

-- 2. Documents per category
CREATE OR REPLACE FUNCTION analytics_dokumente_pro_kategorie(
  p_von DATE DEFAULT NULL,
  p_bis DATE DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'labels', COALESCE(jsonb_agg(m.kat ORDER BY m.cnt DESC), '[]'),
    'values', COALESCE(jsonb_agg(m.cnt ORDER BY m.cnt DESC), '[]')
  ) INTO v_result
  FROM (
    SELECT kategorie AS kat, COUNT(*) AS cnt
    FROM documents
    WHERE (p_von IS NULL OR dokument_datum >= p_von)
      AND (p_bis IS NULL OR dokument_datum <= p_bis)
      AND kategorie IS NOT NULL
    GROUP BY kategorie
    ORDER BY cnt DESC
    LIMIT 20
  ) m;
  RETURN COALESCE(v_result, '{"labels":[],"values":[]}');
END;
$$;

-- 3. Projects per status
CREATE OR REPLACE FUNCTION analytics_projekte_pro_status()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'labels', COALESCE(jsonb_agg(m.status ORDER BY m.cnt DESC), '[]'),
    'values', COALESCE(jsonb_agg(m.cnt ORDER BY m.cnt DESC), '[]')
  ) INTO v_result
  FROM (
    SELECT status, COUNT(*) AS cnt
    FROM projekte
    GROUP BY status
    ORDER BY cnt DESC
  ) m;
  RETURN COALESCE(v_result, '{"labels":[],"values":[]}');
END;
$$;

-- 4. Open invoices sum
CREATE OR REPLACE FUNCTION analytics_offene_rechnungen_summe()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'labels', jsonb_build_array('Offen Netto', 'Offen Brutto', 'Anzahl'),
    'values', jsonb_build_array(
      COALESCE(SUM(summe_netto), 0),
      COALESCE(SUM(summe_brutto), 0),
      COUNT(*)
    )
  ) INTO v_result
  FROM documents
  WHERE kategorie = 'Rechnung_Ausgehend'
    AND id NOT IN (
      SELECT DISTINCT d2.id FROM documents d2
      WHERE d2.kategorie = 'Zahlungsavis'
    );
  -- Simplified: counts all outgoing invoices not matched by Zahlungsavis
  RETURN COALESCE(v_result, '{"labels":[],"values":[]}');
END;
$$;

-- 5. Email volume
CREATE OR REPLACE FUNCTION analytics_email_volumen(
  p_von DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_bis DATE DEFAULT CURRENT_DATE,
  p_gruppierung TEXT DEFAULT 'tag'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
  v_format TEXT;
BEGIN
  v_format := CASE p_gruppierung
    WHEN 'monat' THEN 'YYYY-MM'
    WHEN 'woche' THEN 'IYYY-"KW"IW'
    ELSE 'YYYY-MM-DD'
  END;

  SELECT jsonb_build_object(
    'labels', COALESCE(jsonb_agg(m.label ORDER BY m.label), '[]'),
    'values', COALESCE(jsonb_agg(m.cnt ORDER BY m.label), '[]')
  ) INTO v_result
  FROM (
    SELECT to_char(created_at, v_format) AS label, COUNT(*) AS cnt
    FROM documents
    WHERE kategorie ILIKE '%Email%'
      AND created_at BETWEEN p_von AND p_bis + INTERVAL '1 day'
    GROUP BY to_char(created_at, v_format)
  ) m;
  RETURN COALESCE(v_result, '{"labels":[],"values":[]}');
END;
$$;

-- 6. Project lead time (days from created to erledigt)
CREATE OR REPLACE FUNCTION analytics_durchlaufzeit_projekte(
  p_von DATE DEFAULT NULL,
  p_bis DATE DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'labels', jsonb_build_array('Durchschnitt', 'Median', 'Min', 'Max', 'Anzahl'),
    'values', jsonb_build_array(
      COALESCE(ROUND(AVG(erledigt_datum - created_at::date)), 0),
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY erledigt_datum - created_at::date), 0),
      COALESCE(MIN(erledigt_datum - created_at::date), 0),
      COALESCE(MAX(erledigt_datum - created_at::date), 0),
      COUNT(*)
    )
  ) INTO v_result
  FROM projekte
  WHERE erledigt_datum IS NOT NULL
    AND (p_von IS NULL OR created_at >= p_von)
    AND (p_bis IS NULL OR created_at <= p_bis);
  RETURN COALESCE(v_result, '{"labels":[],"values":[]}');
END;
$$;

-- 7. Top customers by revenue
CREATE OR REPLACE FUNCTION analytics_top_kunden_umsatz(
  p_von DATE DEFAULT NULL,
  p_bis DATE DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'labels', COALESCE(jsonb_agg(m.firma ORDER BY m.umsatz DESC), '[]'),
    'values', COALESCE(jsonb_agg(m.umsatz ORDER BY m.umsatz DESC), '[]'),
    'details', COALESCE(jsonb_agg(jsonb_build_object('kontakt_id', m.kontakt_id, 'projekte', m.proj_count) ORDER BY m.umsatz DESC), '[]')
  ) INTO v_result
  FROM (
    SELECT
      k.id AS kontakt_id,
      k.firma1 AS firma,
      COALESCE(SUM(p.auftrags_wert), 0) AS umsatz,
      COUNT(p.id) AS proj_count
    FROM kontakte k
    JOIN projekte p ON p.kontakt_id = k.id
    WHERE (p_von IS NULL OR p.created_at >= p_von)
      AND (p_bis IS NULL OR p.created_at <= p_bis)
    GROUP BY k.id, k.firma1
    ORDER BY umsatz DESC
    LIMIT LEAST(p_limit, 50)
  ) m;
  RETURN COALESCE(v_result, '{"labels":[],"values":[],"details":[]}');
END;
$$;
