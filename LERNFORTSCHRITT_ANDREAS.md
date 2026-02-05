# 📚 Lernfortschritt: Andreas Stolarczyk
## KI- & Automatisierungs-Coaching mit Marco Heer

---

## 👤 Über dieses Dokument

**Coachee**: Andreas Stolarczyk (Geschäftsführer J.S. Fenster & Türen GmbH)
**Coach**: Marco Heer (KI- & Automatisierungscoach)
**Coaching-Umfang**: 100 Stunden
**Ziel**: Autonomer, autarker KI-Nutzer werden & selbst programmieren mit Claude Code
**Start**: November 2024
**Status**: Laufend

---

## 🎯 Coaching-Ziele

### Hauptziele
- [ ] Verständnis der KI-Grundlagen (Transformer, Tokens, Context)
- [ ] Beherrschung von Claude Code als Entwicklungs-Tool
- [ ] Aufbau eigener Workflows und Automatisierungen
- [ ] Integration verschiedener Tools (N8N, Webhooks, APIs)
- [ ] Entwicklung eines produktiven Digitalisierungs-Dashboards
- [ ] Selbstständiges Programmieren und Troubleshooting

### Langfristige Vision
- Digitalisierung des gesamten Workflows bei J.S. Fenster & Türen
- Von der Anfrage bis zur Montage komplett digital abbilden
- Automatisierung wiederkehrender Aufgaben
- Datengetriebene Entscheidungen treffen können

---

## 📖 Lernfortschritt (Chronologisch)

### 🗓️ Session 1 - Grundlagen der KI (November 2024)

#### ✅ Gelernte Konzepte

**1. GPT (Generative Pre-trained Transformer)**
- Was ist ein Transformer-Modell?
- Wie funktioniert die Text-Generierung?
- Pre-training vs. Fine-tuning
- Unterschied zwischen verschiedenen Modellen

**2. Tokens**
- Was ist ein Token? (Text-Einheiten, nicht immer = Wörter)
- Warum sind Tokens wichtig?
- Token-Kosten und Effizienz
- Beispiel: "Fenster" = 1 Token, "Fens-ter-mon-tage" könnte 3-4 Tokens sein

**3. Context Window**
- Definition: Maximale Anzahl Tokens, die ein Modell "sehen" kann
- Claude's Context Window: 200.000 Tokens
- Natürliche Limits durch Context Window
- Warum wir strategisch überlegen müssen, was in den Context kommt

**4. Context Engineering**
- Definition: Die Wissenschaft, wie wir den Kontext der KI befüllen
- Strategien zur optimalen Kontext-Nutzung
- Was gehört in den Context, was nicht?
- Priorisierung von Informationen

**5. Agents (KI-Agenten)**
- Definition: KI-Systeme, die selbstständig Werkzeuge nutzen können
- Unterschied zwischen "normalem" LLM und Agent
- Werkzeug-Nutzung (Tool Use)
- Autonome Entscheidungen basierend auf Zielen

**6. CAG (Context Augmented Generation)**
- Dynamischer Zugriff auf externe Systeme
- Beispiel: SQL-Datenbank-Abfragen
  - Agent schreibt selbstständig SQL-Befehle
  - Extrahiert gezielte Informationen
  - Lädt diese in eigenes Context Window
- Erweiterung des "Wissens" durch externe Quellen

**7. RAG (Retrieval Augmented Generation)**
- Die "Königsklasse" der Kontext-Anreicherung
- Komplexere Variante als CAG
- Automatisches Suchen und Abrufen relevanter Informationen
- Vektorsuche und Embeddings (noch nicht im Detail behandelt)
- Dynamische Wissensbasis

**8. Praktische Werkzeuge**
- PDF-Upload und Verarbeitung
- Dateibasiertes Context Engineering
- Terminal/CMD/CLI als Schnittstelle zu Claude Code

