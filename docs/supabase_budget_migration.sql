-- =====================================================
-- BUDGET-SYSTEM - Supabase Migration
-- =====================================================
-- Erstellt: 2026-02-05
-- Zweck: Alle Budget-bezogenen Tabellen fuer das
--         Budgetangebots-System (Cases, Items, Profile,
--         Kalkulation, Outcome-Tracking, Leistungsverzeichnis)
-- Referenz: backend/routes/budget.js, workflows/budgetangebote/01_SPEC.md
-- =====================================================
-- HINWEIS: Idempotent - kann mehrfach ausgefuehrt werden.
--          Verwendet CREATE TABLE IF NOT EXISTS und
--          DROP POLICY IF EXISTS vor CREATE POLICY.
-- =====================================================


-- =====================================================
-- TEIL 1: TRIGGER-FUNKTION (falls noch nicht vorhanden)
-- =====================================================

-- Wiederverwendbare updated_at Trigger-Funktion
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- TEIL 2: BUDGET-KERNTABELLEN
-- =====================================================

-- ---------------------------------------------------------
-- budget_cases: Haupt-Case / Anfrage
-- Ein Case repraesentiert eine Budgetanfrage (z.B. Kunde
-- ruft an und moechte ein Budgetangebot fuer 5 Fenster).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_cases (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    -- ERP-Verknuepfung (optional - bei bestehenden Kunden)
    erp_kunden_code INTEGER,                    -- Referenz auf erp_kunden.code (kein FK wegen Sync-Reihenfolge)
    erp_projekt_code INTEGER,                   -- Referenz auf erp_projekte.code (optional)

    -- Lead-Daten (bei Neukunden ohne ERP-Eintrag)
    lead_name       TEXT,
    lead_telefon    TEXT,
    lead_email      TEXT,

    -- Workflow-Daten
    kanal           TEXT CHECK (kanal IN ('showroom', 'telefon', 'email', 'website')),
    status          TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft', 'calculated', 'sent', 'quoted', 'ordered', 'won', 'lost')),
    assigned_to     UUID,                       -- Zustaendiger Mitarbeiter (auth.users.id)
    notes           TEXT,

    -- Angebotsnummer (wird bei Dokument-Generierung vergeben)
    angebots_nummer TEXT UNIQUE                 -- Format: BA-YYYY-NNNN
);

COMMENT ON TABLE budget_cases IS 'Budgetangebots-Cases: Eine Anfrage = ein Case mit Items, Profil und Kalkulation';

-- Auto-Update Trigger fuer updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_cases_updated_at'
    ) THEN
        CREATE TRIGGER update_budget_cases_updated_at
            BEFORE UPDATE ON budget_cases
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;


-- ---------------------------------------------------------
-- budget_inputs: Eingabe-Dokumente (OCR, Notizen, etc.)
-- Pro Case koennen mehrere Eingabequellen existieren
-- (z.B. ein Aufmassblatt + telefonische Ergaenzung).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_inputs (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_case_id      UUID NOT NULL REFERENCES budget_cases(id) ON DELETE CASCADE,

    -- Quell-Typ
    source_type         TEXT CHECK (source_type IN ('aufmassblatt', 'kundennotiz', 'manuell', 'freitext')),

    -- Rohdaten
    raw_text            TEXT,                   -- Original-Text (manuell eingegeben oder extrahiert)
    raw_ocr             TEXT,                   -- OCR-Ergebnis (bei Aufmassblaettern)

    -- Parsing-Metadaten
    source_unit         TEXT DEFAULT 'mm',      -- Einheit der Masse im Quelldokument
    parsing_confidence  TEXT DEFAULT 'medium',  -- low / medium / high
    parsed_at           TIMESTAMPTZ             -- Zeitpunkt der Verarbeitung
);

COMMENT ON TABLE budget_inputs IS 'Eingabequellen pro Budget-Case (Aufmassblatt, Kundennotiz, etc.)';


