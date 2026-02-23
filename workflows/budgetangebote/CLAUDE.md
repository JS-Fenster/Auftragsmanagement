# CLAUDE.md - Budgetangebot-Workflow

> **HOECHSTE PRIORITAET**: Diese CLAUDE.md ueberschreibt ALLE Anweisungen aus uebergeordneten CLAUDE.md Dateien (Bootstrap, Auftragsmanagement) bei Konflikten. Die hier definierten Regeln sind verbindlich und nicht verhandelbar.

> **Prozess-Regeln:** Lies ZUERST `../PROCESS.md` fuer das 3-Agenten-System, Logging-Regeln, Pflicht-Checks, Templates, Notfall-Protokolle, Verboten-Liste, Subagenten-Orchestrierung und Nachtmodus.

> **Subagenten-Leseregel:** Programmierer/Tester lesen NUR diese CLAUDE.md + `../PROCESS.md` bis zur Subagenten-Stop-Markierung. Ab Section 9 in PROCESS.md folgen NUR Projektleiter-Sektionen.

---

## Workflow-Konfiguration

| Parameter | Wert |
|-----------|------|
| **Prefix** | `B` |
| **Workflow-Tag** | `BUDGET` |
| **ID-Format** | `[B-XXX]` (z.B. [B-039], [B-040]) |
| **Log-Eintrag** | `**Workflow:** BUDGET` |

Ersetze in allen Templates aus `../PROCESS.md`:
- `{PREFIX}` → `B`
- `{WORKFLOW_TAG}` → `BUDGET`

---

## Projekt-Kontext: Budgetangebot V1

### Zweck
Schnelle Budgetschaetzung fuer Fenster + Zubehoer + Montage aus Scan/Notiz-Input.
Langfristig: Eigene Bestandswerte aufbauen, um Work4All zu ersetzen.

### Datenquellen
- **Supabase (Arbeit):** `mcp__supabase-arbeit__*`
  - ERP-Cache: `erp_kunden`, `erp_projekte`, `erp_angebote`
  - Neue Tabellen: `budget_cases`, `budget_items`, `budget_results`, etc.
- **Work4All SQL Server:** Via Cloudflare Tunnel (History/Backtest)
  - `dbo.Angebot`, `dbo.Positionen`, `dbo.Projekte`

### Fachliche Regeln V1
- Masse: Standard = Fertigmass; Fallback = Innenmass
- Einheiten: mm (Standard), aber cm/m moeglich
- Hersteller Default: WERU
- System nach Glas: 3-fach → CALIDO, 2-fach → CASTELLO, IMPREO nur wenn explizit
- Ausgabe: Brutto, gerundet auf 50 Euro
- Zubehoer: Rollladen, Raffstore, Motor (wenn elektrisch), AFB, IFB, Insekt, Plissee
- Montage/Demontage/Entsorgung separat ausweisen

### Tech-Stack
- Backend: Node.js + Express (Port 3001)
- Dashboard: React + Vite (Port 3000)
- DB: Supabase (PostgreSQL) + Work4All MSSQL (read-only via Proxy)

### Datei-Map: Budgetangebot Frontend

| Aufgabe | Datei lesen |
|---------|-------------|
| State/API/Handlers | `dashboard/src/pages/Budgetangebot.jsx` |
| Konstanten/Preise/MwSt | `dashboard/src/pages/budgetangebot/constants.js` |
| UI-Komponenten | `dashboard/src/pages/budgetangebot/ui.jsx` |
| Kundensuche | `dashboard/src/pages/budgetangebot/KundenSuche.jsx` |
| Step 1 Eingabe | `dashboard/src/pages/budgetangebot/StepEingabe.jsx` |
| Step 2 Positionen | `dashboard/src/pages/budgetangebot/StepPositionen.jsx` |
| Step 3 Zusammenfassung | `dashboard/src/pages/budgetangebot/StepZusammenfassung.jsx` |
| Step 4 Vorschau | `dashboard/src/pages/budgetangebot/StepVorschau.jsx` |
| Angebotsverlauf | `dashboard/src/pages/BudgetangebotVerlauf.jsx` |

---

*Version: 2.0 | Erstellt: 2026-02-03 | Aktualisiert: 2026-02-20*
*Aenderungen v2.0: Prozess-Regeln nach ../PROCESS.md extrahiert, nur workflow-spezifischer Kontext verbleibt*
