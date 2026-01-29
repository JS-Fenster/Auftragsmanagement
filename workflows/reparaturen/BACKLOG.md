# BACKLOG - Reparatur-Workflow

> **Zweck:** Ideen und Features fuer spaetere Iterationen.
> Diese Punkte sind NICHT Teil des aktuellen MVP (Step 1).
> Stand: 2026-01-29

---

## Legende

| Prioritaet | Bedeutung |
|------------|-----------|
| HOCH | Sollte nach Step 1 als naechstes kommen |
| MITTEL | Wichtig, aber nicht dringend |
| NIEDRIG | Nice-to-have, irgendwann |

---

## Backlog-Items

### B-001: Automatisches Aging mit Eskalation

**Prioritaet:** HOCH
**Quelle:** ChatGPT-Session 2026-01-29

**Beschreibung:**
Das Konzept "Aging" (Auftraege die zu lange offen sind bekommen Flag + Prioritaets-Bonus) ist in der SPEC dokumentiert (Kap. 3.8). Die AUTOMATISCHE Umsetzung (Scheduled Job, automatisches Flag-Setzen, Dashboard-Sortierung) ist jedoch Step 2.

**Was fehlt fuer Automatisierung:**
- Scheduled Edge Function die taeglich/stuendlich prueft
- Berechnung "2 Arbeitswochen" (Wochenenden ausschliessen)
- Automatisches Setzen des Flags `ZU_LANGE_OFFEN`
- Dashboard-Sortierung nach Prioritaet + Aging-Flag

**Workaround Step 1:**
Manuelle Pruefung durch Disponent ("Welche Auftraege sind alt?")

---

### B-002: Fahrzeit-/Cluster-Heuristik (Geo-basiert)

**Prioritaet:** MITTEL
**Quelle:** ChatGPT-Session 2026-01-29

**Beschreibung:**
Regel: Termine mit >30 Min Einzelfahrt sind "Tour-Faelle" und sollten:
- Bevorzugt um 08:00 ab Lager starten
- Mit anderen Terminen in gleicher Richtung geclustert werden (ab 2 Termine = Cluster)
- Falls kein Cluster moeglich: Fix-Tour planen (Aging sorgt dafuer dass es irgendwann passiert)

**Was fehlt:**
- Geo-Daten fuer Kundenadressen (Koordinaten)
- Fahrzeit-Berechnung (Google Maps API oder aehnlich)
- Cluster-Algorithmus
- UI fuer Disponent ("Diese 3 Termine sind in Richtung X")

**Workaround Step 1:**
Manuelle Einschaetzung durch Disponent (Ortskenntnisse)

---

### B-003: Wetter-/Hitze-Constraints

**Prioritaet:** NIEDRIG
**Quelle:** ChatGPT-Session 2026-01-29

**Beschreibung:**
Aussenjobs (Raffstore, Markise, Aussenabdichtung) haben Wetter-Abhaengigkeiten:
- Nur bei trocken
- Nur bei >= 5°C
- Suedseite/Hitze: eher morgens planen

**Was fehlt:**
- Wetter-API Integration
- Feld `job_typ` (innen/aussen)
- Feld `himmelsrichtung` (optional)
- Automatische Terminvorschlags-Filterung basierend auf Wettervorhersage

**Workaround Step 1:**
Manuelle Einschaetzung + kurzfristige Terminverschiebung bei schlechtem Wetter

---

### B-004: Outlook-Integration (Kalender-Sync)

**Prioritaet:** NIEDRIG
**Quelle:** ChatGPT-Session 2026-01-29 / SPEC Kap. 5.2

**Beschreibung:**
Urspruenglich war Outlook-Sync als "GEPLANT" markiert. Nach Diskussion:
- Pilot soll OHNE Outlook starten
- Perspektivisch soll Outlook als Planungs-Zentrale ABGELOEST werden
- Sync kann spaeter OPTIONAL hinzugefuegt werden (fuer Uebergangszeit)

**Was fehlt:**
- Microsoft Graph API fuer Calendar
- Bidirektionaler Sync (Supabase <-> Outlook)
- Konflikt-Handling

**Workaround Step 1:**
Keine Outlook-Integration. Termine werden NUR im neuen System gefuehrt.

---

## Archiv (abgeschlossen oder verworfen)

*Noch keine Eintraege*

---

*Letzte Aktualisierung: 2026-01-29*
