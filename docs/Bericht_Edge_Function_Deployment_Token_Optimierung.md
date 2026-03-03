# Bericht: Token-Einsparung durch CLI-basiertes Edge Function Deployment

> **Fuer:** Marco (KI Coach)
> **Von:** Andreas Stolarczyk / Claude Code Session
> **Datum:** 2026-02-24
> **Thema:** Supabase Edge Functions - MCP API vs. CLI Deployment

---

## Ausgangslage

Wir nutzen **Supabase Edge Functions** (serverlose TypeScript-Funktionen) fuer unsere Dokument-Pipeline:
- E-Mail-Verarbeitung, OCR, GPT-Kategorisierung, Batch-Processing
- Aktuell **23 Edge Functions** deployed
- Die groesste Function (`process-document`) besteht aus **7 Dateien mit ~134.000 Zeichen**

Bisher wurde alles ueber den **Supabase MCP-Server** direkt aus Claude Code deployed.

---

## Das Problem: Token-Verschwendung beim MCP-Deploy

### Wie MCP-Deploy funktioniert

```
Claude liest Function-Code ein (alle Dateien)
    → Laed alles in den Context
    → Sendet alles an Supabase Deploy API
    → Supabase deployed die Function
```

**Jedes Deployment erfordert, dass Claude ALLE Dateien der Function in seinen Context laedt** - auch wenn nur 1 Zeile geaendert wurde.

### Konkretes Beispiel von heute (gemessene Werte!)

Wir mussten bei `process-document` eine einzige Einstellung aendern (`verify_jwt: true` → `false`). Der Code selbst blieb identisch. Der Subagent hat fuer diesen einen Deploy **exakt 106.337 Tokens** verbraucht und **43 Tool-Aufrufe** gebraucht.

**Die 7 Dateien von process-document:**

| Datei | Zeichen | ~Tokens |
|-------|---------|---------|
| index.ts | 45.351 | ~12.000 |
| prompts.ts | 36.683 | ~10.000 |
| _shared/categories.ts | 17.412 | ~5.000 |
| budget-prompts.ts | 9.863 | ~3.000 |
| schema.ts | 8.900 | ~2.500 |
| utils.ts | 7.011 | ~2.000 |
| extraction.ts | 6.399 | ~1.500 |
| **Summe Code** | **131.619** | **~36.000** |

**Warum 106K Tokens fuer 36K Tokens Code?**

Der Code muss **zweimal** durch den Context fliessen:

| Schritt | Tokens | Erklaerung |
|---------|--------|------------|
| Code von Supabase abrufen (`get_edge_function`) | ~36.000 Input | Alle 7 Dateien werden eingelesen |
| Code an Deploy-API senden (`deploy_edge_function`) | ~36.000 Output | Alle 7 Dateien als Parameter mitsenden |
| JSON-Parsing + Datei-Extraktion | ~10.000 | Supabase liefert JSON, Claude muss parsen |
| Subagent-Overhead (Prompt, Checks, Antwort) | ~11.000 | Instruktionen, Validierung, Bericht |
| Tool-Call Overhead (43 Aufrufe) | ~13.000 | Jeder Tool-Aufruf hat Protokoll-Overhead |
| **Gemessenes Total** | **106.337** | **Fuer 0 Zeilen Code-Aenderung!** |

Das ist fuer JEDES Deployment so - egal ob man 1 Zeile oder 100 Zeilen aendert. Die 131K Zeichen Code muessen immer komplett durch Claude fliessen.

Bei mehreren Deploys pro Session summiert sich das schnell:
- 3 Functions deployen = ~300K-500K Tokens nur fuer Deployments
- Das ist oft **mehr als die eigentliche Programmierarbeit kostet**
- In derselben Session haben wir auch `process-email` deployed (~30K Tokens extra)

---

## Die Loesung: Supabase CLI statt MCP API

### Wie CLI-Deploy funktioniert

```
Claude editiert 1 Datei lokal im Git-Repo
    → Ruft "supabase functions deploy <name>" auf (1 Bash-Befehl)
    → CLI liest ALLE Dateien vom Filesystem (nicht ueber Claude)
    → CLI sendet an Supabase
```

**Der entscheidende Unterschied:** Die CLI liest die Dateien direkt vom Dateisystem. Claude muss nur die Datei kennen, die er aendert - nicht alle 7 Dateien der Function.

### Token-Vergleich

| Szenario | MCP-Deploy | CLI-Deploy | Einsparung |
|----------|-----------|------------|------------|
| 1 Flag aendern (`verify_jwt`) | ~106.000 | ~500 | **99.5%** |
| 1 Datei editieren (z.B. Prompt) | ~106.000 | ~15.000 | **86%** |
| Neue Function erstellen (klein) | ~5.000 | ~5.000 | 0% |
| 3 grosse Functions deployen | ~350.000 | ~2.000 | **99.4%** |

### Warum so extrem?

