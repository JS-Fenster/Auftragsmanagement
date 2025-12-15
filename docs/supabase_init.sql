-- AUFTRAGSMANAGEMENT - Supabase Schema
-- Kopiere diesen gesamten Inhalt in den Supabase SQL-Editor

-- ERP-CACHE TABELLEN

CREATE TABLE IF NOT EXISTS erp_kunden (
    code INTEGER PRIMARY KEY,
    firma1 VARCHAR(100),
    firma2 VARCHAR(100),
    firma3 VARCHAR(100),
    name VARCHAR(100),
    strasse VARCHAR(100),
    plz VARCHAR(10),
    ort VARCHAR(100),
    telefon VARCHAR(50),
    mobil VARCHAR(50),
    email VARCHAR(100),
    erp_insert_time TIMESTAMP,
    erp_update_time TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_projekte (
    code INTEGER PRIMARY KEY,
    nummer VARCHAR(20),
    name TEXT,
    kunden_code INTEGER,
    datum DATE,
    projekt_status INTEGER,
    notiz VARCHAR(50),
    erp_insert_time TIMESTAMP,
    erp_update_time TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_angebote (
    code INTEGER PRIMARY KEY,
    nummer INTEGER,
    datum DATE,
    projekt_code INTEGER,
    kunden_code INTEGER,
    wert DECIMAL(12,2),
    auftrags_datum DATE,
    auftrags_nummer INTEGER,
    erp_insert_time TIMESTAMP,
    erp_update_time TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_rechnungen (
    code INTEGER PRIMARY KEY,
    nummer INTEGER,
    datum DATE,
    projekt_code INTEGER,
    kunden_code INTEGER,
    wert DECIMAL(12,2),
    bruttowert DECIMAL(12,2),
    zahlbar_bis DATE,
    zahlungsfrist INTEGER,
    erp_insert_time TIMESTAMP,
    erp_update_time TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_ra (
    code INTEGER PRIMARY KEY,
    r_code INTEGER,
    r_nummer INTEGER,
    r_betrag DECIMAL(12,2),
    bez_summe DECIMAL(12,2),
    mahnstufe INTEGER,
    faellig_datum DATE,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_lieferanten (
    code INTEGER PRIMARY KEY,
    firma1 VARCHAR(100),
    firma2 VARCHAR(100),
    name VARCHAR(100),
    strasse VARCHAR(100),
    plz VARCHAR(10),
    ort VARCHAR(100),
    telefon VARCHAR(50),
    email VARCHAR(100),
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_bestellungen (
    code INTEGER PRIMARY KEY,
    nummer INTEGER,
    datum DATE,
    projekt_code INTEGER,
    lieferant_code INTEGER,
    wert DECIMAL(12,2),
    erp_insert_time TIMESTAMP,
    erp_update_time TIMESTAMP,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- EIGENE TABELLEN

CREATE TABLE IF NOT EXISTS auftrag_status (
    id SERIAL PRIMARY KEY,
    projekt_code INTEGER NOT NULL,
    angebot_code INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'angebot',
    montage_geplant DATE,
    montage_start TIMESTAMP,
    montage_ende TIMESTAMP,
    abnahme_datum TIMESTAMP,
    notiz TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

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

CREATE TABLE IF NOT EXISTS auftrag_fotos (
    id SERIAL PRIMARY KEY,
    auftrag_status_id INTEGER REFERENCES auftrag_status(id) ON DELETE CASCADE,
    datei_pfad TEXT NOT NULL,
    datei_name VARCHAR(255),
    beschreibung TEXT,
    typ VARCHAR(50),
    aufgenommen_am TIMESTAMP,
    hochgeladen_von UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auftrag_historie (
    id SERIAL PRIMARY KEY,
    auftrag_status_id INTEGER REFERENCES auftrag_status(id) ON DELETE CASCADE,
    aktion VARCHAR(100) NOT NULL,
    feld VARCHAR(100),
    alter_wert TEXT,
    neuer_wert TEXT,
    geaendert_von UUID REFERENCES auth.users(id),
    geaendert_am TIMESTAMP DEFAULT NOW()
);

-- INDIZES

CREATE INDEX IF NOT EXISTS idx_erp_projekte_kunden ON erp_projekte(kunden_code);
CREATE INDEX IF NOT EXISTS idx_erp_projekte_datum ON erp_projekte(datum);
CREATE INDEX IF NOT EXISTS idx_erp_angebote_projekt ON erp_angebote(projekt_code);
CREATE INDEX IF NOT EXISTS idx_erp_angebote_auftrags_datum ON erp_angebote(auftrags_datum);
CREATE INDEX IF NOT EXISTS idx_erp_rechnungen_projekt ON erp_rechnungen(projekt_code);
CREATE INDEX IF NOT EXISTS idx_erp_ra_rechnung ON erp_ra(r_code);
CREATE INDEX IF NOT EXISTS idx_erp_bestellungen_projekt ON erp_bestellungen(projekt_code);
CREATE INDEX IF NOT EXISTS idx_auftrag_status_projekt ON auftrag_status(projekt_code);
CREATE INDEX IF NOT EXISTS idx_auftrag_status_status ON auftrag_status(status);

-- AUTO-UPDATE TRIGGER

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auftrag_status_updated_at
    BEFORE UPDATE ON auftrag_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
