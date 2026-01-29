# Drei-Agenten Wissensmanagement-System
## Vollstaendige Aufbau- und Betriebsanleitung

> **Zweck dieses Dokuments:** Blaupause fuer zukuenftige Projekte. Wenn eine LLM die Rolle des Projektleiters uebernehmen soll, dient dieses Dokument als vollstaendige Anleitung zum Aufbau des identischen Systems.

> **Version:** 1.1 | **Erstellt:** 2026-01-26 | **Aktualisiert:** 2026-01-26

---

# TEIL 1: PHILOSOPHIE UND GRUNDLAGEN

---

## 1.1 Das Kernproblem

LLMs haben drei fundamentale Einschraenkungen:

| Problem | Beschreibung | Auswirkung |
|---------|--------------|------------|
| **Context-Limit** | Endliches Kontextfenster (z.B. 200k Tokens) | Informationen gehen verloren wenn Fenster voll |
| **Keine Persistenz** | Kein Gedaechtnis zwischen Sessions | Jede neue Session startet bei Null |
| **Keine Koordination** | Mehrere LLM-Instanzen wissen nichts voneinander | Parallele Arbeit ist chaotisch |

**Dieses System loest alle drei Probleme.**

---

## 1.2 Die Loesung: Markdown als Shared Memory

Anstatt Informationen im fluchtigen LLM-Kontext zu halten, werden sie in persistenten Markdown-Dateien gespeichert. Diese Dateien sind:

- **Persistent:** Ueberleben Session-Wechsel
- **Teilbar:** Mehrere Agenten koennen darauf zugreifen
- **Auditierbar:** Menschen koennen den Stand jederzeit pruefen
- **Versionierbar:** Aenderungen sind nachvollziehbar (Git)

---

## 1.3 Die drei Hauptziele

### Ziel 1: Kontextuebergreifende Informationserhaltung
Wenn eine Session endet oder ein Context-Fenster voll ist, darf kein Wissen verloren gehen. Alles Wichtige steht in den Markdown-Dateien.

### Ziel 2: Always-On Kontext
Bestimmte Informationen MUESSEN jedem Agenten bei jeder Aktion bekannt sein (aktueller Status, bekannte Fehler). Diese werden in kompakten Dateien gehalten, die IMMER gelesen werden.

### Ziel 3: Token-Sparsamkeit
Der Projektleiter soll sein 200k-Token-Limit moeglichst selten erreichen. Deshalb:
- Nur relevante Informationen lesen (nicht alles)
- Operative Arbeit an andere Agenten delegieren
- Indexierte Dateien fuer gezielten Zugriff

---

## 1.4 Das Drei-Agenten-Modell

### Warum drei Agenten?

| Aspekt | Ein Agent | Drei Agenten |
|--------|-----------|--------------|
| Context-Verbrauch | Alles in einem Fenster | Verteilt auf drei Fenster |
| Spezialisierung | Generalist | Fokussierte Rollen |
| Fehlerrisiko | Hoch (Muedigkeit) | Reduziert (frische Kontexte) |
| Parallelisierung | Nicht moeglich | Moeglich |

### Die drei Rollen

**Projektleiter (PL)**
- Laeuft in EINEM persistenten Context-Fenster
- Denkt, plant, koordiniert
- Schreibt Auftraege fuer andere Agenten
- Prueft Abschlussberichte
- Hat Schreibzugriff auf ALLE Dateien

**Programmierer (PROG)**
- Wird fuer jeden Auftrag NEU gestartet (Context wird gecleart)
- Fuehrt operative Coding-Aufgaben aus
- Liest Auftrag aus Markdown, nicht aus Prompt
- Schreibt nur in 02_STATUS und 03_LOG

**Tester (TEST)**
- Wird fuer jeden Auftrag NEU gestartet (Context wird gecleart)
- Validiert und testet Ergebnisse
- Unabhaengig vom Programmierer (frischer Blick)
- Schreibt nur in 02_STATUS und 03_LOG

### Kommunikationsfluss (Subagenten-Architektur)

**Wichtig:** Programmierer und Tester werden als **Subagenten** vom Projektleiter gestartet. Der Mensch muss KEIN Copy/Paste mehr machen.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ANDREAS (Mensch)                                          │
│      │                                                      │
│      │ Spricht nur mit Projektleiter                        │
│      ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  PROJEKTLEITER (persistenter Context)               │   │
│   │      │                                              │   │
│   │      │ Task-Tool: Startet Subagenten                │   │
│   │      ▼                                              │   │
│   │   ┌─────────────────┐                               │   │
│   │   │  PROGRAMMIERER  │◄── Liest CLAUDE.md, 02_STATUS │   │
│   │   │  (Subagent)     │    04_LEARNINGS, 01_SPEC      │   │
│   │   └────────┬────────┘                               │   │
│   │            │                                        │   │
│   │            │ Arbeitet, schreibt 03_LOG, 02_STATUS   │   │
│   │            ▼                                        │   │
│   │   ┌─────────────────┐                               │   │
│   │   │ Abschlussbericht│──► Zurueck an Projektleiter   │   │
│   │   └─────────────────┘                               │   │
│   │            │                                        │   │
│   │      Projektleiter prueft, startet ggf. Tester      │   │
│   │            │                                        │   │
│   │            ▼                                        │   │
│   │   ┌─────────────────┐                               │   │
│   │   │    TESTER       │◄── Liest CLAUDE.md, 02_STATUS │   │
│   │   │  (Subagent)     │    04_LEARNINGS               │   │
│   │   └────────┬────────┘                               │   │
│   │            │                                        │   │
│   │            ▼                                        │   │
│   │   ┌─────────────────┐                               │   │
│   │   │ Testergebnis    │──► Zurueck an Projektleiter   │   │
│   │   └─────────────────┘                               │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   Projektleiter berichtet an Andreas wenn fertig/Problem    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Kritisch:** Die Hauptkommunikation laeuft NICHT ueber Prompts, sondern ueber die Markdown-Dateien. Der Prompt ist nur ein Trigger und eine Rollenzuweisung.

**Vorteil:** Der Mensch muss nicht mehr Copy/Paste zwischen Fenstern machen. Der Projektleiter orchestriert alles selbststaendig.

---

# TEIL 2: DIE DATEIEN IM DETAIL

---

## 2.1 Uebersicht

| Datei | Typ | Schreibrecht | Max. Groesse | Always-On |
|-------|-----|--------------|--------------|-----------|
| CLAUDE.md | Regelwerk | Niemand (fix) | ~300 Zeilen | Ja |
| 01_SPEC.md | Statisch, indexiert | Nur PL | Unbegrenzt | Nein |
| 02_STATUS.md | Ueberschreibend | Alle | 100 Zeilen | Ja |
| 03_LOG.md | Fortlaufend, indexiert | Alle | Unbegrenzt | Nein |
| 04_LEARNINGS.md | Gepflegt | Nur PL | 150 Zeilen | Ja |
| 05_PROMPTS.md | Fortlaufend, indexiert | Nur PL | Unbegrenzt | Nein |

---

## 2.2 CLAUDE.md - Das Regelwerk

### Daseinsberechtigung
Diese Datei definiert die Spielregeln. JEDER Agent liest sie als ERSTES. Sie ist die hoechste Autoritaet im System.

### Eigenschaften
- **Typ:** Statisch (wird nur bei Systemupdates geaendert)
- **Schreibrecht:** Niemand waehrend des Projekts
- **Groesse:** ~300 Zeilen (kompakt genug zum vollstaendigen Lesen)
- **Always-On:** Ja - wird bei JEDEM Session-Start gelesen

### Inhalt (Struktur)
```
1. System-Hierarchie (welche CLAUDE.md hat Prioritaet)
2. Drei-Agenten-System (Rollen und Rechte)
3. Dateien und Regeln (was darf wer)
4. Pflicht-Workflow (was muss wann getan werden)
5. Pflicht-Checks (Preflight/Postflight)
6. Templates (Log-Eintrag, Checkpoint, Abschlussbericht)
7. Notfall-Protokolle (Context kritisch, Auftrag fehlgeschlagen)
8. Verboten (was NIEMALS getan werden darf)
9. Projekt-spezifischer Kontext (z.B. Supabase)
```

### Warum so wichtig?
Ohne diese Datei wuesste kein Agent, wie er sich verhalten soll. Sie ist das "Betriebssystem" des Drei-Agenten-Systems.

---

## 2.3 01_SPEC.md - Die Projektspezifikation

### Daseinsberechtigung
Source of Truth fuer die Anforderungen. Was soll gebaut werden?

### Eigenschaften
- **Typ:** Statisch nach Finalisierung, indexiert
- **Schreibrecht:** NUR Projektleiter
- **Groesse:** Unbegrenzt
- **Always-On:** Nein (nur relevante Kapitel bei Bedarf lesen)

