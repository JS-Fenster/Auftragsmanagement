-- =============================================================================
-- Migration: Add categories Reiseunterlagen, Kundenbestellung, Zahlungsavis
-- Date: 2026-01-21
-- Author: Claude Code
-- Ticket: Taxonomie-Erweiterung + Heuristik
-- =============================================================================
--
-- NEUE KATEGORIEN:
-- 1. Reiseunterlagen: Hotel/Zimmerreservierung, Buchungsbestaetigungen, Bahn/Flug, Mietwagen
-- 2. Kundenbestellung: PO/Bestellung vom Kunden an uns (wir sind Lieferant)
-- 3. Zahlungsavis: Belastungsanzeige, Lastschriftinfo, Sammelabbuchung
--
-- ABGRENZUNGEN:
-- - Kundenbestellung vs Bestellung: Kundenbestellung = Kunde bestellt bei UNS
-- - Zahlungsavis vs Eingangsrechnung: Avis = Info ueber ausgefuehrte Zahlung
-- - Reiseunterlagen vs Brief_eingehend: Spezifisch Reise/Hotel/Transport
--
-- ROLLBACK:
-- Manuell: Constraint auf alte Liste zuruecksetzen
-- =============================================================================

-- Drop existing constraint (if exists) and recreate with new categories
-- Note: Constraint name may vary - we use IF EXISTS pattern

DO $$
BEGIN
    -- Try to drop the constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'documents' AND column_name = 'kategorie'
    ) THEN
        -- Get and drop the constraint dynamically
        EXECUTE (
            SELECT 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS ' || constraint_name
            FROM information_schema.constraint_column_usage
            WHERE table_name = 'documents' AND column_name = 'kategorie'
            LIMIT 1
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint may not exist, continue
        NULL;
END $$;

-- Add new CHECK constraint with all 39 categories (alphabetically sorted)
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
        'Kundenanfrage',
        'Kundenbestellung',       -- NEU v2026-01-21
        'Kundenlieferschein',
        'Leasing',
        'Lieferantenangebot',
        'Mahnung',
        'Montageauftrag',
        'Notiz',
        'Office_Dokument',
        'Preisanfrage',
        'Produktdatenblatt',
        'Reiseunterlagen',        -- NEU v2026-01-21
        'Reklamation',
        'Serviceauftrag',
        'Skizze',
        'Sonstiges_Dokument',
        'Vertrag',
        'Video',
        'Zahlungsavis',           -- NEU v2026-01-21
        'Zahlungserinnerung'
    )
);

-- Add comment documenting the change
COMMENT ON CONSTRAINT documents_kategorie_check ON documents IS
    'Valid document categories - v2026-01-21: Added Reiseunterlagen, Kundenbestellung, Zahlungsavis';

-- =============================================================================
-- VERIFICATION QUERY (run after migration)
-- =============================================================================
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'documents_kategorie_check';
-- =============================================================================
