# Netlify Migration - Auftragsmanagement

Diese Dokumentation beschreibt, was bei der Migration auf Netlify zu beachten ist.

---

## Aktuelle Architektur (Localhost)

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCALHOST SETUP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (localhost:3000)                                  │
│  React + Vite                                               │
│       │                                                     │
│       ├─────► Supabase (direkt)                            │
│       │       - ERP-Daten lesen                            │
│       │       - Workflow-Status lesen/schreiben            │
│       │                                                     │
│       └─────► Backend (localhost:3001)                     │
│               - POST /api/sync                              │
│               - Startet Python-Script                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Ziel-Architektur (Netlify)

```
┌─────────────────────────────────────────────────────────────┐
│                     NETLIFY SETUP                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (auftragsmanagement.netlify.app)                  │
│  React (statisch gebaut)                                    │
│       │                                                     │
│       ├─────► Supabase (direkt)                            │
│       │       - Funktioniert identisch!                     │
│       │                                                     │
│       └─────► Sync-Endpoint (???)                          │
│               - MUSS geloest werden!                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend-Migration (Einfach)

Das Frontend kann direkt deployed werden:

### 1. Build-Konfiguration

**netlify.toml** (im Root erstellen):
```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 2. Environment Variables (Netlify Dashboard)

```
VITE_SUPABASE_URL=https://rsmjgdujlpnydbsfuiek.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://??? (siehe Sync-Loesung unten)
```

### 3. Deploy-Schritte

1. GitHub Repository verbinden
2. Build-Settings wie oben konfigurieren
3. Environment Variables setzen
4. Deploy

---

## Sync-Endpoint (Problem!)

Das Python-Script kann NICHT auf Netlify laufen!

### Option A: Separater Server (Empfohlen)

Ein kleiner Server auf dem ERP-Server oder einem VPS:

```
ERP-Server (192.168.16.202)
├── sync_to_supabase.py (bereits vorhanden)
└── sync_api.py (NEU - Flask/FastAPI)
```

**sync_api.py** Beispiel:
```python
from flask import Flask, jsonify
import subprocess

app = Flask(__name__)

@app.route('/api/sync', methods=['POST'])
def sync():
    # Auth pruefen! (API Key oder Basic Auth)
    result = subprocess.run(['python', 'sync_to_supabase.py'], capture_output=True)
    return jsonify({
        'success': result.returncode == 0,
        'output': result.stdout.decode()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

Dann ueber Cloudflare Tunnel oder ngrok erreichbar machen.

### Option B: Scheduled Sync (Kein Button)

Statt manueller Sync:
- Windows Task Scheduler alle 5 Minuten
- Kein Sync-Button in der App
- Einfacher, aber weniger Kontrolle

### Option C: Netlify Function + Supabase Edge Function

Komplexer, aber serverless:
1. Netlify Function ruft Supabase Edge Function
2. Edge Function macht SQL-Queries zum ERP
3. Problem: ERP nicht aus Internet erreichbar

**Nicht empfohlen** fuer diesen Use-Case.

---

## RLS Policies (Row Level Security)

Supabase hat RLS aktiviert. Fuer Production:

### Aktuelle Situation
- Alle Tabellen haben RLS aktiviert
- Anon-Key funktioniert weil keine Policies definiert

### Fuer Production empfohlen

```sql
-- ERP-Tabellen: Nur lesen
ALTER TABLE erp_projekte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jeder kann ERP-Daten lesen" ON erp_projekte
  FOR SELECT USING (true);

-- Workflow-Tabellen: Lesen und Schreiben
ALTER TABLE auftrag_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jeder kann Status lesen" ON auftrag_status
  FOR SELECT USING (true);
CREATE POLICY "Jeder kann Status aendern" ON auftrag_status
  FOR ALL USING (true);
```

Bei Bedarf spaeter auf authentifizierte Benutzer einschraenken.

---

## Checkliste vor Migration

- [ ] GitHub Repository ist aktuell
- [ ] netlify.toml erstellt
- [ ] Sync-Loesung entschieden (A, B oder C)
- [ ] Falls Option A: Sync-API auf Server einrichten
- [ ] Environment Variables vorbereitet
- [ ] RLS Policies geprueft
- [ ] Test-Deployment auf Netlify

---

## Bekannte Unterschiede Localhost vs Netlify

| Feature | Localhost | Netlify |
|---------|-----------|---------|
| Frontend | `npm run dev` | Statischer Build |
| Supabase | Funktioniert | Funktioniert |
| Sync-Button | Express Backend | Externe Loesung noetig |
| Hot Reload | Ja | Nein (Deploy noetig) |

---

## Kontakt bei Problemen

- Supabase Dashboard: https://supabase.com/dashboard
- Netlify Dashboard: https://app.netlify.com
- Projekt-Repo: https://github.com/JS-Fenster/Auftragsmanagement
