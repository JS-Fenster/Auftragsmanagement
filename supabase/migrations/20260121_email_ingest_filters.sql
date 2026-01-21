-- =============================================================================
-- Email Ingest Filters + Ignored Emails
-- Version: 1.0.0 - 2026-01-21
-- =============================================================================
-- Ermoeglicht konfigurierbare Filterregeln um "Noise" Emails beim Ingest
-- zu ignorieren (z.B. FRITZ!Repeater-Info, Tracking-Mails).
-- =============================================================================

-- Tabelle fuer Filterregeln
CREATE TABLE IF NOT EXISTS email_ingest_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Filter Definition
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'subject_prefix',    -- Betreff beginnt mit...
    'subject_contains',  -- Betreff enthaelt...
    'subject_regex',     -- Betreff matched Regex
    'from_domain',       -- Absender-Domain
    'from_email',        -- Exakte Absender-Adresse
    'body_contains'      -- Body enthaelt Text
  )),
  pattern TEXT NOT NULL,

  -- Kombinations-Logik: Filter matcht nur wenn ALLE conditions einer Gruppe erfuellt sind
  -- group_id erlaubt AND-Verknuepfung mehrerer Filter
  group_id TEXT DEFAULT NULL,

  -- Action wenn Filter matcht
  action TEXT NOT NULL DEFAULT 'drop' CHECK (action IN ('drop', 'flag')),
  reason TEXT NOT NULL, -- z.B. "FRITZ!Repeater Auto-Status"

  -- Aktivierung
  enabled BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0, -- hoehere Prio wird zuerst geprueft

  -- Stats
  match_count INT DEFAULT 0,
  last_match_at TIMESTAMPTZ
);

-- Index fuer schnelle Filterung
CREATE INDEX idx_email_ingest_filters_enabled ON email_ingest_filters(enabled, priority DESC);
CREATE INDEX idx_email_ingest_filters_group ON email_ingest_filters(group_id) WHERE group_id IS NOT NULL;

-- Tabelle fuer ignorierte Emails (Logging/Debugging)
CREATE TABLE IF NOT EXISTS ignored_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Email Identifikation (fuer Idempotenz)
  email_postfach TEXT NOT NULL,
  email_message_id TEXT NOT NULL,

  -- Matched Filter Info
  matched_filter_id UUID REFERENCES email_ingest_filters(id) ON DELETE SET NULL,
  matched_reason TEXT NOT NULL,

  -- Email-Daten fuer Debugging
  subject TEXT,
  from_email TEXT,
  from_domain TEXT,
  body_preview TEXT, -- erste 500 Zeichen

  -- Unique Constraint: verhindert Duplikate bei Retry
  UNIQUE(email_postfach, email_message_id)
);

-- Index fuer Analyse
CREATE INDEX idx_ignored_emails_created ON ignored_emails(created_at DESC);
CREATE INDEX idx_ignored_emails_reason ON ignored_emails(matched_reason);
CREATE INDEX idx_ignored_emails_domain ON ignored_emails(from_domain);

-- =============================================================================
-- Initial Filter Rules (Seed Data)
-- =============================================================================

-- Gruppe 1: FRITZ!Repeater Status-Mails
INSERT INTO email_ingest_filters (name, type, pattern, group_id, reason, priority) VALUES
  ('FRITZ!Repeater Subject', 'subject_prefix', 'FRITZ!Repeater-Info', 'fritz_repeater', 'FRITZ!Repeater Auto-Status', 10);

-- Gruppe 2: Versand-Tracking Mails (verschiedene Carrier)
INSERT INTO email_ingest_filters (name, type, pattern, reason, priority) VALUES
  ('Versandbestaetigung Subject', 'subject_contains', 'Versandbestätigung', 'Versand-Tracking Notification', 5),
  ('Sendungsverfolgung Subject', 'subject_contains', 'Sendungsverfolgung', 'Versand-Tracking Notification', 5),
  ('Tracking Subject', 'subject_contains', 'Tracking', 'Versand-Tracking Notification', 3),
  ('Paket unterwegs Subject', 'subject_contains', 'Paket ist unterwegs', 'Versand-Tracking Notification', 5),
  ('Lieferung Subject', 'subject_contains', 'Ihre Lieferung', 'Versand-Tracking Notification', 3);

