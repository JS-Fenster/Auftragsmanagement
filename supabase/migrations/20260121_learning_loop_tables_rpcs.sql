-- =============================================================================
-- Migration: Learning Loop Infrastructure
-- Date: 2026-01-21
-- Author: Claude Code
-- Ticket: Fix Learning Loop - fehlende document_features Tabelle + RPCs
-- =============================================================================
--
-- CREATES:
-- 1. document_features table - stores extracted features per document
-- 2. extract_document_features() RPC - extracts features from a document
-- 3. add_evidence_to_cluster() RPC - adds document to evidence cluster
--
-- IDEMPOTENT: Uses IF NOT EXISTS / CREATE OR REPLACE
-- =============================================================================

-- =============================================================================
-- 1. DOCUMENT_FEATURES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS document_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    feature_value TEXT,
    feature_numeric NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, feature_key)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_document_features_doc_id
    ON document_features(document_id);
CREATE INDEX IF NOT EXISTS idx_document_features_key
    ON document_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_document_features_key_value
    ON document_features(feature_key, feature_value);

COMMENT ON TABLE document_features IS 'Extracted features from documents for learning loop clustering';

-- =============================================================================
-- 2. RULE_EVIDENCE_CLUSTERS TABLE (ensure it exists with correct schema)
-- =============================================================================

CREATE TABLE IF NOT EXISTS rule_evidence_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cluster_key TEXT NOT NULL UNIQUE,
    target_email_kategorie TEXT,
    target_kategorie TEXT,
    evidence_count INTEGER DEFAULT 0,
    evidence_document_ids UUID[] DEFAULT '{}',
    status TEXT DEFAULT 'collecting' CHECK (status IN ('collecting', 'pending', 'ready', 'rule_generated')),
    generated_rule_id UUID
);

CREATE INDEX IF NOT EXISTS idx_rule_evidence_clusters_status
    ON rule_evidence_clusters(status);
CREATE INDEX IF NOT EXISTS idx_rule_evidence_clusters_key
    ON rule_evidence_clusters(cluster_key);

COMMENT ON TABLE rule_evidence_clusters IS 'Clusters of similar corrections for rule generation';

-- =============================================================================
-- 3. CLASSIFICATION_RULES TABLE (ensure it exists with correct schema)
-- =============================================================================

CREATE TABLE IF NOT EXISTS classification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL DEFAULT '{}',
    target_email_kategorie TEXT,
    target_kategorie TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled', 'paused')),
    activated_by TEXT,
    activated_at TIMESTAMPTZ,
    paused_reason TEXT,
    evidence_count INTEGER DEFAULT 0,
    evidence_document_ids UUID[] DEFAULT '{}',
    backtest_matches INTEGER DEFAULT 0,
    precision_estimate NUMERIC DEFAULT 0,
    validation_metrics JSONB,
    misfire_count INTEGER DEFAULT 0,
    last_misfire_at TIMESTAMPTZ,
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_classification_rules_status
    ON classification_rules(status);

COMMENT ON TABLE classification_rules IS 'Auto-generated classification rules from learning loop';

-- =============================================================================
-- 4. EXTRACT_DOCUMENT_FEATURES RPC
-- =============================================================================
-- Extracts features from a document and upserts into document_features table
-- Returns: number of features extracted