-- ---------------------------------------------------------
-- budget_profile: Globales Profil pro Case
-- Definiert Hersteller, System, Verglasung, Farben.
-- Genau ein Profil pro Case (UNIQUE auf budget_case_id).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_profile (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_case_id      UUID UNIQUE NOT NULL REFERENCES budget_cases(id) ON DELETE CASCADE,

    -- Produktkonfiguration
    manufacturer        TEXT DEFAULT 'WERU',
    system              TEXT,                   -- z.B. CALIDO, CASTELLO, IMPREO, AFINO
    glazing             TEXT,                   -- z.B. 2-fach, 3-fach
    color_inside        TEXT DEFAULT 'weiss',
    color_outside       TEXT DEFAULT 'weiss',
    material_class      TEXT DEFAULT 'Kunststoff',

    -- Herkunft der Daten
    inferred            BOOLEAN DEFAULT false,  -- true = automatisch abgeleitet
    manual_override     BOOLEAN DEFAULT false   -- true = manuell vom Benutzer gesetzt
);

COMMENT ON TABLE budget_profile IS 'Globales Produktprofil pro Budget-Case (Hersteller, System, Farben)';


-- ---------------------------------------------------------
-- budget_items: Einzelne Elemente (Fenster, Tueren, etc.)
-- Das Herzstueck: jedes Element mit Typ und Massen.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_items (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_case_id      UUID NOT NULL REFERENCES budget_cases(id) ON DELETE CASCADE,

    -- Element-Beschreibung
    room                TEXT,                   -- Raum-Zuordnung (z.B. "Kueche", "Bad OG")
    element_type        TEXT NOT NULL,          -- z.B. fenster, tuer, hst, haustuer, psk, festfeld
    width_mm            INTEGER NOT NULL,       -- Breite in mm (300-5000)
    height_mm           INTEGER NOT NULL,       -- Hoehe in mm (300-5000)
    qty                 INTEGER DEFAULT 1,      -- Anzahl gleicher Elemente

    -- Parsing-Metadaten
    position_in_source  INTEGER,                -- Position im Quelldokument
    notes               TEXT,
    confidence          TEXT DEFAULT 'medium'   -- low / medium / high
);

COMMENT ON TABLE budget_items IS 'Einzelne Elemente (Fenster, Tueren) pro Budget-Case mit Massen und Typ';


-- ---------------------------------------------------------
-- budget_accessories: Zubehoer pro Element
-- Rollladen, Raffstore, AFB, IFB, Insektenschutz, Plissee.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_accessories (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_item_id      UUID NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,

    -- Rollladen / Raffstore
    shutter             BOOLEAN DEFAULT false,
    shutter_type        TEXT,                   -- z.B. 'rollladen', 'raffstore', 'vorbaurollladen'
    shutter_electric    BOOLEAN DEFAULT false,
    motor_qty           INTEGER DEFAULT 0,

    -- Fensterbank
    afb                 BOOLEAN DEFAULT false,  -- Aussen-Fensterbank
    ifb                 BOOLEAN DEFAULT false,  -- Innen-Fensterbank

    -- Zusatz
    insect              BOOLEAN DEFAULT false,  -- Insektenschutz
    plissee             BOOLEAN DEFAULT false   -- Plissee/Sonnenschutz
);

COMMENT ON TABLE budget_accessories IS 'Zubehoer pro Budget-Element (Rollladen, Fensterbank, Insektenschutz)';


-- ---------------------------------------------------------
-- budget_results: Kalkulationsergebnisse
-- Pro Case koennen mehrere Kalkulationen existieren
-- (z.B. nach Aenderung der Items wird neu kalkuliert).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_results (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_case_id      UUID NOT NULL REFERENCES budget_cases(id) ON DELETE CASCADE,

    -- Zeitpunkt
    calculated_at       TIMESTAMPTZ DEFAULT now(),

    -- Ergebnis
    net_total           NUMERIC(10,2),          -- Netto-Gesamtpreis
    vat_rate            NUMERIC(5,2) DEFAULT 19.00,
    gross_total         NUMERIC(10,2),          -- Brutto-Gesamtpreis
    gross_rounded_50    NUMERIC(10,2),          -- Brutto gerundet auf 50er

    -- Bandbreite
    range_low           NUMERIC(10,2),          -- Untere Bandbreite
    range_high          NUMERIC(10,2),          -- Obere Bandbreite

    -- Metadaten
    assumptions_json    JSONB,                  -- Annahmen und Parameter der Kalkulation
    model_version       TEXT                    -- Version des Kalkulationsmodells
);

COMMENT ON TABLE budget_results IS 'Kalkulationsergebnisse pro Budget-Case (Netto, Brutto, Bandbreiten)';


