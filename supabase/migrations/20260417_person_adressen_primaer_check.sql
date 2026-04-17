-- AM-197 MA-P1e: Primaere Adresse muss mind. 2 von 3 Pflichtfeldern haben
-- Verhindert leere Rechnungsadressen / PDF-Exporte mit NULL-Platzhaltern.
-- Audit: _temp/AUDIT_MITARBEITER_2026-04-17.md P1-5
-- Aktuell betroffen: 0 bestehende Eintraege

ALTER TABLE public.person_adressen
  ADD CONSTRAINT person_adressen_primaer_hat_pflichtfelder
  CHECK (
    NOT ist_primaer OR
    ((strasse IS NOT NULL)::int + (plz IS NOT NULL)::int + (ort IS NOT NULL)::int) >= 2
  );
