# Golden Backup: process-document v34

Dies ist der gesicherte Stand v34 (2026-02-11). Kategorisierung laeuft stabil. Bei Problemen: Diese Dateien als Referenz nutzen.

## Inhalt

| Datei | Beschreibung |
|-------|-------------|
| `index.ts` | Haupt-Edge-Function (OCR + GPT Kategorisierung) |
| `prompts.ts` | System-Prompt fuer GPT-5 mini (36 Kategorien) |
| `schema.ts` | TypeScript Interfaces + JSON Schema |
| `extraction.ts` | Text-Extraktion (OCR, DOCX, Excel) |
| `utils.ts` | Utility-Funktionen (MIME, Sanitize, API-Key) |
| `budget-prompts.ts` | Budget-Extraktion fuer Aufmassblaetter |
| `categories.ts` | Shared: Kategorie-Definitionen + Canonicalization |

## Versionsinfo

- **Version:** 34 (Deploy 52)
- **Modell:** GPT-5 mini (json_object Format)
- **Kategorien:** 36 Dokument-Kategorien
- **Datum:** 2026-02-11
- **Status:** Stabil, Backtest bestanden
