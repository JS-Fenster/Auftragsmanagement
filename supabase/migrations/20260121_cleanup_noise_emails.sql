-- =============================================================================
-- Cleanup Script: Existing Noise Emails entfernen
-- Version: 1.0.0 - 2026-01-21
-- =============================================================================
-- SAFETY: Erst DRY-RUN, dann DELETE mit Transaction
-- Entfernt:
-- 1. documents rows die den Filter-Regeln entsprechen
-- 2. zugehoerige email_attachment_hashes (CASCADE)
-- 3. Storage Files muessen manuell / per Supabase Dashboard geloescht werden
-- =============================================================================

-- =============================================================================
-- STEP 1: DRY-RUN - Zeigt was geloescht werden wuerde
-- =============================================================================

-- Zaehle potenzielle Loeschkandidaten
SELECT
  'NOISE CANDIDATES - DRY RUN' as info,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE email_betreff ILIKE 'FRITZ!Repeater%') as fritz_repeater,
  COUNT(*) FILTER (WHERE email_betreff ILIKE '%Versandbestätigung%') as versandbestaetigung,
  COUNT(*) FILTER (WHERE email_betreff ILIKE '%Sendungsverfolgung%') as sendungsverfolgung,
  COUNT(*) FILTER (WHERE email_betreff ILIKE '%Tracking%') as tracking,
  COUNT(*) FILTER (WHERE email_betreff ILIKE '%Paket ist unterwegs%') as paket_unterwegs,
  COUNT(*) FILTER (WHERE email_betreff ILIKE '%Ihre Lieferung%') as ihre_lieferung,
  COUNT(*) FILTER (WHERE SPLIT_PART(email_von_email, '@', 2) IN ('dhl.de', 'dhl.com', 'gls-group.eu', 'ups.com', 'myhermes.de', 'dpd.de')) as carrier_domains,
  COUNT(*) FILTER (WHERE email_von_email ILIKE '%noreply@%' OR email_von_email ILIKE '%no-reply@%') as noreply_mails
FROM documents
WHERE source = 'email';

-- Sample 20 Kandidaten anzeigen
SELECT
  id,
  LEFT(email_betreff, 60) as betreff_preview,
  email_von_email,
  SPLIT_PART(email_von_email, '@', 2) as domain,
  created_at
FROM documents
WHERE source = 'email'
  AND (
    -- Subject-based filters
    email_betreff ILIKE 'FRITZ!Repeater%'
    OR email_betreff ILIKE '%Versandbestätigung%'
    OR email_betreff ILIKE '%Sendungsverfolgung%'
    OR email_betreff ILIKE '%Tracking%'
    OR email_betreff ILIKE '%Paket ist unterwegs%'
    OR email_betreff ILIKE '%Ihre Lieferung%'
    -- Domain-based filters
    OR SPLIT_PART(email_von_email, '@', 2) IN ('dhl.de', 'dhl.com', 'gls-group.eu', 'ups.com', 'myhermes.de', 'dpd.de')
    -- Noreply filters
    OR email_von_email ILIKE '%noreply@%'
    OR email_von_email ILIKE '%no-reply@%'
  )
ORDER BY created_at DESC
LIMIT 20;

-- =============================================================================
-- STEP 2: ACTUAL DELETE (in Transaction)
-- WICHTIG: Nur ausfuehren wenn DRY-RUN OK!
-- =============================================================================