-- Carrier-spezifische Filter (Domain-basiert)
INSERT INTO email_ingest_filters (name, type, pattern, reason, priority, description) VALUES
  ('DHL Domain', 'from_domain', 'dhl.de', 'DHL Tracking/Benachrichtigung', 2, 'Alle DHL Mails'),
  ('DHL Domain .com', 'from_domain', 'dhl.com', 'DHL Tracking/Benachrichtigung', 2, 'DHL International'),
  ('GLS Domain', 'from_domain', 'gls-group.eu', 'GLS Tracking/Benachrichtigung', 2, 'Alle GLS Mails'),
  ('UPS Domain', 'from_domain', 'ups.com', 'UPS Tracking/Benachrichtigung', 2, 'Alle UPS Mails'),
  ('Hermes Domain', 'from_domain', 'myhermes.de', 'Hermes Tracking/Benachrichtigung', 2, 'Alle Hermes Mails'),
  ('DPD Domain', 'from_domain', 'dpd.de', 'DPD Tracking/Benachrichtigung', 2, 'Alle DPD Mails');

-- Weitere System-Mails
INSERT INTO email_ingest_filters (name, type, pattern, reason, priority) VALUES
  ('Noreply Domain', 'from_email', 'noreply@', 'Automatische System-Mail', 1),
  ('No-Reply Domain', 'from_email', 'no-reply@', 'Automatische System-Mail', 1);

-- Kommentar: Diese Filter koennen via SQL editiert werden:
-- UPDATE email_ingest_filters SET enabled = FALSE WHERE name = 'DHL Domain';
-- INSERT INTO email_ingest_filters (name, type, pattern, reason) VALUES ('Custom', 'subject_contains', 'XYZ', 'Custom Filter');

-- =============================================================================
-- Helper Function: Check Email Against Filters
-- =============================================================================

CREATE OR REPLACE FUNCTION check_email_against_filters(
  p_subject TEXT,
  p_from_email TEXT,
  p_body_preview TEXT DEFAULT NULL
) RETURNS TABLE (
  should_drop BOOLEAN,
  filter_id UUID,
  filter_reason TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_from_domain TEXT;
  v_filter RECORD;
  v_match BOOLEAN;
BEGIN
  -- Extract domain from email
  v_from_domain := LOWER(SPLIT_PART(p_from_email, '@', 2));

  -- Check each enabled filter by priority
  FOR v_filter IN
    SELECT * FROM email_ingest_filters
    WHERE enabled = TRUE
    ORDER BY priority DESC, created_at
  LOOP
    v_match := FALSE;

    -- Check filter type
    CASE v_filter.type
      WHEN 'subject_prefix' THEN
        v_match := p_subject ILIKE (v_filter.pattern || '%');

      WHEN 'subject_contains' THEN
        v_match := p_subject ILIKE ('%' || v_filter.pattern || '%');

      WHEN 'subject_regex' THEN
        v_match := p_subject ~ v_filter.pattern;

      WHEN 'from_domain' THEN
        v_match := v_from_domain = LOWER(v_filter.pattern) OR
                   v_from_domain LIKE ('%.' || LOWER(v_filter.pattern));

      WHEN 'from_email' THEN
        v_match := LOWER(p_from_email) LIKE ('%' || LOWER(v_filter.pattern) || '%');

      WHEN 'body_contains' THEN
        v_match := p_body_preview IS NOT NULL AND
                   p_body_preview ILIKE ('%' || v_filter.pattern || '%');
    END CASE;

    -- If match found, return result
    IF v_match AND v_filter.action = 'drop' THEN
      -- Update stats
      UPDATE email_ingest_filters
      SET match_count = match_count + 1,
          last_match_at = NOW(),
          updated_at = NOW()
      WHERE id = v_filter.id;

      RETURN QUERY SELECT TRUE, v_filter.id, v_filter.reason;
      RETURN;
    END IF;
  END LOOP;

  -- No filter matched - don't drop
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT;
END;
$$;

-- Grant execution to service role
GRANT EXECUTE ON FUNCTION check_email_against_filters TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE email_ingest_filters IS 'Konfigurierbare Regeln zum Filtern von Noise-Emails beim Ingest';
COMMENT ON TABLE ignored_emails IS 'Log von ignorierten Emails fuer Debugging und Audit';
COMMENT ON FUNCTION check_email_against_filters IS 'Prueft Email gegen alle aktiven Filter, gibt should_drop zurueck';
