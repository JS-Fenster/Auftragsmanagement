# TODO - Auftragsmanagement

> **Aktualisiert:** 2026-01-29

---

## Offene Aufgaben

### 1. Kategorisierungs-Optimierung analysieren und implementieren

**Status:** Offen
**Prioritaet:** HOCH

#### Kontext
Die aktuelle Dokumenten-Kategorisierung hat viele Fehler:
- 14% landen als "Sonstiges_Dokument"
- 97.5% der E-Mails landen als "Sonstiges"
- Falsche Zuordnungen (z.B. Lieferschein → Auftragsbestaetigung)

#### Wichtige Regeln
- **Konsistenz:** Analyse-Script MUSS identisch zur Edge Function laufen
- Aenderungen im Prompt muessen 1:1 in der Edge Function umgesetzt werden
- Sonst wird weiterhin falsch kategorisiert

#### Massenupload vs. Tagesgeschaeft
| Zeitraum | Typ | Anzahl |
|----------|-----|--------|
| 29.12.2025 | Massenupload | 134 |
| 02.01.2026 | Massenupload | 184 |
| 12.01.2026 | Massenupload | 635 |
| **ab 15.01.2026** | **Tagesgeschaeft** | 30-80/Tag |

**→ Nur Dokumente ab 15.01.2026 analysieren!**
**→ Massenupload (source='upload') separat behandeln**

#### Vorgehen
1. ✅ Massenupload-Zeitraum identifiziert
2. [ ] Stichprobe aus Tagesgeschaeft (ab 15.01.) ziehen
3. [ ] Fehlermuster identifizieren
4. [ ] OCR-Texte analysieren (besonders Ueberschriften/erste Zeilen)
5. [ ] Heuristik-Regeln basierend auf echten Daten ableiten
6. [ ] In categories.ts und prompts.ts anpassen - IDENTISCH zur Edge Function

---

### 2. Edge Functions aufsplitten (Token-Optimierung)

**Status:** Offen
**Prioritaet:** MITTEL (vor Kategorisierungs-Arbeit empfohlen)

#### Problem
Die Edge Functions sind zu gross und verbrauchen beim Einlesen massiv Tokens:

| Datei | Zeilen | Tokens |
|-------|--------|--------|
| process-document/index.ts | 1.436 | ~13.300 |
| process-email/index.ts | 1.118 | ~10.100 |
| email-webhook/index.ts | 982 | ~8.800 |
| process-document komplett | - | ~19.000 |

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

#### Vorteile
- Claude kann gezielt nur relevante Module lesen
- Weniger Token-Verbrauch pro Session
- Bessere Wartbarkeit
- Einfacher zu testen

---

### 3. Fehlende Scanner-Dateien nachholen

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

### 4. Universelles Import-Tool

**Status:** Idee
**Details:** Siehe `docs/Auftragsmanagement_Projektplan.md` Phase 4

Einheitliches Drag & Drop Tool fuer alle Dokument-Quellen:
- Scanner-Ordner
- Email-Anhaenge
- Browser-Downloads
- Massen-Uploads

---

## Erledigte Aufgaben

### ✅ Scanner Webhook Fix (28.01.2026)
- Edge Function hatte JWT-Verifikation aktiviert → blockierte API-Key Requests
- Fix: `process-document` mit `--no-verify-jwt` neu deployed
- Fix: `SCANNER_API_KEY` in Supabase Secrets korrekt gesetzt

### ✅ Email-Anhaenge Verarbeitung (29.01.2026)
- CHECK Constraint blockierte `pending_ocr` Status
- 71 fehlende Anhang-Dokumente nachgetragen
- batch-process-pending Edge Function erstellt und deployed
- Alle 71 Dokumente erfolgreich kategorisiert

---

*Zuletzt aktualisiert: 2026-01-29*