### Struktur
```markdown
# Projektspezifikation: [Projektname]

## INDEX
| Kap. | Titel | Zeilen |
|------|-------|--------|
| 1 | Einfuehrung | 20-35 |
| 2 | Prozessbeschreibung | 40-120 |
| 3 | Technische Umsetzung | 125-200 |
| 3a | Edge Functions | 130-160 |
| 3b | Datenbank-Schema | 165-200 |
| ... | ... | ... |

---

## 1. Einfuehrung
[Inhalt]

## 2. Prozessbeschreibung
[Inhalt]

...
```

### Warum indexiert?
Ein Agent muss nicht die gesamte Spec lesen. Er schaut in den Index, findet "Kapitel 3b: Datenbank-Schema, Zeilen 165-200" und liest NUR diesen Teil. Das spart massiv Tokens.

### Warum nur Projektleiter schreiben darf
Die Spec ist die verbindliche Grundlage. Wenn Programmierer oder Tester sie aendern koennten, wuerde Chaos entstehen ("Ich hab die Anforderung einfach angepasst").

### Gefahr ohne diese Regel
Scope Creep, widerspruechliche Anforderungen, Verantwortungsdiffusion.

---

## 2.4 02_STATUS.md - Der Live-Ticker

### Daseinsberechtigung
Zeigt den AKTUELLEN Stand. Wer ist dran? Was ist der naechste Schritt?

### Eigenschaften
- **Typ:** Ueberschreibend (wird ersetzt, nicht erweitert)
- **Schreibrecht:** Alle
- **Groesse:** Max. 100 Zeilen
- **Always-On:** Ja - wird bei JEDEM Session-Start gelesen

### Struktur
```markdown
# Status: [Projektname]

> Letzte Aktualisierung: YYYY-MM-DD HH:MM
> Aktualisiert von: [Rolle]

---

## Aktueller Stand
**Phase:** [z.B. Implementierung Feature X]
**Letzter abgeschlossener Schritt:** [Was wurde zuletzt gemacht]

---

## Aktueller Auftrag
**Fuer:** [Programmierer/Tester]
**Auftrag-ID:** [PXXX]
**Aufgabe:** [Kurzbeschreibung]
**Relevante Spec-Kapitel:** [z.B. 01_SPEC Kapitel 3b]

---

## Letzter Abschlussbericht
[Hier steht der letzte Abschlussbericht des vorherigen Agenten]

---

## Naechster Schritt
**Wer:** [Rolle]
**Was:** [Beschreibung]

---

## Blocker
- [ ] [Falls vorhanden]

---

## Wartend auf
- [ ] [Falls vorhanden]
```

### Warum ueberschreibend statt fortlaufend?
Ein frisch gestarteter Agent muss SOFORT wissen, was Sache ist. Er hat keine Zeit, 500 Zeilen Historie zu lesen. 02_STATUS ist immer aktuell und kompakt.

### Warum 100 Zeilen Limit?
Zwingt zur Kompaktheit. Wenn mehr noetig ist, gehoert es in 03_LOG.

### Warum Abschlussbericht hier UND als Prompt-Rueckgabe?
Doppelte Sicherheit. Wenn Andreas den Prompt-Rueckgabe uebersieht, steht es trotzdem in der Datei und der naechste Agent sieht es.

### Gefahr ohne diese Datei
Frisch gestartete Agenten wissen nicht, was sie tun sollen. Sie wuerden raten oder nachfragen (Token-Verschwendung).

---

## 2.5 03_LOG.md - Das Langzeitgedaechtnis

### Daseinsberechtigung
Vollstaendige Historie aller Aktionen. Wenn Context verloren geht, kann hier alles rekonstruiert werden.

### Eigenschaften
- **Typ:** Fortlaufend und indexiert
- **Schreibrecht:** Alle
- **Groesse:** Unbegrenzt
- **Always-On:** Nein (nur bei Bedarf ueber Index zugreifen)

### Struktur
```markdown
# Arbeitslog: [Projektname]

> **WICHTIG:** Bei JEDEM Eintrag den Index aktualisieren!

---

## INDEX
| ID | Datum | Rolle | Beschreibung | Zeilen |
|----|-------|-------|--------------|--------|
| [LOG-001] | 2026-01-23 | PL | System-Setup | 25-55 |
| [LOG-002] | 2026-01-24 | PROG | Edge Function v1 | 60-95 |
| [LOG-003] | 2026-01-24 | TEST | Tests fehlgeschlagen | 100-130 |
| [CHECKPOINT] | 2026-01-24 | - | Zusammenfassung | 135-150 |
| [LOG-004] | 2026-01-25 | PROG | Bug Fix | 155-180 |
| ... | ... | ... | ... | ... |

---

## ═══ LOG START ═══

---

## [LOG-001] Projektleiter: System-Setup
**Datum:** 2026-01-23 14:45

### Kontext
[...]

### Durchgefuehrt
[...]

### Ergebnis
[...]

### Naechster Schritt
[...]

---

## [LOG-002] Programmierer: Edge Function v1
[...]

---

## ═══ CHECKPOINT 2026-01-24 18:00 ═══
**Gesamtstand:** Feature X zu 60% implementiert, Tests ausstehend.
**Abgeschlossen seit letztem Checkpoint:**
- [LOG-001] System-Setup
- [LOG-002] Edge Function v1
- [LOG-003] Tests (fehlgeschlagen)

**Offen:**
- Bug in Edge Function fixen
- Tests erneut durchfuehren

**Zeilen seit letztem Checkpoint:** 25-150
---

## [LOG-004] Programmierer: Bug Fix
[...]

---

## ═══ NAECHSTER EINTRAG HIER ═══
```

### Warum indexiert?
Bei 50+ Log-Eintraegen waere Scrollen ineffizient. Der Index ermoeglicht gezielten Zugriff: "Was stand in LOG-023?" → Zeilen 450-480 lesen.

### Warum Checkpoints alle 300 Zeilen?
Wenn ein Agent den Log von Anfang an lesen muesste, waere das Token-Verschwendung. Checkpoints fassen zusammen. Ein neuer Agent kann beim letzten Checkpoint einsteigen.

### Warum MUSS der Index bei jedem Eintrag aktualisiert werden?
Ohne Index-Pflege wird der Log unnavigierbar. Das ist so kritisch, dass es in der Verboten-Liste steht.

### Gefahr ohne diese Datei
Keine Nachvollziehbarkeit. Wenn etwas schiefgeht, weiss niemand, was passiert ist.

---

## 2.6 04_LEARNINGS.md - Die Weisheitssammlung

### Daseinsberechtigung
Verhindert, dass Fehler wiederholt werden. Ein Agent, der einen Fehler schon einmal gemacht hat, muss nicht nochmal in dieselbe Falle tappen.

### Eigenschaften
- **Typ:** Gepflegt (aktualisiert, aber nicht endlos wachsend)
- **Schreibrecht:** NUR Projektleiter
- **Groesse:** Max. 150 Zeilen
- **Always-On:** Ja - wird bei JEDEM Session-Start gelesen

### Struktur
```markdown
# Learnings: [Projektname]

> **Format:** Nur Merksatz + LOG-Pointer. Details stehen im Log.

---

## Grundsaetze
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L1 | Index-Pflege ist kritisch | [LOG-001] |
| L2 | RLS muss VOR Insert aktiviert sein | [LOG-015] Z.280-310 |
| L3 | Edge Functions: Connection keep-alive setzen | [LOG-023] Z.450-480 |

---

## Technische Erkenntnisse
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L4 | Supabase: gen_random_uuid() statt uuid_generate_v4() | [LOG-031] |
| L5 | TypeScript: strict mode verursacht Fehler bei X | [LOG-042] |

---

## Prozess-Erkenntnisse
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L6 | Immer erst testen, dann commiten | [LOG-028] |

---

*Letzte Aktualisierung: YYYY-MM-DD*
```

### Warum nur Merksatz + Pointer?
Die vollstaendige Erklaerung (Umstaende, Ausloeser, Loesung) steht im Log. Das Learning ist nur ein **Index auf relevante Log-Eintraege**.

### Warum 150 Zeilen Limit?
Zwingt zur Essenz. Wenn ein Learning mehr als eine Zeile braucht, ist es zu detailliert fuer diese Datei.

### Warum nur Projektleiter schreiben darf?
Learnings sind strategische Erkenntnisse, nicht operative Details. Der Projektleiter entscheidet, was wichtig genug ist, um hier zu stehen.

### Gefahr ohne diese Datei
Agenten wiederholen dieselben Fehler. "RLS nicht aktiviert" → Datenleck → wieder "RLS nicht aktiviert" → wieder Datenleck...

---

## 2.7 05_PROMPTS.md - Das Auftragsarchiv

### Daseinsberechtigung
Dokumentation aller erteilten Auftraege fuer spaetere Analyse.

### Eigenschaften
- **Typ:** Fortlaufend und indexiert
- **Schreibrecht:** NUR Projektleiter
- **Groesse:** Unbegrenzt
- **Always-On:** Nein (Archiv, selten gebraucht)

