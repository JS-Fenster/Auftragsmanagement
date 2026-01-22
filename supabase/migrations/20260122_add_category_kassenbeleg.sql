-- =============================================================================
-- Migration: Add category Kassenbeleg
-- Date: 2026-01-22
-- Author: Claude Code
-- Ticket: Taxonomie-Erweiterung
-- =============================================================================
--
-- NEUE KATEGORIE:
-- Kassenbeleg: Tankquittungen, Baumarkt-Bons, Material-Belege, Bewirtung,
--              alles was bar bezahlt wird
--
-- ABGRENZUNGEN:
-- - Kassenbeleg vs Eingangsrechnung: Kassenbeleg = Barbelege, Bons, Quittungen
-- - Kassenbeleg vs Zahlungsavis: Avis = Ankuendigung, Kassenbeleg = Zahlungsnachweis
--
-- ROLLBACK:
-- Manuell: Constraint auf alte Liste zuruecksetzen
-- =============================================================================

-- Drop existing constraint and recreate with new category
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'documents' AND column_name = 'kategorie'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS ' || constraint_name
            FROM information_schema.constraint_column_usage
            WHERE table_name = 'documents' AND column_name = 'kategorie'
            LIMIT 1
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Add new CHECK constraint with all 40 categories (alphabetically sorted)
ALTER TABLE documents
ADD CONSTRAINT documents_kategorie_check CHECK (
    kategorie IN (
        'Abnahmeprotokoll',
        'Angebot',
        'Aufmassblatt',
        'Auftragsbestaetigung',
        'Audio',
        'Ausgangsrechnung',
        'Bestellung',
        'Bild',
        'Brief_ausgehend',
        'Brief_eingehend',
        'Brief_von_Finanzamt',
        'Eingangslieferschein',
        'Eingangsrechnung',
        'Email_Anhang',
        'Email_Ausgehend',
        'Email_Eingehend',
        'Finanzierung',
        'Formular',
        'Gutschrift',
        'Kassenbeleg',            -- NEU v2026-01-22
        'Kundenanfrage',
        'Kundenbestellung',
        'Kundenlieferschein',
        'Leasing',
        'Lieferantenangebot',
        'Mahnung',
        'Montageauftrag',
        'Notiz',
        'Office_Dokument',
        'Preisanfrage',
        'Produktdatenblatt',
        'Reiseunterlagen',
        'Reklamation',
        'Serviceauftrag',
        'Skizze',
        'Sonstiges_Dokument',
        'Vertrag',
        'Video',
        'Zahlungsavis',
        'Zahlungserinnerung'
    )
);

COMMENT ON CONSTRAINT documents_kategorie_check ON documents IS
    'Valid document categories - v2026-01-22: Added Kassenbeleg';

-- =============================================================================
-- VERIFICATION QUERY (run after migration)
-- =============================================================================
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'documents_kategorie_check';
-- =============================================================================
