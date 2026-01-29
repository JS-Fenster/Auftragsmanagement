# Learnings: Reparatur-Workflow

> **Nur Projektleiter darf diese Datei editieren.**
> **Format:** NUR Merksatz + LOG-Pointer. Details stehen im Log.

---

## Grundsaetze

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L1 | Index-Pflege ist kritisch - ohne Index wird 03_LOG unbrauchbar | [LOG-001] |
| L2 | Preflight/Postflight-Checks erzwingen nachweisbares Lesen | [LOG-002] |
| L3 | Abschlussbericht MUSS in 02_STATUS UND als Prompt-Rueckgabe | [LOG-002] |

---

## Technische Erkenntnisse

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L8 | Stop Hooks fangen Rueckfragen technisch ab - settings.json konfigurieren | [LOG-005] |
| L9 | Permission Allowlists verhindern Permission-Prompts | [LOG-005] |
| L10 | 5 Mechanismen KUMULATIV verwenden, nicht entweder-oder | [LOG-005] |

---

## Prozess-Erkenntnisse

| # | Learning | Log-Referenz |
|---|----------|--------------|
| L4 | Hauptkommunikation ueber Markdown, nicht ueber Prompts | [LOG-002] |
| L5 | 300-Zeilen-Checkpoints sind sicherer als 500 | [LOG-002] |
| L6 | Background-Subagenten haben KEINEN MCP-Zugriff - Foreground wenn Supabase noetig | [LOG-003] |
| L7 | Zeit ist nicht das knappe Gut - sequentiell ist OK | [LOG-003] |
| L11 | Nachtmodus in 02_STATUS.md persistieren - ueberlebt Compaction | [LOG-005] |
| L12 | Bei Unsicherheit: Einfachere Option waehlen und dokumentieren | [LOG-005] |
| L13 | Autonome Entscheidungen IMMER in 03_LOG.md dokumentieren | [LOG-005] |
| L14 | Nachtmodus funktioniert - Subagenten befolgen Regeln wenn in 02_STATUS aktiviert | [LOG-010] |
| L15 | Stop Hook ist Backup - Agent folgt freiwillig wenn Regeln klar sind | [LOG-013] |
| L16 | 6 Luecken: MCP-Fehler, Compile-Error, Test-Fail, Context-Limit, Abhaengigkeit, Stop-Hook | [LOG-013] |
| L17 | Strategien fuer jede Luecke in CLAUDE.md §11 aufnehmen! | [LOG-013] |

---

*Letzte Aktualisierung: 2026-01-26 12:40*
