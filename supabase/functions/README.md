# Supabase Edge Functions

32 Deno-basierte Serverless Functions. Orchestrieren Email-/Dokument-Pipelines, Jess (LLM-Chat), Suche, Admin-Operationen und ERP-Integrationen.

> **Vollständiger Function Catalog + Status:** [../../CLAUDE.md](../../CLAUDE.md) → Sektion "Edge Function Catalog"
> **Security-Pflichten:** [../../CLAUDE.md](../../CLAUDE.md) → Sektion "Edge Function Security (PFLICHT)"
> **Deploy-Regeln:** [../../../KB/wissen/SUPABASE_DEPLOY.md](../../../KB/wissen/SUPABASE_DEPLOY.md)

## Struktur

```
functions/
├── _shared/              # Common-Code für alle Functions (NICHT als Function deploybar)
│   ├── security.ts       # CORS, Rate-Limit, Input-Validation, sanitizeError
│   ├── categories.ts     # VALID_DOKUMENT/EMAIL_KATEGORIEN + Aliases
│   ├── notify.ts         # Infra-Alerts
│   └── tool-definitions.ts  # Jess-Tool-Schemata (llm-chat)
├── deno.json             # Zentrale Deno-Config (strict TS, formatter, lint)
├── <function-name>/
│   └── index.ts          # Entrypoint (Deno.serve)
└── ...
```

## Neue Function anlegen

1. Ordner `<function-name>/` erstellen mit `index.ts`
2. `getCorsHeaders(req)`, `checkRateLimit(req)`, `sanitizeError()` aus `_shared/security.ts` importieren — **PFLICHT**
3. NICHT: `Access-Control-Allow-Origin: "*"`, rohe DB-Errors an Client, unbegrenzte Limits
4. Im Catalog in `CLAUDE.md` eintragen
5. Falls DSGVO-relevant (sendet personenbezogene Daten an externe API): Eintrag in `DSGVO_VERARBEITUNGSVERZEICHNIS.md`
6. Deploy-Weg je nach Risiko (siehe Deploy-Regeln) — Eine Aenderung pro Deploy

## Deploy

```bash
supabase functions deploy <function-name>
```

**Nach JEDEM Deploy:** Echten POST-Call testen. Health-Check (GET) allein reicht NICHT. Logs 30s nach Deploy auf 500er prüfen.

## Geschützte Functions

`process-document`, `process-document-ocr`, `process-document-categorize`, `process-email`, `batch-process-pending` dürfen NUR mit expliziter Freigabe von Andreas geändert/deployed werden. Details in `CLAUDE.md`.

## Tests

- Backtest-Runner: `classify-backtest`, `classify-email-backtest`
- Fixtures: `../../tests/` (Kategorisierungs-Golden-Sets)
- Nach Änderungen am Prompt/Schema: Backtest PFLICHT