-- UNCOMMENT TO EXECUTE:
/*
BEGIN;

-- Speichere IDs der zu loeschenden Dokumente
CREATE TEMP TABLE docs_to_delete AS
SELECT id, dokument_url
FROM documents
WHERE source = 'email'
  AND (
    email_betreff ILIKE 'FRITZ!Repeater%'
    OR email_betreff ILIKE '%Versandbestätigung%'
    OR email_betreff ILIKE '%Sendungsverfolgung%'
    OR email_betreff ILIKE '%Tracking%'
    OR email_betreff ILIKE '%Paket ist unterwegs%'
    OR email_betreff ILIKE '%Ihre Lieferung%'
    OR SPLIT_PART(email_von_email, '@', 2) IN ('dhl.de', 'dhl.com', 'gls-group.eu', 'ups.com', 'myhermes.de', 'dpd.de')
    OR email_von_email ILIKE '%noreply@%'
    OR email_von_email ILIKE '%no-reply@%'
  );

-- Zaehle Loeschungen
SELECT 'DELETING' as action, COUNT(*) as count FROM docs_to_delete;

-- Loesche email_attachment_hashes (falls vorhanden, CASCADE)
DELETE FROM email_attachment_hashes
WHERE document_id IN (SELECT id FROM docs_to_delete);

-- Loesche documents
DELETE FROM documents
WHERE id IN (SELECT id FROM docs_to_delete);

-- Zeige geloeschte Anzahl
SELECT 'DELETED' as action, COUNT(*) as deleted_count FROM docs_to_delete;

-- Storage-Pfade fuer manuelle Bereinigung ausgeben
SELECT DISTINCT dokument_url as storage_paths_to_delete
FROM docs_to_delete
WHERE dokument_url IS NOT NULL
LIMIT 100;

DROP TABLE docs_to_delete;

COMMIT;
*/

-- =============================================================================
-- ALTERNATIVE: Admin-Review Endpoint zum Cleanup
-- =============================================================================
-- Ein Endpoint /admin-review/cleanup-noise kann implementiert werden:
-- GET: dry-run (count + samples)
-- POST: execute delete mit confirmation

-- =============================================================================
-- Helper: Funktion zum Cleanup via Edge Function
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_noise_documents(
  p_dry_run BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
  action TEXT,
  document_count INT,
  sample_ids UUID[],
  storage_paths TEXT[]
) LANGUAGE plpgsql AS $$
DECLARE
  v_ids UUID[];
  v_paths TEXT[];
  v_count INT;
BEGIN
  -- Find matching documents
  SELECT
    ARRAY_AGG(id),
    ARRAY_AGG(DISTINCT dokument_url) FILTER (WHERE dokument_url IS NOT NULL),
    COUNT(*)
  INTO v_ids, v_paths, v_count
  FROM documents
  WHERE source = 'email'
    AND (
      email_betreff ILIKE 'FRITZ!Repeater%'
      OR email_betreff ILIKE '%Versandbestätigung%'
      OR email_betreff ILIKE '%Sendungsverfolgung%'
      OR email_betreff ILIKE '%Tracking%'
      OR email_betreff ILIKE '%Paket ist unterwegs%'
      OR email_betreff ILIKE '%Ihre Lieferung%'
      OR SPLIT_PART(email_von_email, '@', 2) IN ('dhl.de', 'dhl.com', 'gls-group.eu', 'ups.com', 'myhermes.de', 'dpd.de')
      OR email_von_email ILIKE '%noreply@%'
      OR email_von_email ILIKE '%no-reply@%'
    );

  IF p_dry_run THEN
    RETURN QUERY SELECT
      'DRY_RUN'::TEXT,
      v_count,
      v_ids[1:20], -- nur erste 20 IDs
      v_paths[1:20];
    RETURN;
  END IF;

  -- Actually delete
  DELETE FROM email_attachment_hashes WHERE document_id = ANY(v_ids);
  DELETE FROM documents WHERE id = ANY(v_ids);

  RETURN QUERY SELECT
    'DELETED'::TEXT,
    v_count,
    v_ids[1:20],
    v_paths[1:20];
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_noise_documents TO service_role;
COMMENT ON FUNCTION cleanup_noise_documents IS 'Loescht Noise-Emails basierend auf Filter-Regeln. p_dry_run=TRUE zeigt nur was geloescht wuerde.';
