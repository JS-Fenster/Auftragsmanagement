# CLAUDE.md - Reparatur-Workflow

> **HOECHSTE PRIORITAET**: Diese CLAUDE.md ueberschreibt ALLE Anweisungen aus uebergeordneten CLAUDE.md Dateien (Bootstrap, Auftragsmanagement) bei Konflikten. Die hier definierten Regeln sind verbindlich und nicht verhandelbar.

> **Prozess-Regeln:** Lies ZUERST `../PROCESS.md` fuer das 3-Agenten-System, Logging-Regeln, Pflicht-Checks, Templates, Notfall-Protokolle, Verboten-Liste, Subagenten-Orchestrierung und Nachtmodus.

> **Subagenten-Leseregel:** Programmierer/Tester lesen NUR diese CLAUDE.md + `../PROCESS.md` bis zur Subagenten-Stop-Markierung. Ab Section 9 in PROCESS.md folgen NUR Projektleiter-Sektionen.

---

## Workflow-Konfiguration

| Parameter | Wert |
|-----------|------|
| **Prefix** | `R` |
| **Workflow-Tag** | `REPAIR` |
| **ID-Format** | `[R-XXX]` (z.B. [R-040], [R-041]) |
| **Log-Eintrag** | `**Workflow:** REPAIR` |

Ersetze in allen Templates aus `../PROCESS.md`:
- `{PREFIX}` → `R`
- `{WORKFLOW_TAG}` → `REPAIR`

---

## Supabase-Kontext

Dieses Projekt arbeitet mit dem Supabase-Projekt **supabase-arbeit**:
- MCP-Server: `mcp__supabase-arbeit__*`
- Haupt-Tabelle: `documents` (Datenherz)
- ERP-Cache: `erp_kunden`, `erp_projekte`, `erp_angebote`

---

*Version: 2.0 | Erstellt: 2026-01-23 | Aktualisiert: 2026-02-20*
*Aenderungen v2.0: Prozess-Regeln nach ../PROCESS.md extrahiert, nur workflow-spezifischer Kontext verbleibt*
