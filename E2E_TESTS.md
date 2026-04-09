# E2E Tests — Auftragsmanagement

> **Typ:** INVASIV — wird bei Feature-Aenderungen ueberschrieben.
> **Zweck:** Beschreibt den aktuellen Soll-Zustand aller Features.
> **Nutzung:** Claude prueft nach jedem Feature diese Schritte per Chrome MCP oder Playwright.

---

## Smoke Tests (jede Session)

### Login
1. Navigiere zu `/login`
2. Email-Feld und Passwort-Feld sichtbar
3. Login-Button sichtbar
4. **Erwartung:** Keine Console-Errors

### Navigation (nach Login)
1. Cockpit `/cockpit` — laedt, KPI-Cards sichtbar
2. Kalender `/kalender` — laedt, Wochenansicht sichtbar
3. Projekte `/projekte` — laedt, Tabelle oder Pipeline sichtbar
4. Mitarbeiter `/mitarbeiter` — laedt, MA-Liste sichtbar
5. Finanzen `/finanzen` — laedt
6. Belege `/belege` — laedt
7. Objekte `/objekte` — laedt, Liste sichtbar
8. Lieferanten `/lieferanten` — laedt, Liste sichtbar
9. Kunden `/kunden` — laedt, Liste sichtbar
10. Dokumente `/dokumente` — laedt
11. Emails `/emails` — laedt
12. Einstellungen `/einstellungen` — laedt
13. **Erwartung:** Keine Console-Errors auf keiner Seite

---

## Kalender

### Termin erstellen
1. Navigiere zu `/kalender`
2. Doppelklick auf einen Tag in der Wochenansicht
3. Formular oeffnet sich
4. Kunde suchen (min. 3 Zeichen tippen)
5. Termin-Art waehlen
6. Uhrzeit setzen (Start + Ende)
7. Monteure zuweisen
8. Speichern
9. **Erwartung:** Termin erscheint in der Wochenansicht, Monteur-Badges sichtbar

### Termin Drag & Drop (Wochenansicht)
1. Termin greifen (8px Threshold beachten)
2. Auf anderen Tag/Bus ziehen
3. Ghost erscheint, Drop-Indicator sichtbar
4. Loslassen → Bestaetigungsdialog
5. Bestaetigen
6. **Erwartung:** Termin an neuer Position, alte Position leer

### Termin bearbeiten (Direct-Edit)
1. Klick auf existierenden Termin
2. Formular oeffnet sich mit vorausgefuellten Daten
3. Feld aendern (z.B. Uhrzeit)
4. Speichern
5. **Erwartung:** Aenderung sichtbar, Verlauf-Timeline zeigt Aenderung

### Termin stornieren
1. Termin oeffnen
2. "Stornieren" klicken
3. Optional: Grund eingeben
4. **Erwartung:** Termin als storniert markiert (nicht geloescht), Verlauf zeigt Storno

---

## Mitarbeiter

### Mitarbeiter-Detail aufrufen
1. Navigiere zu `/mitarbeiter`
2. Klick auf einen Mitarbeiter
3. **Erwartung:** Detail-Seite mit Tabs (Stammdaten, Vertrag, Skills, Persoenliches)

### Stammdaten bearbeiten
1. Auf Mitarbeiter-Detail
2. Feld aendern (z.B. Telefonnummer)
3. Speichern
4. **Erwartung:** Wert gespeichert, nach Reload noch da

### Arbeitszeiten Wochentag-Grid
1. Tab "Vertrag & Arbeitszeit"
2. Mo-Fr Grid sichtbar mit Start/Ende/Frei
3. Wert aendern
4. **Erwartung:** Auto-Stunden-Berechnung aktualisiert sich

### Abwesenheit erfassen
1. Tab "Urlaub & Abwesenheiten"
2. Art waehlen (z.B. Urlaub)
3. Datum Von/Bis setzen
4. Speichern
5. **Erwartung:** Eintrag in Liste, Status "beantragt"

---

## Jess (Chat)

### Nachricht senden
1. Chat-Widget oeffnen
2. Text eingeben
3. Senden
4. **Erwartung:** Antwort kommt, keine Fehlermeldung

### Quick-Actions
1. Chat-Widget oeffnen
2. Quick-Action Button klicken (z.B. "Heutige Termine")
3. **Erwartung:** Relevante Antwort mit Terminen

---

## Edge Cases (bei JEDEM Feature pruefen)

| Test | Wie |
|------|-----|
| Leere Felder | Formular ohne Eingabe absenden — Validierung? |
| Lange Texte | 500+ Zeichen in Freitext — Ueberlauf? |
| Umlaute | "Müller", "Größe", "Straße" — korrekt gespeichert + angezeigt? |
| Doppelklick | Button 2x schnell klicken — doppelter Submit? |
| Browser-Zurueck | Nach Speichern zurueck-Button — Crash? |
| Keine Daten | Seite ohne Daten laden — "Keine Eintraege" statt Crash? |
| Console-Errors | Nach JEDER Aktion pruefen |
| Network-Requests | POST/PATCH Status 200/201? Keine 4xx/5xx? |

---

*Letztes Update: 2026-04-09*
