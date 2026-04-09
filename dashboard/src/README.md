# Dashboard (React + Vite)

Haupt-UI für AM. React 19, Vite 7, Tailwind 4, Supabase Client.

> **Projekt-Docs:** [../../CLAUDE.md](../../CLAUDE.md)
> **UI-Struktur-Doku (PFLICHT lesen vor MA-Tab-Änderungen):** [../../../../../KB/wissen/MA_TAB_STRUKTUR.md](../../../../../KB/wissen/MA_TAB_STRUKTUR.md)

## Ordnerstruktur

```
src/
├── App.jsx            # Routing + Layout + lazy-loaded Pages
├── main.jsx           # Entry
├── index.css          # Tailwind-Basis
├── pages/             # Route-Pages (1 Datei pro Top-Level Route)
├── components/        # Wiederverwendbare UI-Komponenten (nicht Route-gebunden)
├── hooks/             # Custom Hooks
├── contexts/          # React Context Provider (Auth, Notifications, ...)
├── lib/               # Supabase-Client, API-Wrapper, Utilities
└── services/          # Business-Logik-Module (keine JSX)
```

## Konventionen

### Pages vs. Components
- **`pages/*.jsx`** = Route-Target. Wird von `App.jsx` per `React.lazy()` geladen. Genau eine Page pro Route.
- **`components/*.jsx`** = wiederverwendbar, NICHT direkt geroutet. Können in mehreren Pages verwendet werden.
- Page-spezifische Sub-Komponenten: Unterordner in `pages/<page>/` (z.B. `pages/budgetangebot/KundenSuche.jsx`).

### Dateigrößen
Maximal ~500 Zeilen pro Komponente. Bei Überschreitung: In Sub-Komponenten splitten (Tabs, Sektionen, Formulare). Siehe Backlog AM-173/174 für laufende Splits.

### State-Management
- **Lokaler UI-State**: `useState` + `useEffect` direkt in der Komponente
- **Globaler State**: `contexts/` (AuthContext, NotificationsContext, ...)
- **Server-State**: Aktuell inline `supabase.from(...)`. Migration zu einheitlichem `useSupabaseQuery` Hook geplant (Backlog AM-186)

### Supabase-Queries
- Client aus `lib/supabase.js` importieren
- RLS beachten: Frontend nutzt `anon` Key (bzw. authenticated nach Login). Tabellen ohne `authenticated`-Policies sind NICHT lesbar — kein Bug, sondern Security
- Fehler NIE direkt in UI anzeigen → User-freundliche Meldungen

### Shared Helpers (ZUERST PRÜFEN vor Neuanlage!)
Siehe `CLAUDE.md` → Sektion "Dashboard Shared Helpers".

## Tests

- **E2E (Playwright):** `../../e2e/` — Smoke + Navigation
- **Unit Tests:** Noch nicht eingerichtet (Aufbauphase, siehe Audit-Entscheidung 2026-04-09)

## Code-Standards

> Details: [../../../../../KB/wissen/CODE_STANDARDS.md](../../../../../KB/wissen/CODE_STANDARDS.md)

- Variablen/Funktionen/Dateinamen: **Englisch, ASCII only**
- UI-Texte (Labels, Buttons, Placeholder): **Deutsch mit korrekten Umlauten** (ä/ö/ü, NICHT ae/oe/ue)
- `import type` für Type-only Imports (TypeScript)
- Keine Hardcodes für konfigurierbare Werte → DB/Einstellungen (siehe Backlog AM-172)
