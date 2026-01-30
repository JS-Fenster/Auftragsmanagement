# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-01-30 09:50
> Aktualisiert von: Programmierer (P015-PROG abgeschlossen)

---

## Nachtmodus

**Status:** AKTIV bis 2026-01-31 08:00
**Gestartet:** 2026-01-30 ~08:15
**Regeln:** Keine Rueckfragen, selbst entscheiden, alles dokumentieren

---

## BEKANNTES PROBLEM: Chrome MCP

**Status:** DEFEKT seit 2026-01-30
**Auswirkung:** Browser-Tests via mcp__claude-in-chrome__* nicht moeglich
**Workaround:** Frontend-Tests muessen HAENDISCH nachgeholt werden

**Ausstehende Tests (warten auf Chrome MCP Fix):**
- [ ] T004-TEST: Frontend Integration Browser-Test (Reparaturen-Liste live testen)
- [ ] T005-TEST: Neukunden-Formular im Browser testen
- [ ] T006-TEST: Auftrags-Detail Modal im Browser testen
- [ ] T007-TEST: Termin-Setzen Feature im Browser testen
- [ ] T008-TEST: Bestandskunden-Feature Browser-Test
- [ ] T009-TEST: Outcome SV1 + Termin SV2 Feature Browser-Test
- [ ] T010-TEST: Mannstaerke-Feature Browser-Test (NEU)

**Hinweis fuer Tester-Subagenten:**
Chrome MCP ist DEFEKT. Nicht versuchen, Browser-Tests durchzufuehren.
Fokus auf: Code-Review, Build-Tests, curl-API-Tests (funktionieren weiterhin)

---

## Aktueller Stand

**Phase:** UMSETZUNG Step 1 MVP - **FEATURE-KOMPLETT!**

**SPEC Version:** v1.3 (2026-01-29)
**Neue Features in v1.3:** Status-Ladder, Aging, No-Show, 2-Mann-Constraints, Rollout-Strategie

**Git:** Commit 4838d20 gepusht (Frontend komplett)
**API:** reparatur-api v1.5.0 (Version 6) deployed

---

## Meilenstein-Plan (Step 1 MVP)

| MS | Beschreibung | Status |
|----|--------------|--------|
| **1a** | Tabelle `reparatur_auftraege` erstellen | FERTIG |
| **1b** | Status-Ladder (ENUM + Constraints) | SKIP (in 2b) |
| **1c** | RLS + Indizes + Trigger | FERTIG (in 1a integriert) |
| **2a** | Edge Function: Auftrag erstellen | FERTIG + GETESTET |
| **2b** | Edge Function: Status-Transitions | FERTIG + GETESTET |
| **2c** | Edge Function: Aging-Flag setzen | FERTIG + GETESTET |
| **3a** | Zeitfenster-System | FERTIG + GETESTET |
| **3b** | Termin reservieren/bestaetigen | FERTIG + GETESTET |
| **3c** | No-Show-Handling | FERTIG (in 2b integriert) |
| **4a** | Frontend: Auftrags-Liste | FERTIG + BUILD OK |
| **4b** | Frontend: Auftrags-Detail | FERTIG + BUILD OK |
| **4c** | Frontend: Neukunden-Formular | FERTIG + BUILD OK |
| **4d** | Frontend: Bestandskunden-Feature | FERTIG + BUILD OK |
| **4e** | Frontend: Outcome SV1 + Termin SV2 | FERTIG + BUILD OK |
| **4f** | Frontend: Mannstaerke-Feature | FERTIG + BUILD OK (NEU) |
| 5a | Integration-Test via Chrome | BLOCKIERT (Chrome MCP defekt) |

---

## Aktueller Auftrag

**KEIN AUFTRAG AKTIV**

Step 1 MVP ist feature-komplett. Alle SOLL-Features implementiert:
- Neukunde anlegen
- Bestandskunde anlegen
- Status aendern
- Termin SV1 setzen
- Outcome SV1 setzen
- Termin SV2 setzen
- Mannstaerke setzen
- Aging-Flag
- No-Show-Handling

Naechste Schritte:
1. Browser-Tests wenn Chrome MCP wieder funktioniert
2. Git-Commit fuer Mannstaerke-Feature
3. Step 2 Planung (Outlook-Integration, Routen, VoiceBot)

---