-- ---------------------------------------------------------
-- budget_outcomes: Ergebnis-Tracking (gewonnen/verloren)
-- Genau ein Outcome pro Case (UNIQUE auf budget_case_id).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_outcomes (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_case_id      UUID UNIQUE NOT NULL REFERENCES budget_cases(id) ON DELETE CASCADE,

    -- Konvertierung
    converted_to_quote  BOOLEAN DEFAULT false,
    quote_number        TEXT,                   -- Angebots-Nummer aus ERP
    converted_to_order  BOOLEAN DEFAULT false,
    order_number        TEXT,                   -- Auftrags-Nummer aus ERP

    -- Finanzielles Ergebnis
    final_value         NUMERIC(10,2),          -- Tatsaechlicher Auftragswert
    deviation_percent   NUMERIC(5,2),           -- Abweichung Budget vs. Angebot in %

    -- Lost-Analyse
    competitor_lost_to  TEXT,                   -- An welchen Wettbewerber verloren
    lost_reason         TEXT,                   -- Grund fuer Verlust

    -- Datum
    outcome_date        DATE
);

COMMENT ON TABLE budget_outcomes IS 'Ergebnis-Tracking pro Budget-Case (Konvertierung, Abweichung, Lost-Analyse)';


-- =====================================================
-- TEIL 3: ERP-POSITIONS-TABELLEN (fuer Sync)
-- =====================================================

-- ---------------------------------------------------------
-- erp_rechnungs_positionen: Rechnungspositionen aus ERP
-- Wird vom Sync-Script befuellt (sync-positions-to-supabase.js)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_rechnungs_positionen (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rechnung_code       INTEGER NOT NULL,       -- FK auf erp_rechnungen.code (logisch, kein DB-FK)
    rechnung_nummer     TEXT,
    pos_nr              TEXT,
    bezeichnung         TEXT,
    langtext            TEXT,
    anzahl              NUMERIC(10,2),
    einz_preis          NUMERIC(12,2),
    ges_preis           NUMERIC(12,2),
    synced_at           TIMESTAMPTZ DEFAULT now(),

    UNIQUE(rechnung_code, pos_nr)
);

COMMENT ON TABLE erp_rechnungs_positionen IS 'Rechnungspositionen aus Work4All ERP (via Sync-Script)';


-- ---------------------------------------------------------
-- erp_angebots_positionen: Angebotspositionen aus ERP
-- Gleiche Struktur wie erp_rechnungs_positionen
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_angebots_positionen (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    angebot_code        INTEGER NOT NULL,       -- FK auf erp_angebote.code (logisch, kein DB-FK)
    angebot_nummer      TEXT,
    pos_nr              TEXT,
    bezeichnung         TEXT,
    langtext            TEXT,
    anzahl              NUMERIC(10,2),
    einz_preis          NUMERIC(12,2),
    ges_preis           NUMERIC(12,2),
    synced_at           TIMESTAMPTZ DEFAULT now(),

    UNIQUE(angebot_code, pos_nr)
);

COMMENT ON TABLE erp_angebots_positionen IS 'Angebotspositionen aus Work4All ERP (via Sync-Script)';


-- =====================================================
-- TEIL 4: LEISTUNGSVERZEICHNIS (Service-Katalog)
-- =====================================================

-- ---------------------------------------------------------
-- leistungsverzeichnis: Aus historischen Daten aufgebauter
-- Service-Katalog mit Durchschnittspreisen, Min/Max und
-- Beispiel-Anzahl. Wird vom Backtest-System befuellt.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS leistungsverzeichnis (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Kategorisierung
    kategorie               TEXT NOT NULL,       -- fenster, tuer, hst, haustuer, psk, rollladen, montage, etc.
    bezeichnung             TEXT NOT NULL,
    beschreibung            TEXT,

    -- Einheit und Preise
    einheit                 TEXT DEFAULT 'Stk',
    avg_preis               NUMERIC(10,2),
    min_preis               NUMERIC(10,2),
    max_preis               NUMERIC(10,2),

    -- Statistik
    sample_count            INTEGER DEFAULT 0,

    -- Metadaten
    letzte_aktualisierung   TIMESTAMPTZ DEFAULT now(),
    meta                    JSONB,              -- Zusaetzliche Eigenschaften (Masse, System, Farbe, etc.)

    UNIQUE(kategorie, bezeichnung)
);

COMMENT ON TABLE leistungsverzeichnis IS 'Leistungsverzeichnis / Service-Katalog aus historischen ERP-Daten (Backtest-System)';


-- =====================================================
-- TEIL 5: INDIZES
-- =====================================================

