# Auftragsmanagement - Web-App

> **Repo:** `https://github.com/JS-Fenster/Auftragsmanagement.git`
> **Zweck:** Web-Applikation fuer Auftragsverwaltung bei JS Fenster & Tueren

---

## Zentrale Wissensbasis (IMMER einlesen!)

> **Basis-Anweisungen:** `Z:/IT-Sammlung/KI_Automation/CLAUDE.md`
> **DB-Wissen:** `Z:/IT-Sammlung/KI_Automation/docs/ERP_Datenbank.md`
> **Ideen & Planung:** `Z:/IT-Sammlung/JS_Prozesse/CLAUDE.md`
> **Projektplan:** `docs/Auftragsmanagement_Projektplan.md`

---

## Projektstruktur

```
Auftragsmanagement/
├── backend/                # Node.js + Express API
│   ├── config/             # Datenbank-Konfiguration
│   ├── routes/             # API-Endpunkte
│   ├── server.js           # Express Server
│   └── .env.example        # Umgebungsvariablen Template
├── frontend/               # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/          # Seiten-Komponenten
│   │   ├── App.jsx         # Haupt-App mit Routing
│   │   └── main.jsx        # Entry Point
│   └── package.json
├── docs/
│   └── Auftragsmanagement_Projektplan.md
├── README.md               # Setup-Anleitung
├── SETUP_ANLEITUNG.md      # Detaillierte Installation
└── CLAUDE.md               # Diese Datei
```

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| **Backend** | Node.js, Express, mssql |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Datenbank** | SQL Server (Work4all ERP) |
| **Auth** | (geplant) JWT/Session-basiert |

---

## Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Dann Credentials eintragen
npm start             # Port 3001

# Frontend
cd frontend
npm install
npm run dev           # Port 3000
```

---

## API-Endpunkte

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/health` | GET | Health Check |
| `/api/customers` | GET | Alle Kunden |
| `/api/customers/:code` | GET | Einzelner Kunde |
| `/api/repairs` | GET | Alle Reparaturen |
| `/api/repairs/stats/overview` | GET | Statistiken |

---

## Entwicklungs-Roadmap

Siehe `docs/Auftragsmanagement_Projektplan.md` fuer Details.

| Phase | Status | Features |
|-------|--------|----------|
| MVP | ✅ | Kunden, Reparaturen, Dashboard |
| Auth | 🚧 | Login, Benutzer, Rollen |
| Outlook | ⏳ | Termin-Sync |
| Routen | ⏳ | Maps-Integration |
| VoiceBot | ⏳ | Automatische Termine |

---

## Verknuepfte Ideen (aus JS_Prozesse)

| # | Idee | Relevanz |
|---|------|----------|
| #9 | Reparatur-Verwaltung | Kern-Feature |
| #10 | Auftraege & Lieferungen | Kern-Feature |
| #11 | Terminfindung | Integration |
| #14 | Command Center | Spaeter integrieren |
| #22 | Routenplanung | Phase Routen |
| #58 | Web-Plattform | Basis |

---

## Changelog (Struktur-Aenderungen)

> **WICHTIG:** Bei relevanten Aenderungen hier dokumentieren!

| Datum | Aenderung | Details |
|-------|-----------|---------|
| 2025-12-12 | Repo neu strukturiert | Code aus `_archive/ReparaturPortal` uebernommen |
| 2025-12-12 | Projektplan hierher | `docs/Auftragsmanagement_Projektplan.md` |
| 2025-12-12 | node_modules entfernt | Nur Source-Code im Repo |
