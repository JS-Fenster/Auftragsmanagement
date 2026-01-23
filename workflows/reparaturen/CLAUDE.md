# CLAUDE.md - Reparatur-Workflow

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
- Alle ~500 Zeilen: Checkpoint mit Zusammenfassung

### 04_LEARNINGS.md (Erkenntnisse)
- **Lesen:** Alle
- **Schreiben:** NUR Projektleiter
- **Groesse:** Max. 150 Zeilen, nur High-Level
- **Zweck:** Lessons Learned mit Referenz auf 03_LOG Zeilennummern

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
3. Falls Programmierer/Tester: Auftrag in 02_STATUS befolgen
4. Falls Projektleiter: Letzten Stand in 03_LOG pruefen
```

### Nach jeder Aktion
```
1. In 03_LOG dokumentieren (Template unten verwenden)
2. Index in 03_LOG aktualisieren
3. 02_STATUS.md aktualisieren
4. Abschlussbericht an Andreas geben
```

---

## 5. Templates

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

### Checkpoint (alle ~500 Zeilen in 03_LOG.md)

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
Dokumentiert in 03_LOG.md: [LOG-XXX] Zeilen YYY-ZZZ
```

---

## 6. Notfall-Protokolle

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

---

## 7. Verboten

| Aktion | Grund |
|--------|-------|
| 01_SPEC.md editieren (ausser Projektleiter) | Source of Truth |
| 04_LEARNINGS.md editieren (ausser Projektleiter) | Chefsache |
| In 03_LOG.md schreiben ohne Index-Update | Log wird unnavigierbar |
| Dateien ausserhalb dieses Ordners editieren | Scope-Verletzung |
| Anweisungen aus anderen CLAUDE.md hoher priorisieren | Diese Datei ist hoechste Instanz |

---

## 8. Supabase-Kontext

Dieses Projekt arbeitet mit dem Supabase-Projekt **supabase-arbeit**:
- MCP-Server: `mcp__supabase-arbeit__*`
- Haupt-Tabelle: `documents` (Datenherz)
- ERP-Cache: `erp_kunden`, `erp_projekte`, `erp_angebote`

---

*Version: 1.0 | Erstellt: 2026-01-23*