-- budget_cases
CREATE INDEX IF NOT EXISTS idx_budget_cases_status
    ON budget_cases(status);
CREATE INDEX IF NOT EXISTS idx_budget_cases_kanal
    ON budget_cases(kanal);
CREATE INDEX IF NOT EXISTS idx_budget_cases_erp_kunden_code
    ON budget_cases(erp_kunden_code);
CREATE INDEX IF NOT EXISTS idx_budget_cases_erp_projekt_code
    ON budget_cases(erp_projekt_code);
CREATE INDEX IF NOT EXISTS idx_budget_cases_assigned_to
    ON budget_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_budget_cases_created_at
    ON budget_cases(created_at DESC);

-- budget_inputs
CREATE INDEX IF NOT EXISTS idx_budget_inputs_case
    ON budget_inputs(budget_case_id);
CREATE INDEX IF NOT EXISTS idx_budget_inputs_source_type
    ON budget_inputs(source_type);

-- budget_profile (budget_case_id ist bereits UNIQUE, also automatisch indiziert)

-- budget_items
CREATE INDEX IF NOT EXISTS idx_budget_items_case
    ON budget_items(budget_case_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_element_type
    ON budget_items(element_type);

-- budget_accessories
CREATE INDEX IF NOT EXISTS idx_budget_accessories_item
    ON budget_accessories(budget_item_id);

-- budget_results
CREATE INDEX IF NOT EXISTS idx_budget_results_case
    ON budget_results(budget_case_id);
CREATE INDEX IF NOT EXISTS idx_budget_results_calculated_at
    ON budget_results(calculated_at DESC);

-- budget_outcomes (budget_case_id ist bereits UNIQUE, also automatisch indiziert)

-- erp_rechnungs_positionen
CREATE INDEX IF NOT EXISTS idx_erp_rechnungs_positionen_rechnung
    ON erp_rechnungs_positionen(rechnung_code);

-- erp_angebots_positionen
CREATE INDEX IF NOT EXISTS idx_erp_angebots_positionen_angebot
    ON erp_angebots_positionen(angebot_code);

-- leistungsverzeichnis
CREATE INDEX IF NOT EXISTS idx_leistungsverzeichnis_kategorie
    ON leistungsverzeichnis(kategorie);


-- =====================================================
-- TEIL 6: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- RLS aktivieren
ALTER TABLE budget_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_rechnungs_positionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_angebots_positionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE leistungsverzeichnis ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------
-- Policies: Authenticated users = SELECT
--           Service role = alle Operationen
-- ---------------------------------------------------------
-- Muster: DROP IF EXISTS + CREATE fuer Idempotenz

-- === budget_cases ===
DROP POLICY IF EXISTS "authenticated_select_budget_cases" ON budget_cases;
CREATE POLICY "authenticated_select_budget_cases"
    ON budget_cases FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_cases" ON budget_cases;
CREATE POLICY "authenticated_insert_budget_cases"
    ON budget_cases FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_budget_cases" ON budget_cases;
CREATE POLICY "authenticated_update_budget_cases"
    ON budget_cases FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_budget_cases" ON budget_cases;
CREATE POLICY "service_role_all_budget_cases"
    ON budget_cases FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === budget_inputs ===
DROP POLICY IF EXISTS "authenticated_select_budget_inputs" ON budget_inputs;
CREATE POLICY "authenticated_select_budget_inputs"
    ON budget_inputs FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_inputs" ON budget_inputs;
CREATE POLICY "authenticated_insert_budget_inputs"
    ON budget_inputs FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_budget_inputs" ON budget_inputs;
CREATE POLICY "authenticated_update_budget_inputs"
    ON budget_inputs FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_budget_inputs" ON budget_inputs;
CREATE POLICY "service_role_all_budget_inputs"
    ON budget_inputs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === budget_profile ===
DROP POLICY IF EXISTS "authenticated_select_budget_profile" ON budget_profile;
CREATE POLICY "authenticated_select_budget_profile"
    ON budget_profile FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_profile" ON budget_profile;
CREATE POLICY "authenticated_insert_budget_profile"
    ON budget_profile FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_budget_profile" ON budget_profile;
CREATE POLICY "authenticated_update_budget_profile"
    ON budget_profile FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_budget_profile" ON budget_profile;
CREATE POLICY "service_role_all_budget_profile"
    ON budget_profile FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === budget_items ===
DROP POLICY IF EXISTS "authenticated_select_budget_items" ON budget_items;
CREATE POLICY "authenticated_select_budget_items"
    ON budget_items FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_items" ON budget_items;
CREATE POLICY "authenticated_insert_budget_items"
    ON budget_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_budget_items" ON budget_items;
CREATE POLICY "authenticated_update_budget_items"
    ON budget_items FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_budget_items" ON budget_items;
CREATE POLICY "service_role_all_budget_items"
    ON budget_items FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === budget_accessories ===
DROP POLICY IF EXISTS "authenticated_select_budget_accessories" ON budget_accessories;
CREATE POLICY "authenticated_select_budget_accessories"
    ON budget_accessories FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_accessories" ON budget_accessories;
CREATE POLICY "authenticated_insert_budget_accessories"
    ON budget_accessories FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_budget_accessories" ON budget_accessories;
CREATE POLICY "authenticated_update_budget_accessories"
    ON budget_accessories FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_budget_accessories" ON budget_accessories;
CREATE POLICY "service_role_all_budget_accessories"
    ON budget_accessories FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === budget_results ===
DROP POLICY IF EXISTS "authenticated_select_budget_results" ON budget_results;
CREATE POLICY "authenticated_select_budget_results"
    ON budget_results FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_results" ON budget_results;
CREATE POLICY "authenticated_insert_budget_results"
    ON budget_results FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_budget_results" ON budget_results;
CREATE POLICY "service_role_all_budget_results"
    ON budget_results FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === budget_outcomes ===
DROP POLICY IF EXISTS "authenticated_select_budget_outcomes" ON budget_outcomes;
CREATE POLICY "authenticated_select_budget_outcomes"
    ON budget_outcomes FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_insert_budget_outcomes" ON budget_outcomes;
CREATE POLICY "authenticated_insert_budget_outcomes"
    ON budget_outcomes FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_budget_outcomes" ON budget_outcomes;
CREATE POLICY "authenticated_update_budget_outcomes"
    ON budget_outcomes FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_budget_outcomes" ON budget_outcomes;
CREATE POLICY "service_role_all_budget_outcomes"
    ON budget_outcomes FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === erp_rechnungs_positionen ===
DROP POLICY IF EXISTS "authenticated_select_erp_rechnungs_positionen" ON erp_rechnungs_positionen;
CREATE POLICY "authenticated_select_erp_rechnungs_positionen"
    ON erp_rechnungs_positionen FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_erp_rechnungs_positionen" ON erp_rechnungs_positionen;
CREATE POLICY "service_role_all_erp_rechnungs_positionen"
    ON erp_rechnungs_positionen FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === erp_angebots_positionen ===
DROP POLICY IF EXISTS "authenticated_select_erp_angebots_positionen" ON erp_angebots_positionen;
CREATE POLICY "authenticated_select_erp_angebots_positionen"
    ON erp_angebots_positionen FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_erp_angebots_positionen" ON erp_angebots_positionen;
CREATE POLICY "service_role_all_erp_angebots_positionen"
    ON erp_angebots_positionen FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- === leistungsverzeichnis ===
DROP POLICY IF EXISTS "authenticated_select_leistungsverzeichnis" ON leistungsverzeichnis;
CREATE POLICY "authenticated_select_leistungsverzeichnis"
    ON leistungsverzeichnis FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "service_role_all_leistungsverzeichnis" ON leistungsverzeichnis;
CREATE POLICY "service_role_all_leistungsverzeichnis"
    ON leistungsverzeichnis FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- =====================================================
-- FERTIG!
-- =====================================================
-- Tabellen erstellt: 10
--   1. budget_cases          - Haupt-Case / Anfrage
--   2. budget_inputs         - Eingabe-Dokumente
--   3. budget_profile        - Globales Profil pro Case
--   4. budget_items          - Einzelne Elemente
--   5. budget_accessories    - Zubehoer pro Element
--   6. budget_results        - Kalkulationsergebnisse
--   7. budget_outcomes       - Ergebnis-Tracking
--   8. erp_rechnungs_positionen - Rechnungspositionen (Sync)
--   9. erp_angebots_positionen  - Angebotspositionen (Sync)
--  10. leistungsverzeichnis     - Service-Katalog
--
-- Indizes: 14
-- RLS-Policies: 30 (SELECT/INSERT/UPDATE fuer auth, ALL fuer service_role)
-- Trigger: 1 (updated_at auf budget_cases)
-- =====================================================
