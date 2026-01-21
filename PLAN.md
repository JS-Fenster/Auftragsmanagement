# Auftragsmanagement - Offene Aufgaben

> Stand: 2026-01-16 | Naechste Session hier weitermachen

---

## PRIO 1: Edge Function Deployment

Die Verbesserungen sind dokumentiert und bereit zum Deployment:

| Datei | Aenderung | Status |
|-------|-----------|--------|
| `supabase/functions/process-document/index.ts` | EXTRACTION_SCHEMA erweitern (38 Kategorien), Dateiausschluss-Logik | BEREIT |
| `supabase/functions/process-document/prompts.ts` | SYSTEM_PROMPT komplett neu | BEREIT |

**Dokumentation:** `docs/EDGE_FUNCTION_VERBESSERUNGEN_2026-01-16.md`

**Zu testen nach Deployment:**
- BDK Bank Brief → "Finanzierung" (nicht Brief_von_Kunde)
- Baustellenordnung → "Vertrag" (nicht Brief_von_Kunde)
- WERU Garantiepass → "Garantie"

---

## PRIO 2: SQL Migrationen

### 2.1 CHECK Constraint erweitern
```sql
-- Siehe docs/EDGE_FUNCTION_VERBESSERUNGEN_2026-01-16.md Abschnitt 2.4
-- 38 Kategorien statt 18
```

### 2.2 Feld 'kategorisiert_von' hinzufuegen
```sql
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS kategorisiert_von TEXT DEFAULT 'gpt'
CHECK (kategorisiert_von IN ('gpt', 'manuell', 'regel'));

COMMENT ON COLUMN documents.kategorisiert_von IS 'Wer hat kategorisiert: gpt/manuell/regel';
```

### 2.3 Feld 'sensibel' + Trigger
```sql
-- Siehe docs/EDGE_FUNCTION_VERBESSERUNGEN_2026-01-16.md Abschnitt 3.2
-- Automatisch TRUE bei: AU_Bescheinigung, Lohnabrechnung, Arbeitsvertrag, Finanzierung, Versicherung
```

---

## PRIO 3: Sicherheit sensible Kategorien

Zugriffskontrolle implementieren fuer:
- AU_Bescheinigung (Gesundheitsdaten)
- Lohnabrechnung (Gehaltsdaten)
- Arbeitsvertrag (Personaldaten)
- Finanzierung (Finanzdaten)
- Versicherung (Versicherungsdaten)

**Optionen:**
1. RLS Policy basierend auf `sensibel` Feld
2. Separate Tabelle `documents_sensibel` mit eingeschraenktem Zugriff
3. Storage-Bucket mit separaten Berechtigungen

---

## Referenz-Dokumente

| Dokument | Inhalt |
|----------|--------|
| `docs/NEUE_KATEGORIEN_2026-01-16.md` | 20 neue Kategorien (bestaetigt) |
| `docs/EDGE_FUNCTION_VERBESSERUNGEN_2026-01-16.md` | Komplette Analyse + Code |

---

## Geloeschte/Bereinigte Dateien

- 12x .ics Kalendertermine (2026-01-16 geloescht)
- test.txt (zum Loeschen markiert)
- QR-Code Bilder 15-16 (zum Loeschen markiert)

---

*Zuletzt aktualisiert: 2026-01-16*
