# Neue Dokument-Kategorien - Analyse vom 16.01.2026

> Ergebnis der Sichtung von 226 "Sonstiges_Dokument" Eintraegen

---

## Bestaetigte neue Kategorien

| # | Kategorie | Beschreibung | Sensibel |
|---|-----------|--------------|----------|
| 1 | `Leistungserklaerung` | CE/DoP-Dokumente von Lieferanten (WERU, Unilux) | - |
| 2 | `Zahlungsavis` | SEPA-Lastschriften, Belastungsanzeigen | - |
| 3 | `Quittung` | Kassenbons, Eigenbelege, Kleinbelege | - |
| 4 | `AU_Bescheinigung` | Arbeitsunfaehigkeitsbescheinigungen | 🔒 |
| 5 | `Preisliste` | Preislisten von Lieferanten | - |
| 6 | `Produktdatenblatt` | Technische Datenblaetter | - |
| 7 | `Montageanleitung` | Montage-/Bedienungsanleitungen | - |
| 8 | `KFZ_Dokument` | Fahrzeugscheine, Zulassungen | - |
| 9 | `Finanzierung` | Darlehen, Leasing, Finanzierungsantraege | 🔒 |
| 10 | `Arbeitsvertrag` | Arbeitsvertraege, bAV, HR-Vereinbarungen | 🔒 |
| 11 | `Versicherung` | Policen, Schadenmeldungen, Gruene Karte | 🔒 |
| 12 | `Vertrag` | Sonstige Vertraege (Bau, Bank, etc.) | - |
| 13 | `Garantie` | Garantiescheine, Zertifikate | - |
| 14 | `Versandbeleg` | DHL/Hermes Retourenscheine, Paketbelege | - |
| 15 | `Schliessplan` | IKON/ASSA ABLOY Schliessanlagen | - |
| 16 | `Pruefbericht` | Elektro (DGUV V3), Stapler (UVV), HU/AU | - |
| 17 | `Typenschild` | Produktkennzeichnungen, Typenschilder | - |
| 18 | `Gutschein` | Geschenkgutscheine | - |
| 19 | `Lohnabrechnung` | Gehaltsabrechnungen | 🔒 |
| 20 | `Urkunde` | Jubilaeums-, Schulungs-, Weiterbildungsurkunden | - |

---

## Ausgeschlossene Dateitypen (NICHT uploaden!)

| Dateityp | Grund | Aktion |
|----------|-------|--------|
| `.ics` | Kalendertermine gehoeren nicht in Dokumentenverwaltung | 12 Dateien geloescht (2026-01-16) |
| `test.txt` | Testdateien | Loeschen |

---

## Offene Aufgaben (Todos)

1. **FELD:** `kategorisiert_von` (text: gpt/manuell/regel) zur documents Tabelle hinzufuegen
2. **SICHERHEIT:** Zugriffskontrolle fuer sensible Kategorien (🔒 markiert)

---

## SQL fuer neue Kategorien (CHECK Constraint)

```sql
-- Neue Kategorien zum CHECK Constraint hinzufuegen
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_kategorie_check;

ALTER TABLE documents
ADD CONSTRAINT documents_kategorie_check
CHECK (kategorie = ANY (ARRAY[
  -- Bestehende Kategorien
  'Preisanfrage'::text,
  'Angebot'::text,
  'Auftragsbestaetigung'::text,
  'Bestellung'::text,
  'Eingangslieferschein'::text,
  'Eingangsrechnung'::text,
  'Kundenlieferschein'::text,
  'Montageauftrag'::text,
  'Ausgangsrechnung'::text,
  'Zahlungserinnerung'::text,
  'Mahnung'::text,
  'Notiz'::text,
  'Skizze'::text,
  'Brief_an_Kunde'::text,
  'Brief_von_Kunde'::text,
  'Brief_von_Finanzamt'::text,
  'Brief_von_Amt'::text,
  'Sonstiges_Dokument'::text,
  'Video'::text,
  'Audio'::text,
  'Office_Dokument'::text,
  'Archiv'::text,
  'Email_Eingehend'::text,
  'Email_Ausgehend'::text,
  'Email_Anhang'::text,
  -- NEUE Kategorien (2026-01-16)
  'Leistungserklaerung'::text,
  'Zahlungsavis'::text,
  'Quittung'::text,
  'AU_Bescheinigung'::text,
  'Preisliste'::text,
  'Produktdatenblatt'::text,
  'Montageanleitung'::text,
  'KFZ_Dokument'::text,
  'Finanzierung'::text,
  'Arbeitsvertrag'::text,
  'Versicherung'::text,
  'Vertrag'::text,
  'Garantie'::text,
  'Versandbeleg'::text,
  'Schliessplan'::text,
  'Pruefbericht'::text,
  'Typenschild'::text,
  'Gutschein'::text,
  'Lohnabrechnung'::text,
  'Urkunde'::text
]));
```

---

## Nicht klassifizierbare Dokumente

Ca. 60 Dokumente haben:
- Keinen OCR-Text (nur Bilder)
- Kryptische Dateinamen (UUIDs)
- Keine Metadaten

→ Muessen manuell gesichtet werden

---

*Erstellt: 2026-01-16 | Andreas Stolarczyk + Claude*
