# Learnings: Reparatur-Workflow

> **Nur Projektleiter darf diese Datei editieren.**
> **Format:** NUR Merksatz + LOG-Pointer. Details stehen im Log.

---

## Grundsaetze

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L1 | Index-Pflege ist kritisch - ohne Index wird 03_LOG unbrauchbar | [R-001] |
| L2 | Preflight/Postflight-Checks erzwingen nachweisbares Lesen | [R-002] |
| L3 | Abschlussbericht MUSS in 02_STATUS UND als Prompt-Rueckgabe | [R-002] |

---

## Technische Erkenntnisse

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L8 | Stop Hooks fangen Rueckfragen technisch ab - settings.json konfigurieren | [R-005] |
| L9 | Permission Allowlists verhindern Permission-Prompts | [R-005] |
| L10 | 5 Mechanismen KUMULATIV verwenden, nicht entweder-oder | [R-005] |

---

## Prozess-Erkenntnisse

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L4 | Hauptkommunikation ueber Markdown, nicht ueber Prompts | [R-002] |
| L5 | 300-Zeilen-Checkpoints sind sicherer als 500 | [R-002] |
| L6 | Background-Subagenten haben KEINEN MCP-Zugriff - Foreground wenn Supabase noetig | [R-003] |
| L7 | Zeit ist nicht das knappe Gut - sequentiell ist OK | [R-003] |
| L11 | Nachtmodus in 02_STATUS.md persistieren - ueberlebt Compaction | [R-005] |
| L12 | Bei Unsicherheit: Einfachere Option waehlen und dokumentieren | [R-005] |
| L13 | Autonome Entscheidungen IMMER in 03_LOG.md dokumentieren | [R-005] |
| L14 | Nachtmodus funktioniert - Subagenten befolgen Regeln wenn in 02_STATUS aktiviert | [R-010] |
| L15 | Stop Hook ist Backup - Agent folgt freiwillig wenn Regeln klar sind | [R-013] |
| L16 | 6 Luecken: MCP-Fehler, Compile-Error, Test-Fail, Context-Limit, Abhaengigkeit, Stop-Hook | [R-013] |
| L17 | Strategien fuer jede Luecke in CLAUDE.md §11 aufnehmen! | [R-013] |
| L18 | Bei MCP-Ausfaellen (Chrome): Tests dokumentieren + alternative Testmethoden nutzen | [R-028] |
| L19 | RLS ohne Policies = unsichtbare Daten. Immer Policies pruefen nach Tabellen-Erstellung | [R-038] |
| L20 | ERP-Daten NICHT kopieren sondern per View-Schicht verknuepfen (read-only + FK) | [R-038] |
| L21 | Edge Functions mit verify_jwt:true blockieren anon-Key. Dashboard braucht verify_jwt:false | [R-038] |
| L22 | Supabase Storage Signed URLs statt Edge Function fuer Dokument-Vorschau nutzen | [R-038] |
| L23 | API-Keys in app_config Tabelle MUESSEN synchron mit Edge Function Secrets sein. Bei Key-Rotation BEIDE Stellen aktualisieren! | [R-039] |

---

*Letzte Aktualisierung: 2026-02-05*
