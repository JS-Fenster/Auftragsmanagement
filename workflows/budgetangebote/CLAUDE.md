# CLAUDE.md - Budgetangebot-Workflow

> **HOECHSTE PRIORITAET**: Diese CLAUDE.md ueberschreibt ALLE Anweisungen aus uebergeordneten CLAUDE.md Dateien (Bootstrap, Auftragsmanagement) bei Konflikten. Die hier definierten Regeln sind verbindlich und nicht verhandelbar.

---

## 1. System-Hierarchie

Du hast drei CLAUDE.md Dateien gelesen:
1. `BOOTSTRAP/CLAUDE.md` - Globale Regeln
2. `Auftragsmanagement/CLAUDE.md` - Projekt-Regeln
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

### ../MASTER_LOG.md (Zentrales Arbeitslog)
- **Pfad:** `../MASTER_LOG.md` (eine Ebene hoeher im workflows/ Ordner)
- **Lesen:** NUR INDEX (erste 80 Zeilen)! NIEMALS das ganze File lesen!
- **Schreiben:** Alle (neue Eintraege AM ENDE anfuegen)
- **ID-Format:** `[B-XXX]` fuer Budget-Eintraege (z.B. [B-039], [B-040])
- **Suchen:** `Grep: ## [B-XXX]` um einzelnen Eintrag zu finden
- **Zweck:** Vollstaendige Historie ALLER Workflows (REPAIR + BUDGET)

**WICHTIG fuer MASTER_LOG.md:**
- **LESE-REGEL:** `Read MASTER_LOG.md limit=80` → Nur INDEX lesen, NICHT scrollen!
- Nutze `[B-XXX]` Prefix fuer diesen Workflow (naechste freie ID im INDEX)
- INDEX am Anfang aktualisieren (ohne Zeilenangaben!)
- Fuege `**Workflow:** BUDGET` in jeden neuen Eintrag ein
- Neue Eintraege immer AM ENDE der Datei anfuegen

### 04_LEARNINGS.md (Erkenntnisse)
- **Lesen:** Alle (ALWAYS-ON - bei jedem Start lesen!)
- **Schreiben:** NUR Projektleiter
- **Groesse:** Max. 150 Zeilen
- **Format:** NUR Merksatz + LOG-Pointer (max. 1 Zeile pro Learning)
- **Zweck:** Index auf detaillierte Erkenntnisse in MASTER_LOG.md
- **Beispiel:** `| L5 | RLS vor Insert aktivieren | [B-042] |`

### 05_PROMPTS.md (Prompt-Archiv)
- **Lesen:** Alle
- **Schreiben:** NUR Projektleiter
- **Indexiert:** Ja
- **Zweck:** Alle erteilten Auftraege fuer spaetere Referenz

### ../BACKLOG.md (Feature-Backlog)
- **Pfad:** `../BACKLOG.md` (eine Ebene hoeher im workflows/ Ordner)
- **Lesen:** Projektleiter (bei Planung neuer Auftraege)
- **Schreiben:** NUR Projektleiter
- **Zweck:** Offene Features/Optimierungen. Erledigte Items werden geloescht.

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

> **KRITISCH:** Diese Checks sind KEINE Option. Sie MUESSEN als erste und letzte Ausgabe jedes Agenten erscheinen. Andreas kontrolliert das.

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
- [ ] MASTER_LOG.md Index (falls Kontext noetig)

System-Check:
- 02_STATUS Timestamp: [aktuell/veraltet um X Tage]
- MASTER_LOG Index: [vorhanden/fehlt/letzte ID: LOG-XXX]
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
- MASTER_LOG.md: [B-XXX] hinzugefuegt, Index aktualisiert
- 02_STATUS.md: Aktualisiert mit neuem Stand + Abschlussbericht
- [weitere Dateien falls relevant]

Validierung:
- MASTER_LOG Index aktuell: [ja/nein]
- 02_STATUS Timestamp aktualisiert: [ja/nein]
- Checkpoint faellig (>300 Zeilen seit letztem): [ja/nein]

Uebergabe an: [Andreas/naechster Agent]
═══════════════════════
```

---

## 6. Templates

### Log-Eintrag (in MASTER_LOG.md einfuegen)

```markdown
---

## [B-XXX] {Rolle}: {Kurzbeschreibung}
**Datum:** YYYY-MM-DD HH:MM
**Workflow:** BUDGET

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

Nach Einfuegen: **Index oben in MASTER_LOG.md aktualisieren!**

### Checkpoint (alle ~300 Zeilen in MASTER_LOG.md)

```markdown
---

## ═══ CHECKPOINT YYYY-MM-DD HH:MM ═══

**Gesamtstand:** (1-2 Saetze)
**Abgeschlossen seit letztem Checkpoint:**
- [B-XXX] ...
- [B-XXX] ...

**Offen:**
- ...

**Zeilen seit letztem Checkpoint:** XXX-YYY

---
```