CREATE OR REPLACE FUNCTION extract_document_features(doc_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    doc RECORD;
    feature_count INTEGER := 0;
    email_domain TEXT;
    subject_words TEXT[];
    word TEXT;
BEGIN
    -- Get document data
    SELECT
        id,
        email_von_email,
        email_von_name,
        email_betreff,
        email_body_text,
        email_postfach,
        email_hat_anhaenge,
        email_anhaenge_count,
        kategorie,
        kategorie_manual,
        email_kategorie,
        email_kategorie_manual
    INTO doc
    FROM documents
    WHERE id = doc_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document not found: %', doc_id;
    END IF;

    -- Clear existing features for this document (upsert approach)
    DELETE FROM document_features WHERE document_id = doc_id;

    -- Feature 1: Email Domain
    IF doc.email_von_email IS NOT NULL THEN
        email_domain := lower(split_part(doc.email_von_email, '@', 2));
        IF email_domain != '' THEN
            INSERT INTO document_features (document_id, feature_key, feature_value)
            VALUES (doc_id, 'email_domain', email_domain);
            feature_count := feature_count + 1;
        END IF;
    END IF;

    -- Feature 2: Email From (full address, lowercased)
    IF doc.email_von_email IS NOT NULL THEN
        INSERT INTO document_features (document_id, feature_key, feature_value)
        VALUES (doc_id, 'email_from', lower(doc.email_von_email));
        feature_count := feature_count + 1;
    END IF;

    -- Feature 3: Email Postfach
    IF doc.email_postfach IS NOT NULL THEN
        INSERT INTO document_features (document_id, feature_key, feature_value)
        VALUES (doc_id, 'email_postfach', doc.email_postfach);
        feature_count := feature_count + 1;
    END IF;

    -- Feature 4: Has Attachments
    INSERT INTO document_features (document_id, feature_key, feature_value, feature_numeric)
    VALUES (doc_id, 'has_attachments',
            CASE WHEN doc.email_hat_anhaenge THEN 'true' ELSE 'false' END,
            CASE WHEN doc.email_hat_anhaenge THEN 1 ELSE 0 END);
    feature_count := feature_count + 1;

    -- Feature 5: Attachment Count
    IF doc.email_anhaenge_count IS NOT NULL THEN
        INSERT INTO document_features (document_id, feature_key, feature_numeric)
        VALUES (doc_id, 'attachment_count', doc.email_anhaenge_count);
        feature_count := feature_count + 1;
    END IF;

    -- Feature 6-N: Subject Keywords (top significant words)
    IF doc.email_betreff IS NOT NULL THEN
        -- Extract words > 3 chars, lowercase, alphanumeric only
        subject_words := ARRAY(
            SELECT DISTINCT lower(word)
            FROM unnest(regexp_split_to_array(
                regexp_replace(doc.email_betreff, '[^a-zA-Z0-9äöüÄÖÜß\s]', ' ', 'g'),
                '\s+'
            )) AS word
            WHERE length(word) > 3
            LIMIT 10
        );

        FOREACH word IN ARRAY subject_words LOOP
            INSERT INTO document_features (document_id, feature_key, feature_value)
            VALUES (doc_id, 'subject_word', word)
            ON CONFLICT (document_id, feature_key) DO NOTHING;
            feature_count := feature_count + 1;
        END LOOP;

        -- Store full subject (normalized)
        INSERT INTO document_features (document_id, feature_key, feature_value)
        VALUES (doc_id, 'subject_normalized', lower(trim(doc.email_betreff)));
        feature_count := feature_count + 1;
    END IF;

    -- Feature: Original kategorie (before correction)
    IF doc.kategorie IS NOT NULL THEN
        INSERT INTO document_features (document_id, feature_key, feature_value)
        VALUES (doc_id, 'original_kategorie', doc.kategorie);
        feature_count := feature_count + 1;
    END IF;

    -- Feature: Original email_kategorie (before correction)
    IF doc.email_kategorie IS NOT NULL THEN
        INSERT INTO document_features (document_id, feature_key, feature_value)
        VALUES (doc_id, 'original_email_kategorie', doc.email_kategorie);
        feature_count := feature_count + 1;
    END IF;

    RETURN feature_count;
END;
$$;

COMMENT ON FUNCTION extract_document_features(UUID) IS
    'Extracts classification-relevant features from a document into document_features table';

-- =============================================================================
-- 5. ADD_EVIDENCE_TO_CLUSTER RPC
-- =============================================================================
-- Adds a corrected document to an evidence cluster (creates cluster if needed)
-- Returns: cluster_id

CREATE OR REPLACE FUNCTION add_evidence_to_cluster(
    doc_id UUID,
    target_email_kat TEXT DEFAULT NULL,
    target_kat TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cluster_key_val TEXT;
    email_domain_val TEXT;
    cluster_id_val UUID;
    current_count INTEGER;
    min_evidence_threshold INTEGER := 5;
BEGIN
    -- Build cluster key from: email_domain + target categories
    SELECT feature_value INTO email_domain_val
    FROM document_features
    WHERE document_id = doc_id AND feature_key = 'email_domain'
    LIMIT 1;

    -- If no email domain, use 'unknown'
    IF email_domain_val IS NULL THEN
        email_domain_val := 'unknown';
    END IF;

    -- Build cluster key: domain:email_kat:dok_kat
    cluster_key_val := email_domain_val || ':' ||
                       COALESCE(target_email_kat, '_') || ':' ||
                       COALESCE(target_kat, '_');

    -- Upsert cluster
    INSERT INTO rule_evidence_clusters (
        cluster_key,
        target_email_kategorie,
        target_kategorie,
        evidence_count,
        evidence_document_ids,
        status
    )
    VALUES (
        cluster_key_val,
        target_email_kat,
        target_kat,
        1,
        ARRAY[doc_id],
        'collecting'
    )
    ON CONFLICT (cluster_key) DO UPDATE SET
        evidence_count = rule_evidence_clusters.evidence_count + 1,
        evidence_document_ids = array_append(
            -- Prevent duplicates
            array_remove(rule_evidence_clusters.evidence_document_ids, doc_id),
            doc_id
        ),
        updated_at = NOW()
    RETURNING id, evidence_count INTO cluster_id_val, current_count;

    -- Update status based on evidence count
    IF current_count >= min_evidence_threshold THEN
        UPDATE rule_evidence_clusters
        SET status = 'ready'
        WHERE id = cluster_id_val AND status = 'collecting';
    ELSIF current_count >= 3 THEN
        UPDATE rule_evidence_clusters
        SET status = 'pending'
        WHERE id = cluster_id_val AND status = 'collecting';
    END IF;

    RETURN cluster_id_val;
END;
$$;

COMMENT ON FUNCTION add_evidence_to_cluster(UUID, TEXT, TEXT) IS
    'Adds a corrected document to an evidence cluster, creating the cluster if needed';

-- =============================================================================
-- 6. APP_CONFIG: Ensure learning settings exist
-- =============================================================================

INSERT INTO app_config (key, value, description)
VALUES
    ('rules_activation_mode', 'manual', 'Rule activation mode: manual or auto'),
    ('rules_min_evidence', '5', 'Minimum evidence count for rule generation'),
    ('rules_min_backtest_matches', '20', 'Minimum backtest matches for auto-activation'),
    ('rules_min_precision', '0.95', 'Minimum precision for auto-activation')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================
-- SELECT count(*) FROM document_features;
-- SELECT count(*) FROM rule_evidence_clusters;
-- SELECT * FROM pg_proc WHERE proname = 'extract_document_features';
-- SELECT * FROM pg_proc WHERE proname = 'add_evidence_to_cluster';
-- =============================================================================
