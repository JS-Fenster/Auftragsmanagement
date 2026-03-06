# Edge Function Deploy - Learnings & Checkliste

## WICHTIG!!! Deploy-Checkliste (PFLICHT nach JEDEM Deploy)

Nach JEDEM Deploy einer Edge Function die Dokumente verarbeitet:

1. **Health-Check (GET)** - Zeigt nur Config, NICHT ob POST funktioniert!
2. **Echten POST-Call testen** - Mit einem realen Dokument, nicht nur Health-Check
3. **Edge Function Logs pruefen** - Innerhalb 30 Sekunden nach Deploy auf 500er schauen
4. **DB-Ergebnis pruefen** - Hat das Test-Dokument eine Kategorie bekommen?
5. **Erst dann "funktioniert" sagen**

## WICHTIG!!! Deploy per CLI

```bash
cd /c/Claude_Workspace/WORK/repos/Auftragsmanagement
npx supabase functions deploy <name> --project-ref rsmjgdujlpnydbsfuiek --no-verify-jwt
```

- IMMER per CLI deployen (nicht ueber Supabase MCP Tool)
- `--no-verify-jwt` ist noetig fuer Functions die von pg_cron aufgerufen werden
- Nach Deploy: Version in CLAUDE.md aktualisieren (Deploy-Nummer + Aenderung)

## WICHTIG!!! Kaskadierende Fehler vermeiden

Aenderungen an EINER Stelle koennen ANDERE Flows brechen:
- Schema-Aenderung -> GPT-Call bricht -> Alle Dokumente bleiben ohne Kategorie
- Kategorie-Rename -> CHECK Constraint -> Email-Anhaenge gehen verloren
- Prompt-Aenderung -> Kategorisierung aendert sich -> Downstream-Logik bricht

**Gegenmassnahmen:**
1. Checkliste in CLAUDE.md (8 Punkte bei Kategorie-Aenderungen)
2. NUR die betroffene Datei aendern - keine "Nebenbei-Fixes"
3. Vor Deploy: Diff pruefen - sind NUR die gewollten Aenderungen drin?
4. Nach Deploy: Echten POST-Call testen (siehe Checkliste oben)

## WICHTIG!!! Health-Check != Funktionstest

Der Health-Check (GET /process-document) testet NUR:
- Ob die Function deployed ist
- Ob die Config geladen wird (API Keys vorhanden)
- Ob die Version stimmt

Er testet NICHT:
- Ob das JSON Schema von OpenAI akzeptiert wird
- Ob Mistral OCR funktioniert
- Ob der GPT-Call durchlaeuft
- Ob die DB-Updates funktionieren

## WICHTIG!!! Fehleranalyse: IMMER processing_last_error lesen!

Wenn process-document 500 gibt, ZUERST die echte Fehlermeldung aus der DB holen:
```sql
SELECT id, processing_last_error FROM documents
WHERE processing_status = 'error' ORDER BY updated_at DESC LIMIT 5;
```
NICHT raten was der Fehler sein koennte! Die DB-Fehlermeldung sagt es direkt.

## WICHTIG!!! OpenAI GPT-5 Modelle - Parameter-Kompatibilitaet

- `gpt-5-mini` unterstuetzt KEINEN `reasoning` Parameter (gibt 400 "Unknown parameter")
- `reasoning: { effort: "low" }` funktioniert NUR bei GPT-5/GPT-5.2 (reasoning models)
- GPT-5 Modelle unterstuetzen KEIN `temperature` - stattdessen `reasoning_effort` als Top-Level-Parameter
- **FALSCH:** `reasoning: { effort: "low" }` (nested Objekt)
- **RICHTIG:** `reasoning_effort: "low"` (Top-Level-Parameter, nur GPT-5/GPT-5.2)
- Bei GPT-5.2: `max_completion_tokens` statt `max_tokens`
- API-Parameter koennen sich ohne Vorwarnung aendern - immer Fehlermeldungen lesen

