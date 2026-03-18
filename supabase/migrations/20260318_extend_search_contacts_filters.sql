-- Extend search_contacts with ort/plz/name_pattern filters
-- + extend search_vector to include strasse + ort

-- 1. Drop old search_contacts overload (3 params)
DROP FUNCTION IF EXISTS public.search_contacts(text, text, integer);

-- 2. Extend search_vector generated column with strasse + ort
DROP INDEX IF EXISTS idx_kontakte_search_vector;

ALTER TABLE public.kontakte DROP COLUMN search_vector;

ALTER TABLE public.kontakte ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(firma1, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(firma2, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(kundennummer, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(hinweis_kontakt, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(notiz, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(strasse, '')), 'C') ||
    setweight(to_tsvector('german', coalesce(ort, '')), 'C')
  ) STORED;

CREATE INDEX idx_kontakte_search_vector ON public.kontakte USING gin (search_vector);

-- 3. New search_contacts with address and name pattern filters
CREATE OR REPLACE FUNCTION public.search_contacts(
  search_query text DEFAULT NULL,
  filter_typ text DEFAULT NULL,
  max_results integer DEFAULT 20,
  filter_ort text DEFAULT NULL,
  filter_plz text DEFAULT NULL,
  filter_name_pattern text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, firma1 text, firma2 text, kundennummer text, lieferantennummer text,
  typ text, ist_kunde boolean, ist_lieferant boolean, strasse text, plz text,
  ort text, hinweis_kontakt text, notiz text, similarity_score real,
  fulltext_rank real, combined_score real, personen jsonb
)
LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  ts_query tsquery;
  has_search boolean;
BEGIN
  has_search := search_query IS NOT NULL AND search_query <> '';
  IF has_search THEN
    ts_query := plainto_tsquery('german', search_query);
  END IF;

  RETURN QUERY
  WITH scored_kontakte AS (
    SELECT
      k.id, k.firma1, k.firma2, k.kundennummer, k.lieferantennummer,
      k.typ, k.ist_kunde, k.ist_lieferant, k.strasse, k.plz, k.ort,
      k.hinweis_kontakt, k.notiz,
      CASE WHEN has_search THEN
        GREATEST(
          similarity(coalesce(k.firma1, ''), search_query),
          similarity(coalesce(k.firma2, ''), search_query)
        )::real
      ELSE 0.0::real END AS sim_score,
      CASE WHEN has_search AND k.search_vector @@ ts_query
        THEN ts_rank_cd(k.search_vector, ts_query)::real
        ELSE 0.0::real
      END AS ft_rank
    FROM public.kontakte k
    WHERE
      (filter_typ IS NULL OR
        (filter_typ = 'kunde' AND k.ist_kunde = true) OR
        (filter_typ = 'lieferant' AND k.ist_lieferant = true))
      AND (filter_ort IS NULL OR k.ort ILIKE '%' || filter_ort || '%'
           OR k.strasse ILIKE '%' || filter_ort || '%')
      AND (filter_plz IS NULL OR k.plz LIKE filter_plz || '%')
      AND (filter_name_pattern IS NULL OR EXISTS (
        SELECT 1 FROM public.kontakt_personen kp
        WHERE kp.kontakt_id = k.id
        AND (kp.nachname ILIKE filter_name_pattern
             OR k.firma1 ILIKE filter_name_pattern
             OR k.firma2 ILIKE filter_name_pattern)
      ))
      AND (NOT has_search OR (
        similarity(coalesce(k.firma1, ''), search_query) > 0.15
        OR similarity(coalesce(k.firma2, ''), search_query) > 0.15
        OR k.search_vector @@ ts_query
        OR EXISTS (
          SELECT 1 FROM public.kontakt_personen kp
          WHERE kp.kontakt_id = k.id
          AND (
            similarity(coalesce(kp.nachname, ''), search_query) > 0.3
            OR similarity(coalesce(kp.vorname, '') || ' ' || coalesce(kp.nachname, ''), search_query) > 0.3
          )
        )
      ))
  )
  SELECT
    sk.id, sk.firma1, sk.firma2, sk.kundennummer, sk.lieferantennummer,
    sk.typ, sk.ist_kunde, sk.ist_lieferant, sk.strasse, sk.plz, sk.ort,
    sk.hinweis_kontakt, sk.notiz,
    sk.sim_score AS similarity_score, sk.ft_rank AS fulltext_rank,
    (sk.sim_score * 0.6 + sk.ft_rank * 0.4)::real AS combined_score,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'vorname', kp.vorname, 'nachname', kp.nachname,
        'rolle', kp.rolle, 'ist_hauptkontakt', kp.ist_hauptkontakt,
        'details', (
          SELECT jsonb_agg(jsonb_build_object('typ', kd.typ, 'wert', kd.wert, 'ist_primaer', kd.ist_primaer))
          FROM public.kontakt_details kd WHERE kd.kontakt_person_id = kp.id
        )
      ))
      FROM public.kontakt_personen kp WHERE kp.kontakt_id = sk.id),
      '[]'::jsonb
    ) AS personen
  FROM scored_kontakte sk
  ORDER BY (sk.sim_score * 0.6 + sk.ft_rank * 0.4) DESC
  LIMIT max_results;
END;
$function$;
