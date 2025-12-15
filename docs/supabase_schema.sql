-- =====================================================
-- AUFTRAGSMANAGEMENT - Supabase Schema
-- =====================================================
-- Erstellt: 2025-12-15
-- Zweck: ERP-Cache + eigene Workflow-Daten
-- =====================================================

-- =====================================================
-- TEIL 1: ERP-CACHE TABELLEN (readonly, wird gesynct)
-- =====================================================

-- Kunden aus ERP (dbo.Kunden)
-- ERP-Mapping: Straße -> strasse, E-Mail -> email
CREATE TABLE IF NOT EXISTS erp_kunden (
    code INTEGER PRIMARY KEY,           -- ERP: Kunden.Code
    firma1 VARCHAR(100),                -- ERP: Kunden.Firma1
    firma2 VARCHAR(100),                -- ERP: Kunden.Firma2
    firma3 VARCHAR(100),                -- ERP: Kunden.Firma3
    name VARCHAR(100),                  -- ERP: Kunden.Name
    strasse VARCHAR(100),               -- ERP: Kunden.Straße (Umlaut!)
    plz VARCHAR(10),                    -- ERP: Kunden.Plz
    ort VARCHAR(100),                   -- ERP: Kunden.Ort
    telefon VARCHAR(50),                -- ERP: Kunden.Telefon
    mobil VARCHAR(50),                  -- ERP: Kunden.Mobil
    email VARCHAR(100),                 -- ERP: Kunden.[E-Mail] (Bindestrich!)
    -- Sync-Metadaten
    erp_insert_time TIMESTAMP,          -- ERP: InsertTime
    erp_update_time TIMESTAMP,          -- ERP: UpdateTime
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Projekte aus ERP (dbo.Projekte)
CREATE TABLE IF NOT EXISTS erp_projekte (
    code INTEGER PRIMARY KEY,           -- ERP: Projekte.Code
    nummer VARCHAR(20),                 -- ERP: Projekte.Nummer (z.B. P250593)
    name TEXT,                          -- ERP: Projekte.Name
    kunden_code INTEGER,                -- ERP: Projekte.KundenCode -> erp_kunden.code
    datum DATE,                         -- ERP: Projekte.Datum
    projekt_status INTEGER,             -- ERP: Projekte.ProjektStatus (Projekt-GRUPPE, nicht Workflow!)
    notiz VARCHAR(50),                  -- ERP: Projekte.Notiz (DKF, REP, EA, HT, etc.)
    -- Sync-Metadaten
    erp_insert_time TIMESTAMP,          -- ERP: InsertTime
    erp_update_time TIMESTAMP,          -- ERP: UpdateTime
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Angebote/Auftraege aus ERP (dbo.Angebot)
-- WICHTIG: Ein Auftrag ist ein Angebot mit gesetztem auftrags_datum!
CREATE TABLE IF NOT EXISTS erp_angebote (
    code INTEGER PRIMARY KEY,           -- ERP: Angebot.Code
    nummer INTEGER,                     -- ERP: Angebot.Nummer (Angebotsnummer)
    datum DATE,                         -- ERP: Angebot.Datum (Angebotsdatum)
    projekt_code INTEGER,               -- ERP: Angebot.ProjektCode -> erp_projekte.code
    kunden_code INTEGER,                -- ERP: Angebot.KundenCode -> erp_kunden.code
    wert DECIMAL(12,2),                 -- ERP: Angebot.Wert (Netto)
    -- Auftrags-Felder (NULL = nur Angebot, gesetzt = ist Auftrag!)
    auftrags_datum DATE,                -- ERP: Angebot.AuftragsDatum
    auftrags_nummer INTEGER,            -- ERP: Angebot.AuftragsNummer
    -- Sync-Metadaten
    erp_insert_time TIMESTAMP,          -- ERP: InsertTime
    erp_update_time TIMESTAMP,          -- ERP: UpdateTime
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Rechnungen aus ERP (dbo.Rechnung)
CREATE TABLE IF NOT EXISTS erp_rechnungen (
    code INTEGER PRIMARY KEY,           -- ERP: Rechnung.Code
    nummer INTEGER,                     -- ERP: Rechnung.Nummer
    datum DATE,                         -- ERP: Rechnung.Datum
    projekt_code INTEGER,               -- ERP: Rechnung.ProjektCode -> erp_projekte.code
    kunden_code INTEGER,                -- ERP: Rechnung.KundenCode -> erp_kunden.code
    wert DECIMAL(12,2),                 -- ERP: Rechnung.Wert (Netto)
    bruttowert DECIMAL(12,2),           -- ERP: Rechnung.Bruttowert
    zahlbar_bis DATE,                   -- ERP: Rechnung.Zahlbarbis
    zahlungsfrist INTEGER,              -- ERP: Rechnung.Zahlungsfrist (Tage)
    -- Sync-Metadaten
    erp_insert_time TIMESTAMP,          -- ERP: InsertTime
    erp_update_time TIMESTAMP,          -- ERP: UpdateTime
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Zahlungsstatus aus ERP (dbo.RA = Rechnungs-Ausgleich)
CREATE TABLE IF NOT EXISTS erp_ra (
    code INTEGER PRIMARY KEY,           -- ERP: RA.Code
    r_code INTEGER,                     -- ERP: RA.RCode -> erp_rechnungen.code
    r_nummer INTEGER,                   -- ERP: RA.RNummer
    r_betrag DECIMAL(12,2),             -- ERP: RA.RBetrag (Rechnungsbetrag)
    bez_summe DECIMAL(12,2),            -- ERP: RA.BezSumme (bereits bezahlt)
    mahnstufe INTEGER,                  -- ERP: RA.Mahnstuffe (mit ff!)
    faellig_datum DATE,                 -- ERP: RA.FälligDatum (Umlaut!)
    -- Sync-Metadaten
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Lieferanten aus ERP (dbo.Lieferanten) - optional, fuer Bestellungen
CREATE TABLE IF NOT EXISTS erp_lieferanten (
    code INTEGER PRIMARY KEY,           -- ERP: Lieferanten.Code
    firma1 VARCHAR(100),                -- ERP: Lieferanten.Firma1
    firma2 VARCHAR(100),                -- ERP: Lieferanten.Firma2
    name VARCHAR(100),                  -- ERP: Lieferanten.Name
    strasse VARCHAR(100),               -- ERP: Lieferanten.Straße
    plz VARCHAR(10),                    -- ERP: Lieferanten.Plz
    ort VARCHAR(100),                   -- ERP: Lieferanten.Ort
    telefon VARCHAR(50),                -- ERP: Lieferanten.Telefon
    email VARCHAR(100),                 -- ERP: Lieferanten.[E-Mail]
    -- Sync-Metadaten
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Bestellungen aus ERP (dbo.Bestellung)
CREATE TABLE IF NOT EXISTS erp_bestellungen (
    code INTEGER PRIMARY KEY,           -- ERP: Bestellung.Code
    nummer INTEGER,                     -- ERP: Bestellung.Nummer
    datum DATE,                         -- ERP: Bestellung.Datum
    projekt_code INTEGER,               -- ERP: Bestellung.ProjektCode -> erp_projekte.code
    lieferant_code INTEGER,             -- ERP: Bestellung.SDObjMemberCode -> erp_lieferanten.code
    wert DECIMAL(12,2),                 -- ERP: Bestellung.Wert
    -- Sync-Metadaten
    erp_insert_time TIMESTAMP,          -- ERP: InsertTime
    erp_update_time TIMESTAMP,          -- ERP: UpdateTime
    synced_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TEIL 2: EIGENE TABELLEN (read/write, unsere Daten)
-- =====================================================

-- Auftrags-Workflow-Status (KERN des Systems!)
-- Hier tracken wir, was das ERP NICHT kann: Workflow-Status
CREATE TABLE IF NOT EXISTS auftrag_status (
    id SERIAL PRIMARY KEY,
    projekt_code INTEGER NOT NULL,      -- FK zu erp_projekte.code
    angebot_code INTEGER,               -- FK zu erp_angebote.code (optional)

    -- Workflow-Status
    status VARCHAR(50) NOT NULL DEFAULT 'angebot',
    -- Moegliche Werte:
    -- 'angebot'            - Angebot erstellt, noch kein Auftrag
    -- 'auftrag'            - Kunde hat beauftragt
    -- 'material_bestellt'  - Material bei Lieferanten bestellt
    -- 'material_da'        - Material eingetroffen
    -- 'montage_geplant'    - Montagetermin steht
    -- 'in_montage'         - Montage laeuft
    -- 'montage_fertig'     - Montage abgeschlossen
    -- 'abnahme_ausstehend' - Warte auf Kundenabnahme
    -- 'abnahme_erfolgt'    - Kunde hat abgenommen
    -- 'rechnung_gestellt'  - Rechnung raus
    -- 'bezahlt'            - Rechnung bezahlt
    -- 'abgeschlossen'      - Projekt komplett fertig

    -- Termine
    montage_geplant DATE,
    montage_start TIMESTAMP,
    montage_ende TIMESTAMP,
    abnahme_datum TIMESTAMP,

    -- Notizen
    notiz TEXT,

    -- Metadaten
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Checklisten pro Auftrag
CREATE TABLE IF NOT EXISTS auftrag_checkliste (
    id SERIAL PRIMARY KEY,
    auftrag_status_id INTEGER REFERENCES auftrag_status(id) ON DELETE CASCADE,
    titel VARCHAR(200) NOT NULL,
    erledigt BOOLEAN DEFAULT FALSE,
    erledigt_am TIMESTAMP,
    erledigt_von UUID REFERENCES auth.users(id),
    reihenfolge INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fotos/Dokumente pro Auftrag (Supabase Storage)
CREATE TABLE IF NOT EXISTS auftrag_fotos (
    id SERIAL PRIMARY KEY,
    auftrag_status_id INTEGER REFERENCES auftrag_status(id) ON DELETE CASCADE,
    datei_pfad TEXT NOT NULL,           -- Supabase Storage Pfad
    datei_name VARCHAR(255),
    beschreibung TEXT,
    typ VARCHAR(50),                    -- 'vorher', 'nachher', 'mangel', 'abnahme', 'sonstiges'
    aufgenommen_am TIMESTAMP,
    hochgeladen_von UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Aenderungs-Historie (Audit-Log)
CREATE TABLE IF NOT EXISTS auftrag_historie (
    id SERIAL PRIMARY KEY,
    auftrag_status_id INTEGER REFERENCES auftrag_status(id) ON DELETE CASCADE,
    aktion VARCHAR(100) NOT NULL,       -- 'status_geaendert', 'termin_gesetzt', 'notiz_hinzugefuegt', etc.
    feld VARCHAR(100),                  -- Welches Feld wurde geaendert
    alter_wert TEXT,
    neuer_wert TEXT,
    geaendert_von UUID REFERENCES auth.users(id),
    geaendert_am TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TEIL 3: INDIZES (Performance)
-- =====================================================

-- ERP-Cache Indizes
CREATE INDEX IF NOT EXISTS idx_erp_projekte_kunden ON erp_projekte(kunden_code);
CREATE INDEX IF NOT EXISTS idx_erp_projekte_datum ON erp_projekte(datum);
CREATE INDEX IF NOT EXISTS idx_erp_projekte_notiz ON erp_projekte(notiz);

CREATE INDEX IF NOT EXISTS idx_erp_angebote_projekt ON erp_angebote(projekt_code);
CREATE INDEX IF NOT EXISTS idx_erp_angebote_kunde ON erp_angebote(kunden_code);
CREATE INDEX IF NOT EXISTS idx_erp_angebote_auftrags_datum ON erp_angebote(auftrags_datum);

CREATE INDEX IF NOT EXISTS idx_erp_rechnungen_projekt ON erp_rechnungen(projekt_code);
CREATE INDEX IF NOT EXISTS idx_erp_rechnungen_kunde ON erp_rechnungen(kunden_code);

CREATE INDEX IF NOT EXISTS idx_erp_ra_rechnung ON erp_ra(r_code);

CREATE INDEX IF NOT EXISTS idx_erp_bestellungen_projekt ON erp_bestellungen(projekt_code);
CREATE INDEX IF NOT EXISTS idx_erp_bestellungen_lieferant ON erp_bestellungen(lieferant_code);

-- Eigene Tabellen Indizes
CREATE INDEX IF NOT EXISTS idx_auftrag_status_projekt ON auftrag_status(projekt_code);
CREATE INDEX IF NOT EXISTS idx_auftrag_status_angebot ON auftrag_status(angebot_code);
CREATE INDEX IF NOT EXISTS idx_auftrag_status_status ON auftrag_status(status);

CREATE INDEX IF NOT EXISTS idx_auftrag_checkliste_status ON auftrag_checkliste(auftrag_status_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_fotos_status ON auftrag_fotos(auftrag_status_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_historie_status ON auftrag_historie(auftrag_status_id);

-- =====================================================
-- TEIL 4: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- RLS aktivieren fuer eigene Tabellen
ALTER TABLE auftrag_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE auftrag_checkliste ENABLE ROW LEVEL SECURITY;
ALTER TABLE auftrag_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auftrag_historie ENABLE ROW LEVEL SECURITY;

-- Einfache Policy: Authentifizierte User haben vollen Zugriff
-- (Spaeter koennen wir Rollen-basierte Policies hinzufuegen)

CREATE POLICY "Authenticated users can read auftrag_status"
    ON auftrag_status FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert auftrag_status"
    ON auftrag_status FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update auftrag_status"
    ON auftrag_status FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read auftrag_checkliste"
    ON auftrag_checkliste FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert auftrag_checkliste"
    ON auftrag_checkliste FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update auftrag_checkliste"
    ON auftrag_checkliste FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read auftrag_fotos"
    ON auftrag_fotos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert auftrag_fotos"
    ON auftrag_fotos FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can read auftrag_historie"
    ON auftrag_historie FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert auftrag_historie"
    ON auftrag_historie FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ERP-Cache Tabellen: Nur lesen (Sync erfolgt via Service-Role)
ALTER TABLE erp_kunden ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_projekte ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_angebote ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_ra ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_lieferanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_bestellungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read erp_kunden"
    ON erp_kunden FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read erp_projekte"
    ON erp_projekte FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read erp_angebote"
    ON erp_angebote FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read erp_rechnungen"
    ON erp_rechnungen FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read erp_ra"
    ON erp_ra FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read erp_lieferanten"
    ON erp_lieferanten FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read erp_bestellungen"
    ON erp_bestellungen FOR SELECT TO authenticated USING (true);

-- =====================================================
-- TEIL 5: TRIGGER (Auto-Update updated_at)
-- =====================================================

-- Funktion fuer automatisches updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger fuer auftrag_status
CREATE TRIGGER update_auftrag_status_updated_at
    BEFORE UPDATE ON auftrag_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FERTIG!
-- =====================================================
-- Naechster Schritt: Python-Sync-Script schreiben
-- Das Script liest aus SQL Server und schreibt via Supabase API
-- =====================================================