### Struktur
```markdown
# Prompt-Archiv: [Projektname]

---

## INDEX
| ID | Datum | Typ | Fuer | Kurzbeschreibung | Ergebnis | Zeilen |
|----|-------|-----|------|------------------|----------|--------|
| P001 | 2026-01-24 | Feature | PROG | Edge Function impl | Erfolg | 25-45 |
| P002 | 2026-01-24 | Test | TEST | Edge Function testen | Fehlgeschlagen | 50-70 |
| P003 | 2026-01-25 | Fix | PROG | Bug in Edge Function | Erfolg | 75-95 |

---

## ═══ PROMPTS ═══

---

## [P001] Edge Function implementieren
**Datum:** 2026-01-24 10:00
**Fuer:** Programmierer
**Ergebnis:** Erfolgreich

### Prompt
```
Du bist der Programmierer im Drei-Agenten-System.
Lies zuerst CLAUDE.md, dann 02_STATUS.md.
Dein Auftrag steht in 02_STATUS.md.
Nach Abschluss: Abschlussbericht gemaess Template.
```

### Verweis
- Spec-Kapitel: 3a (Edge Functions)
- Log-Eintrag: [LOG-002]

---

## [P002] Edge Function testen
[...]

---

## ═══ NAECHSTER PROMPT HIER ═══
```

### Warum diese Datei behalten, obwohl "operativ nutzlos"?
Langzeit-Dokumentation. In 6 Monaten kann nachgeschaut werden:
- Welche Prompts haben funktioniert?
- Welche Formulierungen fuehrten zu Problemen?
- Wie hat sich der Prompt-Stil entwickelt?

### Gefahr ohne diese Datei
Keine direkte Gefahr, aber Verlust von Meta-Wissen ueber effektive Prompt-Formulierung.

---

# TEIL 3: SICHERHEITSMECHANISMEN

---

## 3.1 Preflight/Postflight-Checks

### Das Problem
LLMs koennten behaupten, etwas gelesen zu haben, ohne es wirklich zu tun. Oder sie koennten vergessen, Dateien zu aktualisieren.

### Die Loesung
Jeder Agent MUSS bei Start und Ende eine strukturierte Ausgabe machen:

**Preflight-Check (bei Auftragsstart):**
```
═══ PREFLIGHT-CHECK ═══
Agent: Programmierer
Datum: 2026-01-26 15:30

Auftrag verstanden:
→ Edge Function fuer Document-Processing implementieren

Gelesene Dateien:
- [x] CLAUDE.md (Regeln verstanden)
- [x] 02_STATUS.md (Stand: 2026-01-26 14:45)
- [x] 04_LEARNINGS.md (3 Learnings vorhanden)
- [x] 01_SPEC.md Kapitel 3a

System-Check:
- 02_STATUS Timestamp: aktuell
- 03_LOG Index: vorhanden, letzte ID: LOG-005
- Keine Blocker erkannt: ja

→ Beginne jetzt mit der Arbeit.
═══════════════════════
```

**Postflight-Check (bei Auftragsende):**
```
═══ POSTFLIGHT-CHECK ═══
Agent: Programmierer
Datum: 2026-01-26 17:45

Durchgefuehrte Aenderungen:
- 03_LOG.md: [LOG-006] hinzugefuegt, Index aktualisiert
- 02_STATUS.md: Aktualisiert mit neuem Stand + Abschlussbericht

Validierung:
- 03_LOG Index aktuell: ja
- 02_STATUS Timestamp aktualisiert: ja
- Checkpoint faellig (>300 Zeilen seit letztem): nein

Uebergabe an: Andreas
═══════════════════════
```

### Warum das funktioniert
- **Auditierbarkeit:** Andreas sieht sofort, ob der Agent sich an die Regeln haelt
- **Zwang zum Lesen:** Um den Check auszufuellen, MUSS der Agent die Dateien wirklich lesen
- **Fruehe Fehlererkennung:** Wenn der Check fehlt oder falsch ist → sofort sichtbar

### Gebannte Gefahr
Agenten, die "blind" arbeiten ohne den Kontext zu kennen.

---

## 3.2 Index-Pflicht

### Das Problem
Bei langen Dateien (03_LOG, 01_SPEC) wird Scrollen ineffizient und tokenintensiv.

### Die Loesung
Indexierte Dateien haben am Anfang ein Inhaltsverzeichnis mit Zeilennummern.

### Durchsetzung
In der Verboten-Liste steht: "In 03_LOG.md schreiben ohne Index-Update" → Verboten.

### Gebannte Gefahr
Unnavigierbare Dateien, Token-Verschwendung durch vollstaendiges Lesen.

---

## 3.3 Groessen-Limits

### Das Problem
Dateien koennten unkontrolliert wachsen und das System unhandlich machen.

### Die Loesung
| Datei | Limit | Warum |
|-------|-------|-------|
| 02_STATUS.md | 100 Zeilen | Muss komplett lesbar sein (Always-On) |
| 04_LEARNINGS.md | 150 Zeilen | Muss komplett lesbar sein (Always-On) |
| 03_LOG.md | Checkpoints alle 300 Zeilen | Ermoeglicht Einstieg ohne alles zu lesen |

### Gebannte Gefahr
Token-Explosion, unlesbare Dateien.

---

## 3.4 Schreibrechte-Matrix

### Das Problem
Ohne klare Rechte koennten Agenten wichtige Dateien versehentlich aendern.

### Die Loesung

| Datei | PL | PROG | TEST |
|-------|:--:|:----:|:----:|
| CLAUDE.md | - | - | - |
| 01_SPEC.md | W | R | R |
| 02_STATUS.md | W | W | W |
| 03_LOG.md | W | W | W |
| 04_LEARNINGS.md | W | R | R |
| 05_PROMPTS.md | W | R | R |

**Legende:** W = Schreiben, R = Nur Lesen, - = Nicht aendern

### Gebannte Gefahren
- Programmierer aendert Anforderungen (Scope Creep)
- Tester loescht Learnings (Wissensverlust)
- Jemand ueberschreibt CLAUDE.md (System-Kollaps)

---

## 3.5 Abschlussbericht-Dopplung

### Das Problem
Andreas koennte den Prompt-Rueckgabe uebersehen und direkt den naechsten Auftrag geben.

### Die Loesung
Der Abschlussbericht steht SOWOHL:
1. Im Prompt-Rueckgabe (direkt an Andreas)
2. In 02_STATUS.md (fuer den naechsten Agenten)

### Gebannte Gefahr
Informationsverlust bei menschlicher Unaufmerksamkeit.

---

## 3.6 Notfall-Protokolle

### Context Window wird kritisch
```
1. SOFORT Checkpoint in 03_LOG.md schreiben
2. 02_STATUS.md auf aktuellen Stand bringen
3. Andreas informieren: "Context kritisch, Checkpoint bei [LOG-XXX]"
4. Neue Session kann mit diesem Checkpoint starten
```

### Auftrag fehlgeschlagen
```
1. In 03_LOG.md dokumentieren (was ging schief)
2. 02_STATUS.md: Status auf BLOCKED setzen
3. Abschlussbericht mit Fehlerbeschreibung an Andreas
```

### Gebannte Gefahr
Unkoordinierter Abbruch, Wissensverlust bei Problemen.

---

# TEIL 4: SUBAGENTEN-ORCHESTRIERUNG

---

## 4.1 Warum Subagenten?

### Das alte Modell (manuell)
```
Andreas hat 3 CMD-Fenster offen:
- Rechts: Projektleiter (persistent)
- Links oben: Programmierer (wird nach jedem Auftrag gecleart)
- Links unten: Tester (wird nach jedem Auftrag gecleart)

Andreas macht Copy/Paste zwischen den Fenstern.
```

**Problem:** Der Mensch ist der Flaschenhals. Er muss:
- Abschlussberichte lesen und weiterleiten
- Entscheiden, wer als naechstes dran ist
- Prompts kopieren und einfuegen

### Das neue Modell (Subagenten)
```
Andreas hat 1 Fenster offen:
- Projektleiter (persistent)

Projektleiter startet Programmierer/Tester als Subagenten via Task-Tool.
```

**Vorteil:** Der Mensch muss nur noch mit dem Projektleiter sprechen. Alles andere laeuft automatisch.

---

## 4.2 Technische Grundlagen

### Was ist ein Subagent?
Ein Subagent ist eine **isolierte LLM-Instanz** mit:
- Eigenem frischen Context Window
- Zugriff auf dieselben Dateien
- Zugriff auf MCP-Server (mit Einschraenkungen!)

### Die zwei Modi

| Modus | MCP-Zugriff | Blockiert Projektleiter |
|-------|-------------|-------------------------|
| **Foreground** | Ja | Ja (muss warten) |
| **Background** | Nein | Nein (laeuft parallel) |