#### 🎓 Verständnislevel
- **Theorie**: ✅ Fundiertes Grundverständnis vorhanden
- **Praxis**: 🟡 Erste Berührungspunkte, noch ausbaufähig
- **Eigenständigkeit**: 🟡 Beginnt gerade

#### 💡 Praktische Beispiele gesehen
- Claude Code Nutzung im Terminal
- Dashboard-Projekt als Übungsumgebung
- Erste Code-Snippets analysiert

---

### 🗓️ Session 2 - Budgetangebot V2 System (5. Februar 2026)

#### 📋 Was wurde gebaut?

Ein vollstaendiges **KI-gestuetztes Angebotswesen** fuer J.S. Fenster & Tueren:

**Workflow**: Freitext-Eingabe → GPT-5.2 (Reasoning) → Angebotspositionen → Professionelles Budgetangebot (PDF-ready HTML)

#### 🏗️ Systemarchitektur

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Dashboard      │────▶│  Supabase Edge       │────▶│  Supabase DB    │
│  (React/Vite)   │     │  Functions           │     │  (PostgreSQL)   │
└─────────────────┘     │  - budget-ki         │     │  - Positionen   │
                        │  - budget-dokument   │     │  - LV-Katalog   │
                        └──────────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────────┐
                        │  OpenAI GPT-5.2      │
                        │  (reasoning_effort)  │
                        └──────────────────────┘
```

#### ✅ Erstellte Komponenten

**1. Datenbank-Schema (10 Tabellen)**
- `budget_cases` - Anfragen/Faelle
- `budget_positionen` - Generierte Positionen
- `budget_dokumente` - Erzeugte Angebote
- `erp_rechnungen` + `erp_rechnungs_positionen` - Historische Rechnungsdaten
- `erp_angebote` + `erp_angebots_positionen` - Historische Angebotsdaten
- `leistungsverzeichnis` - Preis-Katalog fuer KI-Suche
- Row Level Security (RLS) fuer alle Tabellen

**2. Edge Functions (Deno/TypeScript)**
- `budget-ki/index.ts` - GPT-5.2 mit Function Calling
  - Reasoning Mode (`reasoning_effort: "low"`)
  - 55 Sekunden Timeout (AI braucht Zeit zum Denken)
  - Tool: `search_leistungsverzeichnis` - Sucht aehnliche Positionen
- `budget-dokument/index.ts` - HTML-Dokument-Generator
  - Professioneller A4-Briefkopf
  - Positionstabelle mit MwSt-Berechnung
  - "Budgetangebot" Stempel (Schaetzung, nicht bindend)

**3. Dashboard-Seite (React)**
- `Budgetangebot.jsx` - 4-Schritt-Wizard:
  1. **Eingabe**: Freitext + Kundenname + Optionen
  2. **Positionen**: Editierbare Tabelle mit Zubehoer
  3. **Zusammenfassung**: Preise, Konfidenz, Annahmen
  4. **Vorschau**: Fertiges HTML-Dokument

**4. Sync-Scripts (Node.js)**
- `sync-positions-to-supabase.js` - Rechnungspositionen aus Work4All
- `sync-angebots-positionen.js` - Angebotspositionen aus Work4All
- `build-leistungsverzeichnis.js` - Kategorisiert + aggregiert Positionen

#### 📊 Synchronisierte Daten

| Quelle | Anzahl | Positionen |
|--------|--------|------------|
| Rechnungen (ab 2025) | 381 | 3.315 |
| Angebote (ab 2024) | 831 | 6.772 |
| **Gesamt** | 1.212 | **10.087** |
| LV-Eintraege | - | **2.903** |

**14 Kategorien im Leistungsverzeichnis:**
fenster (753), haustuer (679), sonstiges (934), balkontuer (166), tuer (166), festfeld (67), montage (54), rollladen (29), psk (20), entsorgung (16), hst (15), insektenschutz (2), fensterbank (1), raffstore (1)

#### 🐛 Geloeste Bugs (Lernmomente!)

**Bug 1: Prefer Header (Teil 1)**
```javascript
// FALSCH: Exakter Vergleich schlaegt fehl bei kombinierten Headers
if (options.headers.Prefer === 'return=minimal') { ... }