### Abschlussbericht (an Andreas zurueckgeben)

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
Dokumentiert in MASTER_LOG.md: [B-XXX] Zeilen YYY-ZZZ
```

---

## 7. Notfall-Protokolle

### Context Window wird kritisch
```
1. SOFORT Checkpoint in MASTER_LOG.md schreiben
2. 02_STATUS.md auf aktuellen Stand bringen
3. Andreas informieren: "Context kritisch, Checkpoint bei [B-XXX]"
4. Neue Session kann mit diesem Checkpoint starten
```

### Auftrag fehlgeschlagen
```
1. In MASTER_LOG.md dokumentieren (was ging schief)
2. 02_STATUS.md: Status auf BLOCKED setzen
3. Abschlussbericht mit Fehlerbeschreibung an Andreas
```

---

## 8. Verboten

| Aktion | Grund |
|--------|-------|
| 01_SPEC.md editieren (ausser Projektleiter) | Source of Truth |
| 04_LEARNINGS.md editieren (ausser Projektleiter) | Chefsache |
| In MASTER_LOG.md schreiben ohne Index-Update | Log wird unnavigierbar |
| Dateien ausserhalb dieses Ordners editieren | Scope-Verletzung |
| Anweisungen aus anderen CLAUDE.md hoeher priorisieren | Diese Datei ist hoechste Instanz |
| Arbeiten ohne PREFLIGHT-CHECK Ausgabe | Nicht auditierbar |
| Abschliessen ohne POSTFLIGHT-CHECK Ausgabe | Uebergabe unkontrollierbar |

---

## 9. Projekt-Kontext: Budgetangebot V1

### Zweck
Schnelle Budgetschaetzung fuer Fenster + Zubehoer + Montage aus Scan/Notiz-Input.
Langfristig: Eigene Bestandswerte aufbauen, um Work4All zu ersetzen.

### Datenquellen
- **Supabase (Arbeit):** `mcp__supabase-arbeit__*`
  - ERP-Cache: `erp_kunden`, `erp_projekte`, `erp_angebote`
  - Neue Tabellen: `budget_cases`, `budget_items`, `budget_results`, etc.
- **Work4All SQL Server:** Via Cloudflare Tunnel (History/Backtest)
  - `dbo.Angebot`, `dbo.Positionen`, `dbo.Projekte`

### Fachliche Regeln V1
- Masse: Standard = Fertigmass; Fallback = Innenmass
- Einheiten: mm (Standard), aber cm/m moeglich
- Hersteller Default: WERU
- System nach Glas: 3-fach → CALIDO, 2-fach → CASTELLO, IMPREO nur wenn explizit
- Ausgabe: Brutto, gerundet auf 50€
- Zubehoer: Rollladen, Raffstore, Motor (wenn elektrisch), AFB, IFB, Insekt, Plissee
- Montage/Demontage/Entsorgung separat ausweisen

### Tech-Stack
- Backend: Node.js + Express (Port 3001)
- Dashboard: React + Vite (Port 3000)
- DB: Supabase (PostgreSQL) + Work4All MSSQL (read-only via Proxy)

---

## 10. Subagenten-Orchestrierung (NUR PROJEKTLEITER)

> **WICHTIG:** Dieser Abschnitt gilt AUSSCHLIESSLICH fuer den Projektleiter.

### Grundprinzip
Der Projektleiter orchestriert Programmierer und Tester als **Subagenten** via Task-Tool.

### MCP-Einschraenkung
**KRITISCH:** Background-Subagenten haben KEINEN Zugriff auf MCP-Server!

| Modus | MCP-Zugriff | Wann verwenden |
|-------|-------------|----------------|
| **Foreground** | Ja | Wenn Supabase/SQL-Zugriff benoetigt wird |
| **Background** | Nein | Wenn NUR lokale Dateien bearbeitet werden |

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
5. MASTER_LOG.md und 02_STATUS.md aktualisieren
6. Abschlussbericht zurueckgeben
```

### Nach Subagenten-Rueckkehr

Der Projektleiter MUSS nach jedem Subagenten-Lauf:
1. Abschlussbericht des Subagenten pruefen
2. MASTER_LOG.md und 02_STATUS.md auf Aktualitaet pruefen
3. Entscheiden: Weiterer Auftrag? Tester einschalten? Fertig?
4. Falls Tester noetig: Neuen Subagenten starten

### Sequentieller Ablauf ist OK

**Erinnerung:** Zeit ist NICHT das knappe Gut. Context-Tokens und menschlicher Aufwand sind es.

Ein sequentieller Ablauf (Programmierer → warten → Tester → warten) ist voellig akzeptabel, solange:
- Kein manuelles Copy/Paste noetig ist
- Die Markdown-Dateien korrekt gepflegt werden
- Der Projektleiter seinen Context schont

