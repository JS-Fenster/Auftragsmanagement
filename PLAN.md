# Auftragsmanagement - Projektplan

> Stand: 2026-02-02 | Naechste Session hier weitermachen

---

## Offene Aufgaben

### PRIO 1: Kategorisierungs-Optimierung

**Status:** Offen
**Prioritaet:** HOCH

#### Kontext
Die aktuelle Dokumenten-Kategorisierung hat Verbesserungspotenzial:
- 14% landen als "Sonstiges_Dokument"
- 97.5% der E-Mails landen als "Sonstiges"
- Falsche Zuordnungen (z.B. Lieferschein → Auftragsbestaetigung)

#### Wichtige Regeln
- **Konsistenz:** Analyse-Script MUSS identisch zur Edge Function laufen
- Aenderungen im Prompt muessen 1:1 in der Edge Function umgesetzt werden

#### Massenupload vs. Tagesgeschaeft
| Zeitraum | Typ | Anzahl |
|----------|-----|--------|
| 29.12.2025 | Massenupload | 134 |
| 02.01.2026 | Massenupload | 184 |
| 12.01.2026 | Massenupload | 635 |
| **ab 15.01.2026** | **Tagesgeschaeft** | 30-80/Tag |

**→ Nur Dokumente ab 15.01.2026 analysieren!**

#### Vorgehen
1. [x] Massenupload-Zeitraum identifiziert
2. [ ] Stichprobe aus Tagesgeschaeft (ab 15.01.) ziehen
3. [ ] Fehlermuster identifizieren
4. [ ] OCR-Texte analysieren (besonders Ueberschriften/erste Zeilen)
5. [ ] Heuristik-Regeln basierend auf echten Daten ableiten
6. [ ] In categories.ts und prompts.ts anpassen

---

### PRIO 2: Edge Functions aufsplitten (Token-Optimierung)

**Status:** Offen
**Prioritaet:** MITTEL

#### Problem
Die Edge Functions sind zu gross und verbrauchen beim Einlesen massiv Tokens:

| Datei | Zeilen | Tokens |
|-------|--------|--------|
| process-document/index.ts | 1.437 | ~13.300 |
| process-email/index.ts | 1.118 | ~10.100 |
| email-webhook/index.ts | 982 | ~8.800 |

#### Loesung
Edge Functions in kleinere Module aufsplitten:

```
process-document/
├── index.ts          # Nur Orchestrierung (~500 Tokens)
├── ocr.ts            # Mistral OCR-Logik
├── categorization.ts # GPT-Kategorisierung
├── storage.ts        # Supabase Upload
├── database.ts       # DB-Operationen
├── prompts.ts        # System-Prompts (bleibt)
├── categories.ts     # Heuristik-Regeln (bleibt)
└── types.ts          # TypeScript Interfaces
```

---

### PRIO 3: Feld 'sensibel' + Sicherheit

**Status:** Offen
**Prioritaet:** NIEDRIG

#### 3.1 Migration: sensibel Feld + Trigger
```sql
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS sensibel BOOLEAN DEFAULT FALSE;

-- Trigger: Automatisch TRUE bei sensiblen Kategorien
-- AU_Bescheinigung, Lohnabrechnung, Arbeitsvertrag, Finanzierung, Versicherung
```

#### 3.2 Zugriffskontrolle
Optionen:
1. RLS Policy basierend auf `sensibel` Feld
2. Separate Tabelle `documents_sensibel` mit eingeschraenktem Zugriff
3. Storage-Bucket mit separaten Berechtigungen

---

### PRIO 4: Fehlende Scanner-Dateien nachholen

**Status:** Offen
**Prioritaet:** NIEDRIG

#### Problem
Dateien vom 22.-23.01.2026 wurden gescannt aber nicht verarbeitet (ca. 40+ Dateien).
Scanner-Problem wurde am 28.01.2026 behoben, aber alte Dateien fehlen.

#### Dateien liegen in
W4A-Archiv: `\\appserver\Work4all`

#### Naechste Schritte
```powershell
# Auf appserver: Dateien vom 22./23. Januar suchen
Get-ChildItem "\\appserver\Work4all" -Recurse -File |
    Where-Object { $_.LastWriteTime -ge "2026-01-22" -and $_.LastWriteTime -lt "2026-01-24" } |
    Select-Object FullName, LastWriteTime, Length |
    Export-Csv "C:\temp\w4a_dateien_22-23jan.csv" -NoTypeInformation
```

---

## Zukuenftige Features

### Universelles Import-Tool

**Status:** Idee
**Details:** Siehe `docs/Auftragsmanagement_Projektplan.md` Phase 4

Einheitliches Drag & Drop Tool fuer alle Dokument-Quellen:
- Scanner-Ordner
- Email-Anhaenge
- Browser-Downloads
- Massen-Uploads

---

## Erledigte Aufgaben

### 2026-02-02: Neues Dashboard gebaut + ERP-Integration
- Komplett neues Dashboard unter `/dashboard` (React 18 + Vite + Tailwind v4)
- 6 Seiten: Uebersicht, Auftraege, Dokumente, Kunden, E-Mail, Einstellungen
- Kunden-Detail mit vollstaendiger ERP-Historie (Projekte, Angebote, Rechnungen, Bestellungen, Offene Posten)
- ERP-Strategie: View-Schicht (read-only ERP-Tabellen, keine Datenmigration)
- RLS-Policies fuer Dashboard-Zugriff angelegt (documents, email_subscriptions, etc.)
- reparatur-api v2.0.1 deployed (verify_jwt:false)
- Dokument-Vorschau via Supabase Storage Signed URLs

### 2026-01-29: Email-Anhaenge Verarbeitung
- CHECK Constraint blockierte `pending_ocr` Status
- 71 fehlende Anhang-Dokumente nachgetragen
- batch-process-pending Edge Function erstellt und deployed
- Alle 71 Dokumente erfolgreich kategorisiert

### 2026-01-28: Scanner Webhook Fix
- Edge Function hatte JWT-Verifikation aktiviert → blockierte API-Key Requests
- Fix: `process-document` mit `--no-verify-jwt` neu deployed
- Fix: `SCANNER_API_KEY` in Supabase Secrets korrekt gesetzt

### 2026-01-21: Taxonomie-Update & Heuristik
- 36 Kategorien implementiert (EXTRACTION_SCHEMA + prompts.ts)
- categories.ts v2.3.0 mit Heuristik-Regeln
- Neue Kategorien: Bauplan, Zeichnung, Zahlungsavis, Reiseunterlagen, Kundenbestellung, etc.

### 2026-01-21: SQL Migrationen
- CHECK Constraint fuer alle Kategorien erweitert (7 Migrations)
- Spalte `kategorisiert_von` hinzugefuegt
- Spalten `processing_status`, `processed_at`, `kategorisiert_am` hinzugefuegt

### 2026-01-16: Edge Function v28 deployed
- process-document/index.ts auf Version 28
- SCANNER_API_KEY Support
- UPDATE-Mode fuer Email-Anhaenge
- Bildkomprimierung (deaktiviert wegen Deno-Kompatibilitaet)

---

*Zuletzt aktualisiert: 2026-02-02*