// RICHTIG: Teilstring-Suche
if (options.headers.Prefer.includes('return=minimal')) { ... }
```
**Lektion**: HTTP Headers koennen mehrere Werte enthalten (kommasepariert).

**Bug 2: Prefer Header (Teil 2)**
```javascript
// FALSCH: Ueberschreibt den Default komplett
'Prefer': 'resolution=merge-duplicates'

// RICHTIG: Beide Direktiven kombinieren
'Prefer': 'resolution=merge-duplicates,return=minimal'
```
**Lektion**: Bei Supabase/PostgREST muss man Upsert UND Return-Verhalten angeben.

**Bug 3: PostgREST on_conflict**
```javascript
// FALSCH: PostgREST weiss nicht auf welchen Spalten
supabaseRequest('leistungsverzeichnis', 'POST', ...)

// RICHTIG: Unique-Constraint Spalten explizit angeben
supabaseRequest('leistungsverzeichnis?on_conflict=kategorie,bezeichnung', 'POST', ...)
```
**Lektion**: `resolution=merge-duplicates` gilt nur fuer Primary Key. Fuer andere Unique Constraints braucht man `?on_conflict=spalte1,spalte2`.

**Bug 4: Response Nesting**
```javascript
// Edge Function gibt zurueck:
{ success: true, data: { positionen: [...] } }

// Dashboard nach response.json():
const data = await response.json()
// data.positionen ist undefined!
// data.data.positionen ist richtig!
```
**Lektion**: Immer die tatsaechliche API-Response pruefen, nicht raten.

#### 🔧 Technologien & Konzepte

| Technologie | Einsatz |
|-------------|---------|
| **GPT-5.2** | Reasoning-Modell mit `reasoning_effort` Parameter |
| **Function Calling** | KI ruft selbst die Datenbank-Suche auf |
| **Supabase Edge Functions** | Serverless Deno-Runtime |
| **PostgREST** | REST-API fuer PostgreSQL (Prefer Headers!) |
| **React 19 + Vite 7** | Frontend Dashboard |
| **Cloudflare Tunnel** | Sichere Verbindung zu lokalem SQL Server |
| **mssql** | Node.js Connector fuer Work4All SQL Server |

#### 💡 Wichtige Erkenntnisse

1. **GPT-5.2 Reasoning braucht Zeit** - 55 Sekunden Timeout ist noetig
2. **Function Calling ist maechtig** - KI entscheidet selbst, wann sie die DB durchsucht
3. **Historische Daten sind Gold wert** - 10.087 echte Positionen als Preisreferenz
4. **Edge Functions sind schnell** - Kein eigener Server noetig
5. **Debugging = Response lesen** - Immer schauen was die API wirklich zurueckgibt

#### 🎓 Verstaendnislevel nach Session 2

- **Supabase/PostgREST**: ✅ Headers, Upsert, RLS verstanden
- **Edge Functions**: ✅ Deno, TypeScript, Secrets
- **React State**: ✅ Verschachtelte Responses richtig mappen
- **SQL Server Sync**: ✅ Work4All Daten nach Supabase
- **GPT Function Calling**: ✅ Tools definieren, KI ruft sie auf

---

## 🚀 Aktueller Stand: Technische Fähigkeiten

### Entwicklung & Programmierung
- [ ] HTML/CSS Grundlagen
- [ ] JavaScript Basics
- [ ] Node.js & Express.js
- [ ] APIs verstehen und nutzen
- [ ] Datenbanken (SQL)
- [ ] Git & Versionskontrolle
- [ ] Deployment & Hosting

### KI-Tools & Workflows
- [ ] Claude Code (Terminal-Nutzung)
- [ ] Prompt Engineering
- [ ] N8N Workflow-Automatisierung
- [ ] Webhook-Integration
- [x] API-Integration *(Session 2: Edge Functions + PostgREST)*
- [x] Supabase Backend-as-a-Service *(Session 2: DB, Edge Functions, RLS)*

### Projekt-Management
- [ ] Projekt-Strukturierung
- [ ] Dokumentation schreiben
- [ ] Testing & Debugging
- [ ] Iterative Entwicklung

---

## 📁 Projekte & Meilensteine

### Projekt 1: Dashboard-Grundgerüst ✅
**Status**: Abgeschlossen
**Gelernt**:
- Projekt-Struktur verstehen
- HTML/CSS/JS Zusammenspiel
- Express.js Server
- Statische Dateien ausliefern

**Dateien**:
- `server.js` - Backend
- `public/index.html` - Frontend
- `public/css/styles.css` - Styling
- `public/js/dashboard.js` - Interaktivität

### Projekt 2: Budgetangebot V2 (KI-gestuetzt) ✅
**Status**: Abgeschlossen (5. Februar 2026)
**Gelernt**:
- Supabase Edge Functions (Deno/TypeScript)
- GPT-5.2 mit Function Calling
- PostgREST Headers (Prefer, on_conflict)
- React State Management mit verschachtelten APIs
- Daten-Sync von SQL Server nach Supabase
- HTML-Dokument-Generierung

**Dateien**:
- `supabase/functions/budget-ki/index.ts` - KI-Positionsgenerierung
- `supabase/functions/budget-dokument/index.ts` - HTML-Angebotserstellung
- `dashboard/src/pages/Budgetangebot.jsx` - 4-Schritt-Wizard
- `backend/scripts/sync-*.js` - Work4All Daten-Sync
- `docs/supabase_budget_migration.sql` - Datenbank-Schema

**Live-URLs**:
- Dashboard: `http://localhost:3000/budgetangebot`
- Edge Functions: `https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/budget-*`