## Letzter Abschlussbericht

### ABSCHLUSSBERICHT P015-PROG
**Datum:** 2026-01-30 09:50
**Agent:** Programmierer

#### Auftrag
Mannstaerke-Feature: Mannstaerke (1-Person-Job vs. 2-Mann-Job) im Detail-Modal setzen koennen.

#### Ergebnis
- [x] Erfolgreich

#### Was wurde gemacht

**Teil 1: API erweitert (reparatur-api v1.5.0)**
- Neuer Endpoint: `PATCH /reparatur/:id/mannstaerke`
  - Body: `{ mannstaerke: 1 oder 2 oder null, notiz?: "..." }`
  - null = Unbekannt (Wert zuruecksetzen)
  - Validierung: mannstaerke muss 1, 2 oder null sein
  - Notiz wird mit Mannstaerke-Info ins notizen-Feld geschrieben
  - Return: { id, mannstaerke, aktualisiert_am }
- Health-Check aktualisiert (Version 1.5.0, neuer Endpoint gelistet)
- Deploy erfolgreich: Version 6

**Teil 2: Frontend erweitert (AuftragsDetailModal in Reparaturen.jsx)**
- Neuer Bereich "Ressourcen-Planung" (nach Termin SV2, vor Status-Aenderung)
  - Anzeige aktuelle Mannstaerke (farbcodiert: blau=1, lila=2, grau=unbekannt)
  - Dropdown: "Unbekannt" / "1 - Solo (1 Person)" / "2 - Team (2 Personen)"
  - Info-Text: "2-Mann-Jobs: Grosse Rollos (>2m), Hebeschiebetuer, Markise, Geruest"
  - Optionales Notiz-Feld
  - Submit-Button "Mannstaerke speichern" (lila Design)
  - Success/Error Feedback
- Neue State-Variablen: mannstaerkeValue, mannstaerkeNotiz, mannstaerkeSubmitting, mannstaerkeError, mannstaerkeSuccess
- Handler: handleMannstaerkeSetzen
- Reset bei Modal-Open: Aktuellen Wert in Dropdown vorbelegen

**Teil 3: Build-Test**
- `npm run build`: PASS (build in 3.79s)

#### Probleme/Erkenntnisse
Keine. Nachtmodus: Keine Rueckfragen gestellt, alle Entscheidungen selbst getroffen.

#### Naechster Schritt (Vorschlag)
Step 1 MVP feature-komplett! Browser-Tests ausstehend (Chrome MCP defekt).

#### Log-Referenz
Dokumentiert in 03_LOG.md: [LOG-034] Zeilen 1905-1970

---

## Wartend auf

- [ ] T004-TEST: Frontend Integration Browser-Test (BLOCKIERT - Chrome MCP defekt)
- [ ] T008-TEST: Bestandskunden-Feature Browser-Test (BLOCKIERT - Chrome MCP defekt)
- [ ] T009-TEST: Outcome SV1 + Termin SV2 Feature Browser-Test (BLOCKIERT - Chrome MCP defekt)
- [ ] T010-TEST: Mannstaerke-Feature Browser-Test (BLOCKIERT - Chrome MCP defekt)
- [x] P011-PROG: Frontend Termin-Setzen im Detail-Modal - ABGESCHLOSSEN
- [x] P013-PROG: Bestandskunden-Feature (API + Frontend) - ABGESCHLOSSEN
- [x] P014-PROG: Outcome SV1 + Termin SV2 Feature - ABGESCHLOSSEN
- [x] P015-PROG: Mannstaerke-Feature (API + Frontend) - ABGESCHLOSSEN
- [ ] Telegram Bot Token als Secret (fuer spaeter)
- [ ] Cron-Job Konfiguration fuer reparatur-aging im Dashboard
- [x] P006-PROG: Aging Edge Function - ABGESCHLOSSEN
- [x] P007-PROG: Frontend Auftrags-Liste - ABGESCHLOSSEN
- [x] T003-TEST: Frontend Build + Code-Review - ABGESCHLOSSEN
- [x] P008-PROG: Neukunden-Formular - ABGESCHLOSSEN
- [x] P009-PROG: Auftrags-Detail Modal - ABGESCHLOSSEN
- [x] P010-PROG: Zeitfenster-System + Termin-Endpoint - ABGESCHLOSSEN