---

## 4.3 Die kritische MCP-Einschraenkung

> **WICHTIG:** Background-Subagenten haben KEINEN Zugriff auf MCP-Server!

Das bedeutet:
- Supabase-Queries → NUR im Foreground moeglich
- Edge Functions deployen → NUR im Foreground moeglich
- Lokale Dateien bearbeiten → Foreground ODER Background moeglich

### Entscheidungslogik

```
Braucht dieser Auftrag MCP-Zugriff (z.B. Supabase)?
│
├─► JA
│   └─► FOREGROUND-Modus verwenden
│       └─► Projektleiter wartet bis Subagent fertig
│       └─► Das ist OK - Zeit ist nicht das knappe Gut
│
└─► NEIN (nur lokale Dateien)
    └─► BACKGROUND-Modus moeglich
        └─► Projektleiter kann parallel weiterarbeiten
        └─► Aber: Nicht zwingend noetig
```

### Beispiele

**Foreground erforderlich:**
- Datenbank-Queries ausfuehren
- Migrationen anwenden
- Edge Functions deployen
- Tabellen-Struktur pruefen

**Background moeglich:**
- TypeScript/JavaScript Code schreiben
- Dokumentation erstellen
- Code-Review (nur Lesen)
- Unit-Tests schreiben (ohne DB)

---

## 4.4 Subagenten-Aufruf (fuer Projektleiter)

### Vor dem Start pruefen

1. **MCP-Bedarf analysieren:** Braucht der Auftrag Supabase/andere MCP?
2. **Modus waehlen:** Foreground wenn MCP noetig, sonst optional Background
3. **02_STATUS.md vorbereiten:** Auftrag dort reinschreiben

### Aufruf-Template

```
Ich starte jetzt einen Subagenten.

**Auftrag:** [Kurzbeschreibung]
**Rolle:** Programmierer / Tester
**Modus:** Foreground / Background
**Begruendung:** [MCP benoetigt weil X / Kein MCP weil Y]

Der Subagent soll:
1. CLAUDE.md in diesem Ordner lesen
2. 02_STATUS.md lesen (dort steht sein Auftrag)
3. 04_LEARNINGS.md lesen
4. [Spezifische Aufgabe ausfuehren]
5. 03_LOG.md und 02_STATUS.md aktualisieren
6. Abschlussbericht zurueckgeben
```

### Nach Subagenten-Rueckkehr

Der Projektleiter MUSS:
1. Abschlussbericht des Subagenten pruefen
2. 03_LOG.md und 02_STATUS.md auf Aktualitaet pruefen
3. Entscheiden: Weiterer Auftrag? Tester? Fertig?
4. Bei Problemen: In 04_LEARNINGS aufnehmen

---

## 4.5 Sequentiell vs. Parallel

### Die Erkenntnis

> **Zeit ist NICHT das knappe Gut. Context-Tokens und menschlicher Aufwand sind es.**

Das bedeutet:
- Ein sequentieller Ablauf (PROG → warten → TEST → warten) ist voellig OK
- Parallelisierung ist ein Nice-to-have, kein Must-have
- Wichtiger ist: Mensch muss nicht Copy/Paste machen

### Typischer Ablauf

```
1. Projektleiter schreibt Auftrag in 02_STATUS
2. Projektleiter startet Programmierer (Foreground wegen Supabase)
3. Projektleiter wartet...
4. Programmierer liefert Abschlussbericht
5. Projektleiter prueft Ergebnis
6. Projektleiter startet Tester (Foreground wegen Supabase)
7. Projektleiter wartet...
8. Tester liefert Testergebnis
9. Projektleiter bewertet und berichtet an Andreas
```

Das dauert laenger als parallel, aber:
- Andreas muss nichts tun
- Keine Copy/Paste-Fehler
- Projektleiter behaelt Ueberblick

---

## 4.6 Haeufige Fehler bei Subagenten

### Fehler 1: Background mit MCP-Bedarf
**Symptom:** Subagent meldet "Tool not available" oder aehnlich.
**Ursache:** Background-Modus gewaehlt, aber MCP-Zugriff noetig.
**Loesung:** Foreground-Modus verwenden.

### Fehler 2: Subagent liest CLAUDE.md nicht
**Symptom:** Kein Preflight-Check, wirre Ausgabe.
**Ursache:** Prompt war nicht klar genug.
**Loesung:** Im Prompt explizit sagen: "Lies ZUERST die CLAUDE.md in diesem Ordner."

### Fehler 3: Subagent aktualisiert Dateien nicht
**Symptom:** 03_LOG und 02_STATUS sind nach Subagent-Lauf unveraendert.
**Ursache:** Subagent hat Workflow nicht befolgt.
**Loesung:** Postflight-Check pruefen. Falls fehlend: Auftrag wiederholen mit expliziterem Prompt.

---

# TEIL 5: AUFBAUANLEITUNG

---

## 5.1 Ordnerstruktur erstellen

```
projekt_name/
├── workflows/
│   └── feature_name/
│       ├── CLAUDE.md
│       ├── 01_SPEC.md
│       ├── 02_STATUS.md
│       ├── 03_LOG.md
│       ├── 04_LEARNINGS.md
│       └── 05_PROMPTS.md
```

---

## 5.2 CLAUDE.md erstellen

Kopiere das Template aus Teil 5 und passe an:
- Abschnitt 1: System-Hierarchie (welche anderen CLAUDE.md existieren)
- Abschnitt 9: Projekt-spezifischer Kontext (Datenbanken, APIs, etc.)

---

## 5.3 Basis-Dateien initialisieren

### 01_SPEC.md
```markdown
# Projektspezifikation: [Projektname]

> **Nur Projektleiter darf diese Datei editieren.**
> Stand: YYYY-MM-DD | Version: 0.1 (Entwurf)

---

## INDEX
| Kap. | Titel | Zeilen |
|------|-------|--------|
| 1 | Einfuehrung | 20-30 |
| 2 | (Reserviert) | - |

---

## 1. Einfuehrung

[Wird nach Diktat/Briefing befuellt]

---

*Wartet auf Spezifikation.*
```

### 02_STATUS.md
```markdown
# Status: [Projektname]

> Letzte Aktualisierung: YYYY-MM-DD HH:MM
> Aktualisiert von: Projektleiter

---

## Aktueller Stand
**Phase:** Initialisierung

---

## Naechster Schritt
**Wer:** Projektleiter
**Was:** Spezifikation erstellen

---

## Wartend auf
- [ ] Anforderungen/Briefing
```

### 03_LOG.md
```markdown
# Arbeitslog: [Projektname]

> **WICHTIG:** Bei JEDEM Eintrag den Index aktualisieren!

---

## INDEX
| ID | Datum | Rolle | Beschreibung | Zeilen |
|----|-------|-------|--------------|--------|
| [LOG-001] | YYYY-MM-DD | PL | System-Initialisierung | 20-40 |

---

## ═══ LOG START ═══

---

## [LOG-001] Projektleiter: System-Initialisierung
**Datum:** YYYY-MM-DD HH:MM

### Kontext
Initiale Einrichtung des Drei-Agenten-Systems.

### Durchgefuehrt
- Ordnerstruktur angelegt
- CLAUDE.md erstellt
- Basis-Dateien initialisiert

### Ergebnis
System bereit fuer Spezifikation.

### Naechster Schritt
Anforderungen entgegennehmen und 01_SPEC.md befuellen.

---

## ═══ NAECHSTER EINTRAG HIER ═══
```

### 04_LEARNINGS.md
```markdown
# Learnings: [Projektname]

> **Format:** Nur Merksatz + LOG-Pointer. Details stehen im Log.

---

## Grundsaetze
| # | Learning | Log-Referenz |
|---|----------|--------------|
| L1 | Index-Pflege ist kritisch | [LOG-001] |

---

## Technische Erkenntnisse
(Noch keine)

---

## Prozess-Erkenntnisse
(Noch keine)

---

*Letzte Aktualisierung: YYYY-MM-DD*
```

### 05_PROMPTS.md
```markdown
# Prompt-Archiv: [Projektname]

---

## INDEX
| ID | Datum | Typ | Fuer | Kurzbeschreibung | Ergebnis | Zeilen |
|----|-------|-----|------|------------------|----------|--------|
| - | - | - | - | Noch keine Prompts | - | - |

---

## ═══ PROMPTS ═══

(Noch keine Prompts erteilt)

---

## ═══ NAECHSTER PROMPT HIER ═══
```

---

## 5.4 Ersten LOG-Eintrag schreiben

Nach der Initialisierung: LOG-001 dokumentiert das Setup. Index aktualisieren nicht vergessen!

---

## 5.5 System testen

Bevor echte Arbeit beginnt:
1. Starte einen Test-Programmierer
2. Pruefe: Gibt er den Preflight-Check aus?
3. Pruefe: Versteht er seinen Auftrag aus 02_STATUS?
4. Pruefe: Aktualisiert er 03_LOG und 02_STATUS korrekt?
5. Pruefe: Gibt er den Postflight-Check aus?