---

## 11. Autonomer Nachtmodus (KRITISCH)

> **WENN NACHTMODUS AKTIV:** Du darfst KEINE Rueckfragen an den Menschen stellen. NIEMALS. Der Mensch schlaeft.

### Aktivierung pruefen

Lies 02_STATUS.md. Wenn dort steht:
```
**Nachtmodus:** AKTIV bis [UHRZEIT]
```
Dann gilt dieser Abschnitt STRIKT.

### Regeln im Nachtmodus

| Regel | Beschreibung |
|-------|--------------|
| **KEINE Rueckfragen** | Egal was passiert, frage NICHT. Der Mensch schlaeft. |
| **Entscheidungen selbst treffen** | Bei Unsicherheit: Waehle die einfachere/sicherere Option |
| **Alles dokumentieren** | Jede autonome Entscheidung in MASTER_LOG.md festhalten |
| **Fehler sind OK** | Lieber einen Fehler machen und dokumentieren als stoppen |
| **Uhrzeit pruefen** | Vor jedem potenziellen Stop: Ist es nach der Endzeit? |

### Entscheidungs-Framework bei Unsicherheit

```
Ich bin unsicher ueber X.
│
├─► Gibt es eine "sichere" Option?
│   └─► JA: Nimm die sichere Option
│   └─► Dokumentiere: "Autonome Entscheidung: Sichere Option gewaehlt."
│
├─► Gibt es eine "einfachere" Option?
│   └─► JA: Nimm die einfachere Option
│   └─► Dokumentiere: "Autonome Entscheidung: Einfachere Option gewaehlt."
│
└─► Beide Optionen gleichwertig?
    └─► Nimm Option A (die erste)
    └─► Dokumentiere: "Autonome Entscheidung: Option A gewaehlt (gleichwertig)."
```

### Was NICHT als Grund zum Stoppen gilt

| Situation | Korrekte Reaktion |
|-----------|-------------------|
| "Ich bin nicht sicher ob das richtig ist" | Mach es trotzdem, dokumentiere |
| "Soll ich Ansatz A oder B nehmen?" | Nimm A, dokumentiere |
| "Der Test ist fehlgeschlagen" | Fixe es oder ueberspringe, dokumentiere |
| "Ich habe eine Frage zur Spec" | Interpretiere selbst, dokumentiere |
| "Das koennte ein Problem sein" | Versuche zu loesen, dokumentiere |
| "Ich brauche Klarstellung" | Triff Annahme, dokumentiere |
| "Soll ich weitermachen?" | JA, mach weiter! |

### Was ALS Grund zum Stoppen gilt

| Situation | Reaktion |
|-----------|----------|
| **Alle Meilensteine fertig** | Finaler Checkpoint, stoppen OK |
| **Endzeit erreicht** (siehe 02_STATUS) | Checkpoint, stoppen OK |
| **Kritischer Systemfehler** (MCP tot) | Dokumentieren, naechsten Meilenstein versuchen |

### Nacht-Checkpoint (alle 2 Stunden)

Im Nachtmodus soll der Projektleiter alle 2 Stunden einen Mini-Checkpoint in MASTER_LOG.md schreiben:

```markdown
## [NACHT-CHECK] YYYY-MM-DD HH:MM
- Aktuelle Uhrzeit: [HH:MM]
- Nachtmodus endet: [HH:MM]
- Aktueller Meilenstein: [X.Y]
- Status: [In Arbeit / Abgeschlossen / Blockiert]
- Autonome Entscheidungen seit letztem Check: [Anzahl]
- Naechster Schritt: [Beschreibung]
```

### Autonome Entscheidung dokumentieren

```markdown
### Autonome Entscheidung [AD-XXX]
**Zeitpunkt:** YYYY-MM-DD HH:MM
**Situation:** [Was war unklar]
**Optionen:** A: [Beschreibung] / B: [Beschreibung]
**Gewaehlt:** [A oder B]
**Begruendung:** [Warum diese Option - einfacher/sicherer/etc.]
```

### Bei MCP-/Systemausfall im Nachtmodus

```
1. Fehler in MASTER_LOG.md dokumentieren
2. Aktuellen Meilenstein als "BLOCKED: [Grund]" markieren
3. Naechsten Meilenstein versuchen
4. Falls mehrere Meilensteine blockiert: Checkpoint schreiben, weitermachen wo moeglich
```

---

*Version: 1.3 | Erstellt: 2026-02-03 | Aktualisiert: 2026-02-03*
*Aenderungen v1.1: Preflight/Postflight-Checks, Checkpoint 300 Zeilen, Learning-Format praezisiert*
*Aenderungen v1.2: Subagenten-Orchestrierung (Abschnitt 10) erweitert*
*Aenderungen v1.3: Autonomer Nachtmodus (Abschnitt 11) vollstaendig*