---

## 🔜 Nächste Schritte

### Kurzfristig (nächste Sessions)
- Erste praktische Claude Code Session
- Einfache Workflow-Integration
- Erstes Modul mit echter Funktionalität

### Mittelfristig (kommende Wochen)
- Datenbank-Integration
- API-Entwicklung
- N8N Workflow-Automatisierung
- Webhook-Integration

### Langfristig (Coaching-Ziel)
- Vollständiges Auftragsmanagement-System
- Angebotskalkulator mit PDF-Export
- Montageplanung mit Kalender
- Kundenportal
- Mobile App für Monteure

---

## 📝 Notizen & Erkenntnisse

### Session 1
- **Wichtigste Erkenntnis**: KI ist nicht "magisch" - es gibt klare technische Grenzen (Context Window)
- **Aha-Moment**: Agents können sich selbst Kontext beschaffen (CAG/RAG)
- **Nächster Fokus**: Von Theorie zu Praxis wechseln

---

## 🎯 Lernziele für kommende Sessions

### Technisch
- [ ] Erste eigenständige Anpassung am Dashboard vornehmen
- [ ] Ersten API-Endpunkt selbst schreiben
- [ ] Erste Datenbank-Abfrage durchführen
- [ ] Ersten N8N Workflow erstellen
- [ ] Ersten Webhook integrieren

### Konzeptionell
- [ ] RAG im Detail verstehen
- [ ] Embeddings & Vektorsuche
- [ ] Authentication & Authorization
- [ ] Deployment-Strategien
- [ ] Sicherheit & Best Practices

---

## 📚 Ressourcen & Links

### Dokumentation
- [README.md](./README.md) - Projekt-Übersicht
- Claude Code Dokumentation
- N8N Dokumentation

### Tools
- Claude Code (Terminal)
- VS Code oder bevorzugter Editor
- Node.js & npm
- Git

---

**Letzte Aktualisierung**: 5. Februar 2026
**Nächste Session**: TBD
**Version**: 2.0 (Budgetangebot V2 hinzugefuegt)