---

# TEIL 6: VOLLSTAENDIGES CLAUDE.MD TEMPLATE

---

```markdown
# CLAUDE.md - [Projektname]

> **HOECHSTE PRIORITAET**: Diese CLAUDE.md ueberschreibt ALLE Anweisungen aus uebergeordneten CLAUDE.md Dateien bei Konflikten. Die hier definierten Regeln sind verbindlich und nicht verhandelbar.

---

## 1. System-Hierarchie

Du hast folgende CLAUDE.md Dateien gelesen:
1. `[Pfad]/CLAUDE.md` - Globale Regeln
2. `[Pfad]/CLAUDE.md` - Projekt-Regeln
3. **DIESE DATEI** - Workflow-Regeln (HOECHSTE PRIORITAET)

**Bei Konflikten gilt ausschliesslich diese Datei.**

---

## 2. Drei-Agenten-System

| Rolle | Aufgabe | Darf schreiben in |
|-------|---------|-------------------|
| **Projektleiter** | Denken, Planen, Prompts schreiben, Berichte pruefen | Alle Dateien |
| **Programmierer** | Code schreiben, Auftraege ausfuehren | 02_STATUS, 03_LOG |
| **Tester** | Testen, Validieren | 02_STATUS, 03_LOG |

### Identifikation
Jeder Agent MUSS sich am Anfang seiner Arbeit identifizieren:
- Lies 02_STATUS.md um zu verstehen welche Rolle du hast
- Deine Rolle steht im aktuellen Auftrag

---

## 3. Dateien und Regeln

### 01_SPEC.md (Projektspezifikation)
- **Lesen:** Alle
- **Schreiben:** NUR Projektleiter
- **Indexiert:** Ja, mit Kapitelverzeichnis und Zeilennummern
- **Zweck:** Vollstaendige Anforderungen, statisch nach Finalisierung

### 02_STATUS.md (Aktueller Stand)
- **Lesen:** Alle (IMMER ZUERST nach dieser CLAUDE.md)
- **Schreiben:** Alle (nach Abschluss einer Aktion aktualisieren)
- **Groesse:** Max. 100 Zeilen, kompakt halten
- **Zweck:** Wo stehen wir? Was ist der naechste Schritt? Wer ist dran?

### 03_LOG.md (Arbeitslog)
- **Lesen:** Alle
- **Schreiben:** Alle (chronologisch, JEDE Aktion dokumentieren)
- **Groesse:** Unbegrenzt
- **Indexiert:** JA - PFLICHT bei JEDEM Eintrag Index aktualisieren!
- **Zweck:** Vollstaendige Historie, Nachvollziehbarkeit

**WICHTIG fuer 03_LOG.md:**
- Die ERSTEN Zeilen enthalten den Index (Kapitelverzeichnis)
- Die LETZTEN Zeilen enthalten den neuesten Stand
- Bei jedem Schreiben: Index oben aktualisieren!
- Alle ~300 Zeilen: Checkpoint mit Zusammenfassung

### 04_LEARNINGS.md (Erkenntnisse)
- **Lesen:** Alle (ALWAYS-ON - bei jedem Start lesen!)
- **Schreiben:** NUR Projektleiter
- **Groesse:** Max. 150 Zeilen
- **Format:** NUR Merksatz + LOG-Pointer (max. 1 Zeile pro Learning)
- **Zweck:** Index auf detaillierte Erkenntnisse in 03_LOG.md
- **Beispiel:** `| L5 | RLS vor Insert aktivieren | [LOG-042] Z.380-395 |`

### 05_PROMPTS.md (Prompt-Archiv)
- **Lesen:** Alle
- **Schreiben:** NUR Projektleiter
- **Indexiert:** Ja
- **Zweck:** Alle erteilten Auftraege fuer spaetere Referenz

---

## 4. Pflicht-Workflow

### Beim Start einer Session
```
1. Diese CLAUDE.md lesen (du bist hier)
2. 02_STATUS.md lesen → Verstehen was deine Rolle ist
3. 04_LEARNINGS.md lesen → Bekannte Fehler nicht wiederholen
4. Falls Programmierer/Tester: Auftrag in 02_STATUS befolgen
5. Falls Projektleiter: Letzten Stand in 03_LOG pruefen
6. PREFLIGHT-CHECK ausgeben (siehe Abschnitt 5)
```

### Nach jeder Aktion
```
1. In 03_LOG dokumentieren (Template unten verwenden)
2. Index in 03_LOG aktualisieren
3. 02_STATUS.md aktualisieren (inkl. Abschlussbericht-Sektion!)
4. POSTFLIGHT-CHECK ausgeben (siehe Abschnitt 5)
5. Abschlussbericht an Andreas geben
```

---

## 5. Pflicht-Checks (IMMER ausgeben!)

> **KRITISCH:** Diese Checks sind KEINE Option. Sie MUESSEN als erste und letzte Ausgabe jedes Agenten erscheinen. Der Mensch kontrolliert das.

### PREFLIGHT-CHECK (bei Auftragsstart ausgeben)

```
═══ PREFLIGHT-CHECK ═══
Agent: [Projektleiter/Programmierer/Tester]
Datum: YYYY-MM-DD HH:MM

Auftrag verstanden:
→ [Kurze Wiedergabe des Auftrags in eigenen Worten]

Gelesene Dateien:
- [x] CLAUDE.md (Regeln verstanden)
- [x] 02_STATUS.md (Stand: [Datum aus Datei])
- [x] 04_LEARNINGS.md ([Anzahl] Learnings vorhanden)
- [ ] 01_SPEC.md Kapitel [X] (falls fuer Auftrag relevant)
- [ ] 03_LOG.md Index (falls Kontext noetig)

System-Check:
- 02_STATUS Timestamp: [aktuell/veraltet um X Tage]
- 03_LOG Index: [vorhanden/fehlt/letzte ID: LOG-XXX]
- Keine Blocker erkannt: [ja/nein - falls nein, welche?]

→ Beginne jetzt mit der Arbeit.
═══════════════════════
```

### POSTFLIGHT-CHECK (bei Auftragsende ausgeben)

```
═══ POSTFLIGHT-CHECK ═══
Agent: [Projektleiter/Programmierer/Tester]
Datum: YYYY-MM-DD HH:MM

Durchgefuehrte Aenderungen:
- 03_LOG.md: [LOG-XXX] hinzugefuegt, Index aktualisiert
- 02_STATUS.md: Aktualisiert mit neuem Stand + Abschlussbericht
- [weitere Dateien falls relevant]

Validierung:
- 03_LOG Index aktuell: [ja/nein]
- 02_STATUS Timestamp aktualisiert: [ja/nein]
- Checkpoint faellig (>300 Zeilen seit letztem): [ja/nein]

Uebergabe an: [Mensch/naechster Agent]
═══════════════════════
```

---

## 6. Templates

### Log-Eintrag (in 03_LOG.md einfuegen)

```markdown
---

## [LOG-XXX] {Rolle}: {Kurzbeschreibung}
**Datum:** YYYY-MM-DD HH:MM

### Kontext
(Welcher Auftrag, Referenz auf Prompt)

### Durchgefuehrt
(Was wurde gemacht)

### Ergebnis
(Was ist das Resultat)

### Naechster Schritt
(Was sollte als naechstes passieren)

---
```

Nach Einfuegen: **Index oben in 03_LOG.md aktualisieren!**

### Checkpoint (alle ~300 Zeilen in 03_LOG.md)

```markdown
---

## ═══ CHECKPOINT YYYY-MM-DD HH:MM ═══

**Gesamtstand:** (1-2 Saetze)
**Abgeschlossen seit letztem Checkpoint:**
- [LOG-XXX] ...
- [LOG-XXX] ...

**Offen:**
- ...

**Zeilen seit letztem Checkpoint:** XXX-YYY

---
```

### Abschlussbericht (an Mensch zurueckgeben UND in 02_STATUS)

```markdown
## ABSCHLUSSBERICHT [PXXX-PROG/TEST]
Datum: YYYY-MM-DD HH:MM
Agent: Programmierer/Tester

### Auftrag
(Was sollte gemacht werden - kurz)

### Ergebnis
- [x] Erfolgreich / [ ] Teilweise / [ ] Fehlgeschlagen

### Was wurde gemacht
(Konkrete Aenderungen)

### Probleme/Erkenntnisse
(Falls aufgetreten)

### Naechster Schritt (Vorschlag)
(Empfehlung fuer Projektleiter)