## WICHTIG!!! batch-process-pending Timeout-Limit

- Supabase Edge Functions haben ein **150s Wall-Clock-Limit** (504 bei Ueberschreitung)
- `batch-process-pending` verarbeitet Docs **sequentiell** - jedes Doc braucht ~40s (Download + OCR + GPT)
- **Max 3 Docs pro Batch** damit 3x40s=120s unter dem 150s Limit bleibt
- pg_cron `timeout_milliseconds: 30000` betrifft nur den HTTP-Call-Timeout, NICHT die Edge Function Laufzeit
- Wenn alle pending_ocr abgearbeitet: Intervall wieder auf `*/15` zuruecksetzen

## WICHTIG!!! OpenAI json_schema strict Mode

OpenAI's `json_schema` mit `strict: true` hat andere Regeln als normales JSON Schema:

- **FALSCH:** `type: ["string", "null"]` (Array-Syntax fuer nullable)
- **RICHTIG:** `anyOf: [{ type: "string" }, { type: "null" }]`
- **FALSCH:** `type: ["object", "null"]` mit properties
- **RICHTIG:** `anyOf: [{ type: "object", properties: {...}, required: [...], additionalProperties: false }, { type: "null" }]`
- **FALSCH:** `type: ["array", "null"]` mit items
- **RICHTIG:** `anyOf: [{ type: "array", items: {...} }, { type: "null" }]`

Konsequenz: OpenAI gibt HTTP 400 zurueck wenn das Schema nicht strict-kompatibel ist,
was in der Edge Function als HTTP 500 nach aussen sichtbar wird.

## Chronologie der Vorfaelle

### 2026-03-05/06: process-document v39 Deploy 65-68 - reasoning Parameter 500er
- **Echte Ursache:** `reasoning: { effort: "low" }` - gpt-5-mini unterstuetzt diesen Parameter NICHT
- **OpenAI Fehlermeldung:** `"Unknown parameter: 'reasoning'"` (HTTP 400)
- **Fehldiagnose 1:** Annahme war json_schema strict Format - FALSCH, das war ein Nebenproblem
- **Fehldiagnose 2:** Annahme war anyOf Format in schema.ts - FALSCH, Schema wird bei json_object gar nicht genutzt
- **4 Deploy-Versuche (65-68) alle gescheitert** weil der echte Fehler nicht untersucht wurde
- **Root-Cause-Finding:** Erst `processing_last_error` in DB lesen zeigte den echten Fehler
- **Fix (Deploy 69):** `reasoning` Parameter komplett entfernt
- **LEARNING:** IMMER zuerst `processing_last_error` in der DB pruefen, nicht raten!
- **LEARNING:** OpenAI API-Parameter koennen sich aendern - was gestern funktionierte kann heute 400 geben

### 2026-03-06: batch-process-pending 504 Timeout nach Deploy 69
- **Problem:** Deploy 69 fixte process-document (40s pro Doc), aber batch mit limit=10 -> 400s > 150s Limit
- **Auswirkung:** 141 pending_ocr Docs wurden nicht verarbeitet, pg_cron lief ins Leere
- **Symptom:** pg_cron "succeeded" (SQL lief), aber `net._http_response` zeigte `status_code: null`
- **Fix:** pg_cron auf `limit: 3` + `*/5 * * * *` (temporaer, danach `*/15`)
- **LEARNING:** Nach Deploy-Fix pruefen ob Downstream-Timing noch stimmt (process-document schneller/langsamer -> batch limit anpassen)

### 2026-02-27 bis 2026-03-06: Email_Anhang CHECK Constraint (9 Tage!)
- **Problem:** CHECK Constraint auf documents.kategorie blockte "Email_Anhang"
- **Auswirkung:** 140 Email-Anhaenge gingen verloren
- **Fix:** process-email v4.1.1 setzt kategorie: null statt "Email_Anhang"
- **Ursache:** Kategorie-Rename (G-021) ohne Checkliste aller betroffenen Stellen