Die Supabase Deploy-API ist ein **"All-or-Nothing"**-Ansatz: Man muss bei jedem Deploy ALLE Dateien einer Function mitsenden, nicht nur die geaenderten. Bei MCP bedeutet das:
- Claude muss alle Dateien lesen (Input-Tokens: ~36K)
- Claude muss alle Dateien an die API senden (Output-Tokens: ~36K)
- Dazu Overhead fuer Parsing + Tool-Calls (~34K)
- **Ergebnis: 106K Tokens fuer 0 Zeilen Code-Aenderung**

Die CLI hingegen liest alles vom Filesystem - Claude sieht davon nichts.

### Was waere mit CLI passiert?

```bash
# Einziger Befehl - Claude tippt das, CLI macht den Rest
supabase functions deploy process-document --no-verify-jwt
```

| | MCP-Deploy | CLI-Deploy |
|--|-----------|------------|
| Claude liest Code? | Ja, alle 131K Zeichen | Nein |
| Claude sendet Code? | Ja, alle 131K Zeichen | Nein |
| Token-Verbrauch | **106.337** | **~500** |
| Faktor | 1x | **212x guenstiger** |

### Zeitvergleich (gemessen vs. geschaetzt)

Neben Tokens spart CLI auch erheblich **Zeit**:

| | MCP-Deploy (gemessen) | CLI-Deploy (geschaetzt) | Faktor |
|--|----------------------|------------------------|--------|
| **Gesamtdauer** | **283 Sekunden** (~4,7 Min) | **~30 Sekunden** | **~10x schneller** |
| **Tool-Aufrufe** | 43 | 1 | 43x weniger |

**Warum dauert MCP so lange?**

| Schritt | Dauer |
|---------|-------|
| Supabase API: Code abrufen (131K JSON) | ~10s |
| Claude: JSON parsen, 7 Dateien extrahieren | ~60s (viele Tool-Calls) |
| Supabase API: Deploy mit allen Dateien | ~30s |
| Subagent-Overhead (Start, Validierung, Bericht) | ~180s |
| **Total** | **~283s** |

**Warum ist CLI so schnell?**

```bash
# Claude tippt einen Befehl (~2 Sekunden)
supabase functions deploy process-document --no-verify-jwt

# CLI liest Dateien vom Disk (instant, <1 Sekunde)
# CLI sendet an Supabase API (~15-25 Sekunden)
# Fertig.
```

Die CLI umgeht den gesamten Flaschenhals: Claude muss den Code weder lesen, noch parsen, noch senden. Das Filesystem und die CLI erledigen das direkt.

---

## Voraussetzungen fuer CLI-Ansatz

1. **Edge Function Code im Git-Repo** (Source of Truth)
   - Alle Functions unter `supabase/functions/<name>/` versioniert
   - `supabase/config.toml` mit Settings (verify_jwt etc.)

2. **Supabase CLI installiert** auf dem Entwicklungsrechner
   - `npm install -g supabase`
   - `supabase login` + `supabase link --project-ref <id>`

3. **Workflow-Disziplin**
   - Aenderung lokal machen → Testen → `supabase functions deploy` → Git commit
   - Kein Deploy ueber MCP API mehr (ausser Notfall)

---

## Zusaetzliche Vorteile

| Vorteil | Beschreibung |
|---------|-------------|
| **Git-History** | Jede Aenderung ist nachvollziehbar (wer, wann, was) |
| **Diff vor Deploy** | `git diff` zeigt exakt was sich aendert |
| **Rollback** | `git checkout <commit> && supabase functions deploy` |
| **Kein Drift** | Repo und Supabase sind immer synchron |
| **Team-faehig** | Mehrere Entwickler koennen am gleichen Repo arbeiten |

---

## Offene Frage an Marco

1. **Ist dieser Ansatz (CLI statt MCP fuer Deployments) der richtige Weg, um Token-Kosten zu senken?**

2. **Gibt es alternative Patterns, die wir in Betracht ziehen sollten?**
   - Z.B. GitHub Actions CI/CD (automatischer Deploy bei Push)?
   - Oder ein Hybrid-Ansatz (MCP fuer kleine Functions, CLI fuer grosse)?

3. **Gilt dieses Prinzip generell?**
   - Immer wenn Claude grosse Dateien nur "durchreichen" muss (ohne sie zu verstehen/aendern), ist eine CLI/Tool-basierte Loesung besser als alles durch den Context zu schieben?

---

## Zusammenfassung

> **Kernaussage:** Supabase Edge Function Deployments ueber MCP verschwenden massiv Tokens und Zeit, weil Claude den gesamten Function-Code in den Context laden muss - auch wenn nur 1 Zeile geaendert wird. Durch den Wechsel auf Supabase CLI spart man **99,5% Tokens** (106K → 500) und **90% Zeit** (283s → 30s), weil die CLI Dateien direkt vom Filesystem liest.

---

*Erstellt: 2026-02-24 | Kontext: Auftragsmanagement-Projekt, JS Fenster & Tueren*