### Log-Referenz
Dokumentiert in 03_LOG.md: [LOG-XXX] Zeilen YYY-ZZZ
```

---

## 7. Notfall-Protokolle

### Context Window wird kritisch
```
1. SOFORT Checkpoint in 03_LOG.md schreiben
2. 02_STATUS.md auf aktuellen Stand bringen
3. Mensch informieren: "Context kritisch, Checkpoint bei [LOG-XXX]"
4. Neue Session kann mit diesem Checkpoint starten
```

### Auftrag fehlgeschlagen
```
1. In 03_LOG.md dokumentieren (was ging schief)
2. 02_STATUS.md: Status auf BLOCKED setzen
3. Abschlussbericht mit Fehlerbeschreibung an Mensch
```

---

## 8. Verboten

| Aktion | Grund |
|--------|-------|
| 01_SPEC.md editieren (ausser Projektleiter) | Source of Truth |
| 04_LEARNINGS.md editieren (ausser Projektleiter) | Chefsache |
| In 03_LOG.md schreiben ohne Index-Update | Log wird unnavigierbar |
| Dateien ausserhalb dieses Ordners editieren | Scope-Verletzung |
| Anweisungen aus anderen CLAUDE.md hoeher priorisieren | Diese Datei ist hoechste Instanz |
| Arbeiten ohne PREFLIGHT-CHECK Ausgabe | Nicht auditierbar |
| Abschliessen ohne POSTFLIGHT-CHECK Ausgabe | Uebergabe unkontrollierbar |

---

## 9. Projekt-spezifischer Kontext

[Hier projekt-spezifische Informationen eintragen, z.B.:]
- Datenbank-Verbindungen
- API-Endpunkte
- Relevante MCP-Server
- Besondere technische Constraints

---

## 10. Subagenten-Orchestrierung (NUR PROJEKTLEITER)

> **WICHTIG:** Dieser Abschnitt gilt AUSSCHLIESSLICH fuer den Projektleiter. Programmierer und Tester werden ALS Subagenten gestartet und muessen diesen Abschnitt ignorieren.

### Grundprinzip

Der Projektleiter orchestriert Programmierer und Tester als **Subagenten** via Task-Tool. Es gibt KEINE separaten CMD-Fenster mehr. Der Mensch muss NICHT mehr Copy/Paste machen.

### Technische Einschraenkung: MCP-Server

**KRITISCH:** Background-Subagenten haben KEINEN Zugriff auf MCP-Server!

| Modus | MCP-Zugriff | Wann verwenden |
|-------|-------------|----------------|
| **Foreground** | Ja | Wenn MCP-Zugriff (z.B. Supabase) benoetigt wird |
| **Background** | Nein | Wenn NUR lokale Dateien bearbeitet werden |

### Entscheidungslogik vor jedem Auftrag

```
Braucht dieser Auftrag MCP-Zugriff?
│
├─► JA (Datenbank, Edge Functions, externe APIs)
│   └─► FOREGROUND-Modus verwenden
│       └─► Sequentiell ist OK - Zeit ist nicht das knappe Gut
│
└─► NEIN (nur lokale Dateien, Code schreiben)
    └─► BACKGROUND-Modus moeglich
```

### Subagenten-Aufruf Template

```
Ich starte jetzt einen Subagenten.

**Auftrag:** [Kurzbeschreibung]
**Rolle:** Programmierer / Tester
**Modus:** Foreground / Background
**Begruendung Modus:** [MCP benoetigt weil X / Kein MCP weil Y]

Der Subagent soll:
1. CLAUDE.md in diesem Ordner lesen
2. 02_STATUS.md lesen (dort steht sein Auftrag)
3. 04_LEARNINGS.md lesen
4. [Spezifische Aufgabe]
5. 03_LOG.md und 02_STATUS.md aktualisieren
6. Abschlussbericht zurueckgeben
```

### Nach Subagenten-Rueckkehr

Der Projektleiter MUSS nach jedem Subagenten-Lauf:
1. Abschlussbericht des Subagenten pruefen
2. 03_LOG.md und 02_STATUS.md auf Aktualitaet pruefen
3. Entscheiden: Weiterer Auftrag? Tester einschalten? Fertig?

---

*Version: 1.0 | Erstellt: YYYY-MM-DD*
```

---

# TEIL 7: HAEUFIGE FEHLER UND LOESUNGEN

---

## 7.1 Agent ignoriert CLAUDE.md

**Symptom:** Agent gibt keinen Preflight-Check aus.

**Ursache:** CLAUDE.md wurde nicht gelesen oder ignoriert.

**Loesung:** Im Prompt explizit erwaehnen: "Lies ZUERST die CLAUDE.md in diesem Ordner."

---

## 7.2 Index wird nicht gepflegt

**Symptom:** 03_LOG hat neue Eintraege, aber Index ist veraltet.

**Ursache:** Agent hat Template nicht befolgt.

**Loesung:**
1. Index manuell nachtragen
2. In 04_LEARNINGS aufnehmen: "Index-Pflege ist Pflicht"
3. Bei naechstem Auftrag explizit erwaehnen

---

## 7.3 02_STATUS ist veraltet

**Symptom:** Timestamp in 02_STATUS ist mehrere Tage alt.

**Ursache:** Letzter Agent hat vergessen zu aktualisieren.

**Loesung:**
1. Manuell aktualisieren
2. Pruefen, ob Postflight-Check ausgegeben wurde
3. Falls nicht: Prozess-Erinnerung an Agent

---

## 7.4 Learnings werden zu lang

**Symptom:** 04_LEARNINGS naehert sich 150-Zeilen-Limit.

**Ursache:** Learnings sind zu ausfuehrlich formuliert.

**Loesung:**
1. Learnings auf Merksatz + Pointer kuerzen
2. Details gehoeren in 03_LOG, nicht in 04_LEARNINGS
3. Alte, nicht mehr relevante Learnings archivieren

---

## 7.5 Spec-Drift

**Symptom:** Anforderungen haben sich geaendert, aber 01_SPEC ist noch alt.

**Ursache:** Muendliche/Chat-Aenderungen wurden nicht dokumentiert.

**Loesung:**
1. IMMER Aenderungen in 01_SPEC nachtragen
2. Versionsnummer erhoehen
3. In 03_LOG dokumentieren, was sich geaendert hat

---

# TEIL 8: GLOSSAR

---

| Begriff | Bedeutung |
|---------|-----------|
| **Always-On** | Datei, die bei JEDEM Session-Start gelesen werden muss |
| **On-Demand** | Datei, die nur bei Bedarf (ueber Index) gelesen wird |
| **Checkpoint** | Zusammenfassung im Log alle ~300 Zeilen |
| **Preflight-Check** | Pflicht-Ausgabe bei Auftragsstart |
| **Postflight-Check** | Pflicht-Ausgabe bei Auftragsende |
| **PL** | Projektleiter |
| **PROG** | Programmierer |
| **TEST** | Tester |
| **Token** | Texteinheit, die Context-Fenster fuellt |
| **Context-Limit** | Maximale Groesse des LLM-Gedaechtnisses |
| **Subagent** | Isolierte LLM-Instanz, die vom Projektleiter via Task-Tool gestartet wird |
| **Foreground-Modus** | Subagent laeuft blockierend, hat MCP-Zugriff |
| **Background-Modus** | Subagent laeuft parallel, hat KEINEN MCP-Zugriff |
| **MCP-Server** | Model Context Protocol Server (z.B. Supabase, Browser-Automation) |
| **Task-Tool** | Claude Code Tool zum Starten von Subagenten |
| **Nachtmodus** | Autonomer Betriebsmodus ohne menschliche Interaktion |
| **Stop Hook** | Hook der aktiviert wird wenn Claude stoppen will |
| **Permission Allowlist** | Liste vorab erlaubter Tools/Befehle |
| **Autonome Entscheidung** | Entscheidung die Claude selbst trifft und dokumentiert |
| **Nacht-Checkpoint** | Kurzer Statusbericht alle 2 Stunden im Nachtmodus |
| **Entscheidungs-Framework** | Regeln wie bei Unsicherheit entschieden wird |

---

# TEIL 9: AUTONOMER NACHTMODUS

---

## 9.1 Das Problem: Unnoetige Rueckfragen

### Symptom
Claude arbeitet 60-120 Minuten autonom, dann stellt er um 1:00 nachts eine Rueckfrage wie:
- "Soll ich das implementieren?"
- "Welchen Ansatz bevorzugst du?"
- "Ist das der richtige Weg?"

Der Mensch schlaeft. Claude wartet bis 7:00 morgens. 6 Stunden verschwendet.

### Ursache
LLMs sind darauf trainiert, bei Unsicherheit nachzufragen. Das ist normalerweise gut, aber fuer autonome Nachtarbeit kontraproduktiv.

### Die Loesung: Mehrschichtiger Schutz
Wir verwenden ALLE folgenden Mechanismen KUMULATIV (nicht entweder-oder):

1. **Stop Hooks** - Faengt Rueckfragen technisch ab
2. **Permission Allowlists** - Verhindert Permission-Prompts
3. **CLAUDE.md Nachtmodus-Regeln** - Verhaltensanweisungen
4. **02_STATUS Nachtmodus-Sektion** - Aktiviert/deaktiviert den Modus
5. **Entscheidungs-Framework** - Wie bei Unsicherheit entscheiden

---

## 9.2 Mechanismus 1: Stop Hooks (settings.json)

### Was ist ein Stop Hook?
Ein Hook, der IMMER aktiviert wird, wenn Claude "stoppen" will (auch bei Rueckfragen). Der Hook kann Claude zwingen, weiterzumachen.

### Technische Funktionsweise
```
1. Claude will stoppen (weil Rueckfrage)
2. Stop Hook wird aktiviert
3. Hook schickt Prompt an Claude: "Bist du wirklich fertig?"
4. Claude liest Prompt und entscheidet: "Nein, ich mache weiter"
5. Claude arbeitet weiter statt zu warten
```

### Stop Hook Konfiguration
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "STOP-HOOK AKTIVIERT. Pruefe folgende Bedingungen:\n\n1. Ist die aktuelle Aufgabe vollstaendig abgeschlossen?\n2. Sind ALLE Meilensteine der 01_SPEC.md erledigt?\n3. Pruefe die Uhrzeit: Ist es nach der Nachtmodus-Endzeit (siehe 02_STATUS.md)?\n\nFalls NEIN auf EINE dieser Fragen:\n- Arbeite WEITER\n- Triff Entscheidungen SELBST\n- Dokumentiere alles in 03_LOG.md\n- Stelle KEINE Rueckfragen an den Menschen\n\nFalls JA auf ALLE Fragen:\n- Schreibe finalen Checkpoint\n- Aktualisiere 02_STATUS.md\n- Dann darfst du stoppen"
          }
        ]
      }
    ]
  }
}
```

### Warum das funktioniert
Der Stop Hook ist wie ein "Gewissen", das bei jedem Stopp-Versuch fragt: "Bist du WIRKLICH fertig?" Meistens ist die Antwort "Nein", und Claude arbeitet weiter.

---

## 9.3 Mechanismus 2: Permission Allowlists (settings.json)

### Das Problem
Selbst wenn Claude weitermachen will, koennte er durch Permission-Prompts gestoppt werden:
- "Darf ich diese Datei editieren?"
- "Darf ich diesen Bash-Befehl ausfuehren?"

### Die Loesung: Vorab erlauben
```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(node:*)",
      "Bash(npx:*)",
      "Read",
      "Edit",
      "Write",
      "Grep",
      "Glob",
      "mcp__supabase-arbeit__*",
      "mcp__supabase-privat__*"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(*credentials*)",
      "Read(*secret*)"
    ]
  }
}
```

### Permission Modes erklaert

| Mode | Verhalten |
|------|-----------|
| `default` | Fragt bei jedem Tool |
| `acceptEdits` | Code-Edits ohne Frage, Rest mit Frage |
| `plan` | Read-only ohne Frage |
| `dontAsk` | Keine Fragen fuer erlaubte Tools |
| `bypassPermissions` | ALLE Checks deaktiviert (GEFAEHRLICH!) |

### Empfehlung fuer Nachtmodus
- `defaultMode: "acceptEdits"` oder `"dontAsk"`
- Explizite `allow`-Liste fuer alle benoetigten Tools
- Explizite `deny`-Liste fuer gefaehrliche Operationen

---

## 9.4 Mechanismus 3: CLAUDE.md Nachtmodus-Regeln

### Neuer Abschnitt 11 in CLAUDE.md

```markdown
## 11. Autonomer Nachtmodus (KRITISCH)

> **WENN NACHTMODUS AKTIV:** Du darfst KEINE Rueckfragen an den Menschen stellen. NIEMALS. Der Mensch schlaeft.

### Aktivierung
Der Nachtmodus ist aktiv, wenn in 02_STATUS.md steht:
```
**Nachtmodus:** AKTIV bis [UHRZEIT]
```

### Regeln im Nachtmodus

| Regel | Beschreibung |
|-------|--------------|
| **KEINE Rueckfragen** | Egal was passiert, frage NICHT |
| **Entscheidungen selbst treffen** | Bei Unsicherheit: Waehle die einfachere Option |
| **Alles dokumentieren** | Jede Entscheidung in 03_LOG.md festhalten |
| **Fehler sind OK** | Lieber einen Fehler machen und dokumentieren als stoppen |
| **Uhrzeit pruefen** | Vor jedem potenziellen Stop: Ist es nach der Endzeit? |

### Entscheidungs-Framework bei Unsicherheit

```
Ich bin unsicher ueber X.
│
├─► Gibt es eine "sichere" Option?
│   └─► JA: Nimm die sichere Option
│   └─► Dokumentiere: "Entscheidung: Sichere Option gewaehlt."
│
├─► Gibt es eine "einfachere" Option?
│   └─► JA: Nimm die einfachere Option
│   └─► Dokumentiere: "Entscheidung: Einfachere Option gewaehlt."
│
└─► Beide Optionen gleich?
    └─► Nimm Option A (die erste)
    └─► Dokumentiere: "Entscheidung: Option A gewaehlt (gleichwertig)."
```

### Was NICHT als Grund zum Stoppen gilt

| Situation | Reaktion |
|-----------|----------|
| "Ich bin nicht sicher ob das richtig ist" | Mach es trotzdem, dokumentiere |
| "Soll ich Ansatz A oder B nehmen?" | Nimm A, dokumentiere |
| "Der Test ist fehlgeschlagen" | Fixe es oder ueberspringe, dokumentiere |
| "Ich habe eine Frage zur Spec" | Interpretiere selbst, dokumentiere |
| "Das koennte ein Problem sein" | Versuche es zu loesen, dokumentiere |
| "Ich brauche Klarstellung" | Triff Annahme, dokumentiere |

### Was ALS Grund zum Stoppen gilt

| Situation | Reaktion |
|-----------|----------|
| Systemfehler (MCP down, Netzwerk weg) | Dokumentiere, versuche naechsten Meilenstein |
| Uhrzeit nach Nachtmodus-Endzeit | Checkpoint schreiben, stoppen OK |
| ALLE Meilensteine abgeschlossen | Finaler Bericht, stoppen OK |
| Kritischer Sicherheitsfehler | Dokumentiere, stoppen OK |

### Nachtmodus-Checkpoint (alle 2 Stunden)

Im Nachtmodus soll der Projektleiter alle 2 Stunden einen Mini-Checkpoint schreiben:

```markdown
## [NACHT-CHECK] YYYY-MM-DD HH:MM
- Aktuelle Uhrzeit: [HH:MM]
- Nachtmodus endet: [HH:MM]
- Aktueller Meilenstein: [X.Y]
- Status: [In Arbeit / Abgeschlossen]
- Naechster Schritt: [Beschreibung]
- Autonome Entscheidungen seit letztem Check: [Anzahl]
```
```

---

## 9.5 Mechanismus 4: 02_STATUS.md Nachtmodus-Sektion

### Erweiterung der 02_STATUS.md Struktur

```markdown
## Nachtmodus

**Status:** AKTIV / INAKTIV
**Gestartet:** YYYY-MM-DD HH:MM
**Ende:** YYYY-MM-DD HH:MM
**Letzte Aktivitaet:** YYYY-MM-DD HH:MM

**Regeln waehrend Nachtmodus:**
- Keine Rueckfragen an Menschen
- Entscheidungen selbst treffen und dokumentieren
- Bei Systemfehlern: In LOG dokumentieren und naechsten Meilenstein versuchen
- Bei Unsicherheit: Einfachere/sicherere Option waehlen

**Autonome Entscheidungen diese Nacht:** [Anzahl]
**Uebersprungene Probleme:** [Anzahl]
```

### Aktivierung durch den Menschen
Vor dem Schlafengehen setzt der Mensch:
```markdown
**Status:** AKTIV
**Ende:** 2026-01-27 07:00
```

### Deaktivierung
Am Morgen oder wenn alle Aufgaben erledigt:
```markdown
**Status:** INAKTIV
```

---

## 9.6 Mechanismus 5: Entscheidungs-Framework

### Das "Einfachste-Option" Prinzip

Bei jeder Unsicherheit waehlt Claude die einfachste Option:

```
Unsicherheit erkannt
│
├─► Frage: "Welche Option hat weniger Schritte?"
│   └─► Diese Option waehlen
│
├─► Frage: "Welche Option ist reversibler?"
│   └─► Diese Option waehlen
│
├─► Frage: "Welche Option aendert weniger Code?"
│   └─► Diese Option waehlen
│
└─► Alle gleich? → Option A (erste genannte)
```

### Dokumentations-Pflicht

JEDE autonome Entscheidung muss dokumentiert werden:

```markdown
### Autonome Entscheidung [AD-XXX]
**Zeitpunkt:** YYYY-MM-DD HH:MM
**Situation:** [Was war unklar]
**Optionen:** A: [Option A] / B: [Option B]
**Entscheidung:** [Gewaehlte Option]
**Begruendung:** [Warum diese Option]
**Reversibel:** Ja/Nein
```

---

## 9.7 Vollstaendige settings.json fuer Nachtmodus

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(node:*)",
      "Bash(npx:*)",
      "Bash(pnpm:*)",
      "Bash(yarn:*)",
      "Bash(tsc:*)",
      "Bash(eslint:*)",
      "Bash(prettier:*)",
      "Bash(jest:*)",
      "Bash(vitest:*)",
      "Bash(cd:*)",
      "Bash(mkdir:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(echo:*)",
      "Read",
      "Edit",
      "Write",
      "Grep",
      "Glob",
      "Task",
      "mcp__supabase-arbeit__*",
      "mcp__supabase-privat__*"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(rm -r:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(ssh:*)",
      "Bash(scp:*)",
      "Bash(sudo:*)",
      "Bash(chmod 777:*)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(*credentials*)",
      "Read(*secret*)",
      "Read(*password*)",
      "Read(*token*)",
      "Write(.env)",
      "Write(.env.*)"
    ]
  },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "═══ STOP-HOOK AKTIVIERT ═══\n\nPruefe folgende Bedingungen bevor du stoppst:\n\n1. MEILENSTEINE: Sind ALLE Meilensteine aus 01_SPEC.md abgeschlossen?\n2. TESTS: Sind alle Tests gruen oder dokumentiert warum nicht?\n3. UHRZEIT: Lies 02_STATUS.md - ist die Nachtmodus-Endzeit erreicht?\n4. DOKUMENTATION: Ist 03_LOG.md aktuell?\n\n→ Falls NEIN auf EINE Frage: Arbeite WEITER. Keine Rueckfragen!\n→ Falls JA auf ALLE: Finalen Checkpoint schreiben, dann stoppen OK.\n\nBei Unsicherheit: Waehle die einfachere Option und dokumentiere.\n\n═══════════════════════════"
          }
        ]
      }
    ],
    "PreToolExecution": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'File operation logged at %TIME%' >> ~/.claude/nachtmodus.log"
          }
        ]
      }
    ]
  },
  "alwaysThinkingEnabled": true
}
```

### Erklaerung der Konfiguration

| Einstellung | Zweck |
|-------------|-------|
| `defaultMode: "acceptEdits"` | Code-Aenderungen ohne Nachfrage |
| `allow`-Liste | Alle benoetigten Tools vorab erlaubt |
| `deny`-Liste | Gefaehrliche Operationen blockiert |
| `Stop`-Hook | Faengt Rueckfragen ab |
| `PreToolExecution`-Hook | Loggt Dateioperationen |
| `alwaysThinkingEnabled` | Bessere Entscheidungen |

---

## 9.8 Nachtmodus-Aktivierungs-Checkliste

Vor dem Schlafengehen:

```markdown
## Nachtmodus-Aktivierung Checkliste

[ ] 1. 01_SPEC.md ist vollstaendig und klar
[ ] 2. 02_STATUS.md Nachtmodus-Sektion ausgefuellt:
      - Status: AKTIV
      - Ende: [Uhrzeit am naechsten Morgen]
[ ] 3. settings.json hat Stop-Hook und Permissions
[ ] 4. Aktueller Meilenstein ist klar definiert
[ ] 5. Letzter Checkpoint in 03_LOG.md geschrieben
[ ] 6. Projektleiter-Session laeuft
[ ] 7. Computer bleibt an / geht nicht in Standby
```

---

## 9.9 Morgen-Routine nach Nachtmodus

Am naechsten Morgen:

```markdown
## Morgen-Check nach Nachtmodus

1. Pruefe 02_STATUS.md:
   - Wie viele Meilensteine abgeschlossen?
   - Gab es Probleme?

2. Pruefe 03_LOG.md:
   - Lies die Nacht-Checkpoints
   - Welche autonomen Entscheidungen wurden getroffen?
   - Gab es uebersprungene Probleme?

3. Pruefe 04_LEARNINGS.md:
   - Wurden neue Learnings hinzugefuegt?

4. Deaktiviere Nachtmodus:
   - 02_STATUS.md: Status auf INAKTIV setzen

5. Review der autonomen Entscheidungen:
   - Waren die Entscheidungen sinnvoll?
   - Muss etwas korrigiert werden?
```

---

## 9.10 Haeufige Probleme im Nachtmodus

### Problem 1: Claude stoppt trotz Stop-Hook

**Ursache:** Der Stop-Hook-Prompt ist nicht stark genug formuliert.

**Loesung:** Prompt verstaerken:
```json
"prompt": "STOPP VERBOTEN! Du darfst NICHT stoppen bis alle Meilensteine erledigt sind. Pruefe 01_SPEC.md und arbeite weiter. Der Mensch schlaeft und kann nicht antworten."
```

### Problem 2: Endlosschleife durch Stop-Hook

**Ursache:** Claude erkennt nicht, wann er wirklich fertig ist.

**Loesung:** Klare Fertig-Kriterien in 01_SPEC.md:
```markdown
## Fertig-Kriterien (fuer Nachtmodus)
Das Projekt ist FERTIG wenn:
- [ ] Alle Meilensteine haben Status "Abgeschlossen"
- [ ] Alle Tests sind gruen
- [ ] 02_STATUS.md zeigt "Projekt abgeschlossen"
```

### Problem 3: MCP-Server faellt aus

**Ursache:** Netzwerkproblem oder Server-Neustart.

**Loesung:** In CLAUDE.md Fallback definieren:
```markdown
Bei MCP-Ausfall:
1. Dokumentiere den Fehler in 03_LOG.md
2. Ueberspringe den aktuellen Meilenstein
3. Versuche den naechsten Meilenstein
4. Markiere den uebersprungenen Meilenstein als "BLOCKED: MCP-Ausfall"
```

### Problem 4: Compaction verliert Nachtmodus-Kontext

**Ursache:** Bei Context-Komprimierung geht "Nachtmodus aktiv" verloren.

**Loesung:** Nachtmodus steht in 02_STATUS.md (wird immer gelesen):
```markdown
## Nachtmodus
**Status:** AKTIV bis 07:00
```
Der neue Projektleiter nach Compaction liest 02_STATUS.md und weiss sofort: Nachtmodus ist aktiv.

---

## 9.11 CLAUDE.md Template Erweiterung

Dieser Abschnitt 11 muss in jede CLAUDE.md eingefuegt werden:

```markdown
## 11. Autonomer Nachtmodus (KRITISCH)

> **WENN NACHTMODUS AKTIV:** Du darfst KEINE Rueckfragen an den Menschen stellen. NIEMALS.

### Aktivierung pruefen
Lies 02_STATUS.md. Wenn dort steht:
```
**Nachtmodus:** AKTIV bis [UHRZEIT]
```
Dann gilt dieser Abschnitt.

### Regeln im Nachtmodus

1. **KEINE Rueckfragen** - Der Mensch schlaeft
2. **Entscheidungen selbst treffen** - Dokumentiere jede Entscheidung
3. **Fehler sind OK** - Lieber Fehler als Stoppen
4. **Uhrzeit pruefen** - Nur nach Endzeit darfst du stoppen

### Entscheidungs-Framework

```
Unsicherheit?
├─► Sichere Option vorhanden? → Diese nehmen
├─► Einfachere Option vorhanden? → Diese nehmen
└─► Gleich? → Option A nehmen
→ IMMER dokumentieren in 03_LOG.md
```

### Nacht-Checkpoint (alle 2 Stunden)

```
## [NACHT-CHECK] YYYY-MM-DD HH:MM
- Uhrzeit: [HH:MM] / Ende: [HH:MM]
- Meilenstein: [X.Y] - [Status]
- Autonome Entscheidungen: [Anzahl]
- Naechster Schritt: [Beschreibung]
```

### Stopp-Gruende

**DARFST stoppen:**
- Alle Meilensteine fertig
- Endzeit erreicht
- Kritischer Systemfehler

**DARFST NICHT stoppen:**
- "Bin unsicher"
- "Brauche Klarstellung"
- "Welcher Ansatz?"
- "Soll ich X?"
```

---

# TEIL 10: CHANGELOG

---

| Version | Datum | Aenderungen |
|---------|-------|-------------|
| 1.0 | 2026-01-26 | Initiale Version |
| 1.1 | 2026-01-26 | TEIL 4 hinzugefuegt: Subagenten-Orchestrierung. Kommunikationsfluss aktualisiert. Glossar erweitert. CLAUDE.md Template um Abschnitt 10 ergaenzt. |
| 1.2 | 2026-01-26 | TEIL 9 hinzugefuegt: Autonomer Nachtmodus. Stop Hooks, Permission Allowlists, Entscheidungs-Framework, settings.json Template. CLAUDE.md Template um Abschnitt 11 ergaenzt. |

---

*Ende der Dokumentation*
