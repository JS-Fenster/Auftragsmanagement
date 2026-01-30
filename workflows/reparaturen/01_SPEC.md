# Projektspezifikation: Reparatur-Workflow

> **Nur Projektleiter darf diese Datei editieren.**
> Stand: 2026-01-30 | Version: 1.5

---

## INDEX

| Kap. | Titel | Zeilen |
|------|-------|--------|
| 1 | Einfuehrung | 25-45 |
| 2 | Status Quo - Bestehendes System (NICHT ANFASSEN) | 50-180 |
| 3 | Reparatur-Prozess IST-Zustand (manuell) | 185-450 |
| 3.3.2 | Ergebnis Servicebesuch 1 (Pflichtentscheidung) | 290-320 |
| 3.3.3 | Lager/Standardteil-Logik | 325-350 |
| 3.3.4 | Ressourcen-Constraints (2-Mann-Jobs) | 355-385 |
| 3.8 | Auftrags-Statusmodell | 430-480 |
| 4 | Automatisierungspotenzial / SOLL-Zustand | 485-650 |
| 4.7 | Rollout-Strategie (Step 1 / Step 2) | 630-680 |
| 5 | Technologien und Integrationen | 685-760 |
| 6 | Spezialanweisungen und Einschraenkungen | 765-810 |

---

## 1. Einfuehrung

**Firma:** JS Fenster & Tueren
**Geschaeftsfeld:** Verkauf, Einbau, Reparatur und Austausch von Fenstern und Tueren

**Ziel dieses Projekts:**
Automatisierung des Reparaturprozesses - von der Kundenanfrage bis zur Rechnungsstellung.

**Datengrundlage:**
- `documents` Tabelle: 1.605+ kategorisierte Dokumente (Stand: 2026-01-26)
- ERP-Cache: Kunden, Projekte, Angebote, Rechnungen, Bestellungen, Lieferanten

**Grundsatz:**
Das bestehende Dokumentenmanagementsystem ist bereits funktionsfaehig und darf NUR ADDITIV erweitert werden. Bestehende Edge Functions und Tabellen duerfen NICHT invasiv veraendert werden.

---

## 2. Status Quo - Bestehendes System (NICHT ANFASSEN)

> **KRITISCH:** Dieses Kapitel dokumentiert das BESTEHENDE System.
> Alles hier Aufgefuehrte ist PRODUKTIV und darf MAXIMAL MINIMAL-INVASIV behandelt werden.
> Bei Unsicherheit: NACHFRAGEN.

### 2.1 Supabase-Projekt

| Info | Wert |
|------|------|
| Projekt-URL | `https://rsmjgdujlpnydbsfuiek.supabase.co` |
| MCP-Server | `mcp__supabase-arbeit__*` |

### 2.2 Bestehende Tabellen (Stand: 2026-01-26)

#### Haupt-Tabelle: `documents`
| Eigenschaft | Wert |
|-------------|------|
| Zeilen | 1.605 |
| Spalten | ~250 |
| RLS | Aktiv |
| Zweck | Zentrales Datenherz fuer ALLE Dokumenttypen |

**Dokumentquellen (Feld: `source`):**
- `email` - E-Mails via Microsoft Graph Webhook
- `scanner` - Physische Dokumente via Scanner-Webhook
- `upload` - Manuelle Uploads

**Kategorien (41 Stueck):**
Abnahmeprotokoll, Angebot, Aufmassblatt, Auftragsbestaetigung, Audio, Ausgangsrechnung, Bauplan, Bestellung, Bild, Brief_ausgehend, Brief_eingehend, Brief_von_Finanzamt, Eingangslieferschein, Eingangsrechnung, Email_Anhang, Email_Ausgehend, Email_Eingehend, Finanzierung, Formular, Gutschrift, Kundenanfrage, Kundenbestellung, Kundenlieferschein, Leasing, Lieferantenangebot, Mahnung, Montageauftrag, Notiz, Office_Dokument, Preisanfrage, Produktdatenblatt, Reiseunterlagen, Reklamation, Serviceauftrag, Skizze, Sonstiges_Dokument, Vertrag, Video, Zahlungsavis, Zahlungserinnerung, Zeichnung

**Verarbeitungsstatus (Feld: `processing_status`):**
- `pending` - Wartet auf Verarbeitung
- `queued` - In Warteschlange
- `processing` - Wird verarbeitet
- `done` - Fertig
- `error` - Fehler

#### ERP-Cache Tabellen

| Tabelle | Zeilen | Zweck |
|---------|--------|-------|
| `erp_kunden` | 8.687 | Kundenstammdaten aus Work4all |
| `erp_projekte` | 2.486 | Projekte |
| `erp_angebote` | 4.744 | Angebote |
| `erp_rechnungen` | 2.996 | Ausgangsrechnungen |
| `erp_bestellungen` | 3.839 | Bestellungen |
| `erp_lieferanten` | 663 | Lieferantenstammdaten |
| `erp_ra` | 2.993 | Rechnungsausgang (offene Posten) |

#### Reparatur-Workflow Tabellen (NEU - Step 1 MVP)

| Tabelle | Zeilen | Zweck | Erstellt |
|---------|--------|-------|----------|
| `reparatur_auftraege` | ~2 (Test) | Haupt-Tabelle fuer Reparatur-Workflow | 2026-01-29 |
| `telegram_sessions` | 0 | Telegram-Bot Sessions (Step 2 Vorbereitung) | 2026-01-26 |

**Tabelle `reparatur_auftraege` Details:**
- 27 Spalten inkl. Status-Ladder, Zeitfenster, Mannstaerke, Aging-Flag
- RLS aktiviert (Service-Role + Authenticated)
- Foreign Keys zu `erp_kunden` und `documents`
- Indizes auf status, prioritaet, erp_kunde_id, termin_sv1, erstellt_am

#### Auftrags-Tracking Tabellen (alt, noch leer)

| Tabelle | Zeilen | Zweck |
|---------|--------|-------|
| `auftrag_status` | 0 | Auftragsstatus-Tracking (nicht verwendet) |
| `auftrag_checkliste` | 0 | Checklisten pro Auftrag |
| `auftrag_fotos` | 0 | Fotos zu Auftraegen |
| `auftrag_historie` | 0 | Aenderungshistorie |

#### Lernschleife / Klassifizierung

| Tabelle | Zeilen | Zweck |
|---------|--------|-------|
| `classification_rules` | 0 | Automatisch generierte Regeln |
| `rule_applications` | 0 | Regel-Anwendungs-Log |
| `rule_evidence_clusters` | 52 | Evidenz-Cluster fuer Regelgenerierung |
| `document_features` | 565 | Extrahierte Features |

#### E-Mail-System

| Tabelle | Zeilen | Zweck |
|---------|--------|-------|
| `email_subscriptions` | 4 | Microsoft Graph Subscriptions |
| `email_ingest_filters` | 1 | Spam/Noise-Filter |
| `ignored_emails` | 16 | Log gefilterter E-Mails |

### 2.3 Bestehende Edge Functions (14 + 3 neu = 17 aktiv)

#### Bestehende Functions (Dokumenten-System)

| Function | Version | JWT | Zweck |
|----------|---------|-----|-------|
| `process-document` | v38 | Ja | **KERN:** OCR + GPT-Kategorisierung + Extraktion |
| `email-webhook` | v24 | Nein | Microsoft Graph Webhook Empfaenger |
| `process-email` | v28 | Nein | E-Mail verarbeiten und speichern |
| `scan-mailbox` | v14 | Nein | Postfach scannen (Batch) |
| `renew-subscriptions` | v9 | Nein | Graph Subscriptions erneuern |
| `admin-review` | v20 | Nein | Review-UI fuer Dokument-Kategorisierung |
| `rule-generator` | v2 | Nein | Automatische Regel-Generierung aus Korrekturen |
| `lifecycle-webhook` | v7 | Nein | Subscription Lifecycle Events |
| `cleanup-orphaned-files` | v8 | Ja | Verwaiste Storage-Dateien loeschen |
| `cleanup-ics-storage` | v2 | Nein | ICS-Dateien aufraeumen |
| `retry-queued` | v2 | Nein | Queued Dokumente erneut verarbeiten |
| `create-subscription` | v2 | Nein | Neue Graph Subscription anlegen |
| `setup-andreas-mailbox` | v2 | Nein | Andreas' Postfach einrichten |
| `debug-env` | v2 | Nein | Umgebungsvariablen debuggen |

#### NEUE Functions (Reparatur-Workflow - Step 1 MVP)

| Function | Version | JWT | Zweck | Aktualisiert |
|----------|---------|-----|-------|--------------|
| `reparatur-api` | v6 (1.5.0) | Ja | CRUD fuer Reparatur-Auftraege - Step 1 MVP KOMPLETT | 2026-01-30 |
| `reparatur-aging` | v1 (1.0.0) | Nein | Cron-Job: Setzt ist_zu_lange_offen Flag nach 14 Tagen | 2026-01-29 |
| `telegram-bot` | v1 | Nein | Telegram Webhook (Step 2 Vorbereitung) | 2026-01-26 |

**Endpoints `reparatur-api` v1.5.0 (GETESTET - T011-TEST):**

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/reparatur` | GET | Alle offenen Auftraege (sortiert: Prio DESC, Datum ASC) |
| `/reparatur/:id` | GET | Einzelner Auftrag |
| `/reparatur` | POST | Neuer Auftrag anlegen (Neukunde oder Bestandskunde) |
| `/reparatur/:id/status` | PATCH | Status-Transition (validiert erlaubte Uebergaenge) |
| `/reparatur/:id/termin` | PATCH | Termin SV1 setzen (validiert Zeitfenster) |
| `/reparatur/:id/outcome` | PATCH | Outcome SV1 setzen (A=erledigt, B=Folgeeinsatz) |
| `/reparatur/:id/termin-sv2` | PATCH | Termin SV2 setzen (nur bei Outcome B) |
| `/reparatur/:id/mannstaerke` | PATCH | Mannstaerke setzen (1/2/null) |
| `/kunden` | GET | Kundensuche in erp_kunden (?q=suchbegriff) |
| `?health=1` | GET | Health Check |

**Cron-Job `reparatur-aging` (noch zu konfigurieren):**
- Empfehlung: Taeglich 06:00 Uhr
- Prueft: Status OFFEN/IN_BEARBEITUNG/NICHT_BESTAETIGT + letzter_kontakt_am > 14 Tage
- Aktion: Setzt ist_zu_lange_offen = true

### 2.4 Bestehende Automatisierungen (bereits funktional)

1. **E-Mail-Eingang:**
   - Microsoft Graph Webhook → `email-webhook` → `documents` Tabelle
   - Automatische Kategorisierung via GPT
   - Anhang-Extraktion und -Speicherung

2. **Scanner-Eingang:**
   - Scanner-Webhook → Storage → `documents` Tabelle
   - OCR via Mistral/GPT
   - Automatische Kategorisierung und Datenextraktion

3. **Dokumentenverarbeitung:**
   - `process-document` extrahiert je nach Kategorie unterschiedliche Felder
   - ~250 Spalten fuer alle Dokumenttypen in einer Tabelle

4. **Lernschleife:**
   - Korrekturen in `admin-review` → Evidence Cluster
   - Ab 3+ Evidenzen → Regel-Generierung via GPT

---

## 3. Reparatur-Prozess IST-Zustand (manuell)

> Dieses Kapitel beschreibt den AKTUELLEN manuellen Prozess.
> Automatisierungspotenzial wird in Kapitel 4 behandelt.

### 3.1 Prozess-Uebersicht (Flussdiagramm)

> **KERNKONZEPT:** Servicebesuch 1 kann ZWEI Outcomes haben!
> Nicht jede Reparatur braucht einen Folgeeinsatz.

```
[Reparaturbedarf angemeldet]
         │
         ▼
[Annahme-Entscheidung + Prio-Einstufung]
         │
         ▼
[Terminplanung Servicebesuch 1] ◄─── FRUEH nach Annahme!
         │
         ▼
[Terminerinnerung 24h + 2h vorher]
         │
         ▼
┌─────────────────────────────────────────────────┐
│  SERVICEBESUCH 1                                │
│  (Begutachtung + ggf. Sofort-Reparatur)         │
│                                                 │
│  - Begutachtungsauftrag unterschreiben (100€)   │
│  - Situation pruefen                            │
│  - Falls Lager/Standardteil dabei: reparieren   │
└─────────────────────────────────────────────────┘
         │
         ▼
    ╔════════════════════════════════════╗
    ║  PFLICHTENTSCHEIDUNG: Outcome?     ║
    ╚════════════════════════════════════╝
         │
    ┌────┴────────────────────────────┐
    │                                 │
    ▼                                 ▼
═══════════════════         ═══════════════════════════
 OUTCOME A:                  OUTCOME B:
 Erledigt beim               Folgeeinsatz noetig
 1. Besuch                   (Teil noetig / groesserer
                             Defekt / nicht zugaenglich)
═══════════════════         ═══════════════════════════
    │                                 │
    ▼                                 ▼
[Montageschein              [Vor-Ort-Dokumentation:
 unterschreiben]             Fotos + Masse + Hersteller]
    │                                 │
    ▼                                 ▼
[Montageschein              [Ersatzteil-Recherche]
 scannen]                             │
    │                                 ▼
    │                        [Auftragsbestaetigung]
    │                                 │
    │                                 ▼
    │                        [Kunde unterschreibt]
    │                        ◄─── Rechtliche Beauftragung
    │                                 │
    │                                 ▼
    │                        [Ersatzteil bestellen]
    │                                 │
    │                                 ▼
    │                        [Warten auf Lieferung]
    │                                 │
    │                                 ▼
    │                        [Terminplanung Servicebesuch 2]
    │                                 │
    │                                 ▼
    │                        [Terminerinnerung]
    │                                 │
    │                                 ▼
    │                        ┌─────────────────────────┐
    │                        │  SERVICEBESUCH 2        │
    │                        │  (Reparatur)            │
    │                        │  - Montageschein        │
    │                        │  - Unterschreiben       │
    │                        │  - Scannen              │
    │                        └─────────────────────────┘
    │                                 │
    └─────────────┬───────────────────┘
                  │
                  ▼
         [Rechnung erstellen (ERP)]
         ◄─── 100€ Pauschale verrechnen
                  │
                  ▼
         [Optional: Zahlungserinnerung/Mahnung]
                  │
                  ▼
         [Optional: Dankeschoen/Feedback]
```

### 3.2 Eingangs-Kanaele fuer Reparaturbedarf

| Kanal | Beschreibung | Automatisierungsgrad |
|-------|--------------|---------------------|
| E-Mail | Direkt oder via Webformular | Landet bereits in `documents` |
| Telefon | Manuell entgegengenommen | Keine Automatisierung |
| Filiale | Persoenlich vor Ort | Keine Automatisierung |
| WhatsApp | Textnachrichten | Keine Automatisierung |
| Webseite | Kontaktformular → E-Mail | E-Mail automatisiert |

**Neukunde vs. Bestandskunde - Unterschiedliche Anforderungen:**

| Kundentyp | Terminbestaetigung | Grund |
|-----------|-------------------|-------|
| **Bestandskunde** | "JA/NEIN" per SMS reicht | Daten bekannt, Vertrauen vorhanden |
| **Neukunde** | Neukundenformular PFLICHT | Rechnungsdaten + Beauftragung noetig |

**Neukundenformular (Pflichtfelder):**
- Vollstaendiger Name
- Rechnungsadresse
- Telefonnummer
- E-Mail (optional)
- Unterschrift (Beauftragung)

> **WICHTIG:** Neukundenformular ist IMMER Pflicht - auch bei HOCH-Prio!
> Kann aber VOR ORT auf der Baustelle ausgefuellt werden (nicht vorher).
> Verhindert "Leichen" (Auftraege ohne Rechnungsdaten) und spaetere Korrekturen.

### 3.3 Servicebesuch 1 (Begutachtung + ggf. Sofort-Reparatur)

> **Neuer Begriff:** "Servicebesuch 1" statt nur "Begutachtung", weil beim
> ersten Besuch oft schon repariert werden kann!

**100€ Pauschale:**
Beim Ersttermin wird eine Pauschale von 100€ erhoben. Diese deckt:
- Anfahrt
- Begutachtung
- Ggf. Sofort-Reparatur bei Kleinigkeiten (wenn Standardteil dabei)

Die Pauschale wird bei der spaeteren Rechnung verrechnet (abgezogen).

**Ablauf Servicebesuch 1:**
1. Mitarbeiter faehrt zum Kunden
2. **Begutachtungsauftrag unterschreiben lassen** (100€ Pauschale)
   - ACHTUNG: Das ist NICHT die vollstaendige Auftragsbestaetigung!
   - Der Begutachtungsauftrag deckt nur Anfahrt + Begutachtung ab
   - Die Auftragsbestaetigung (mit vollem Preis) kommt erst bei Outcome B
3. Situation pruefen / Machbarkeit feststellen
4. **PFLICHTENTSCHEIDUNG:** Kann sofort erledigt werden? (siehe 3.3.2)

**Bei Sofort-Reparatur (Outcome A):**
- Reparatur durchfuehren (Lager-/Standardteil)
- Montageschein unterschreiben lassen
- Fertig - kein zweiter Termin noetig!

**Bei Folgeeinsatz (Outcome B):**
- Dokumentation vor Ort (siehe 3.3.2)
- Zurueck ins Buero → Ersatzteil-Recherche

**Grundsatz:** Mehr Informationen sind IMMER besser als weniger.
Fehlende Infos → Erneute Anfahrt → Zeit- und Kostenverlust.

### 3.3.1 Prio-Einstufung (Regelbasiert)

| Situation | Prioritaet |
|-----------|------------|
| Gewerbe + Fluchttueren | HOCH |
| Haustuer defekt/zu | HOCH |
| Fenster geht nicht zu (aus den Angeln, etc.) | HOCH |
| Bestandskunde | MITTEL |
| Alles andere | NORMAL |

### 3.3.2 Ergebnis Servicebesuch 1 (Pflichtentscheidung)

> **KRITISCH:** Nach jedem Servicebesuch 1 MUSS eine Entscheidung dokumentiert werden!

**OUTCOME A: Erledigt beim 1. Besuch**

Wann moeglich?
- Standardteil/Lagerteil war dabei (z.B. Rollo-Gurt, Griff, Schliessblech)
- Kleine Reparatur ohne Spezialteile (z.B. Justierung, Schmierung)
- Problem war geringer als erwartet

Dokumentation bei Outcome A:
- [ ] Montageschein ausgefuellt
- [ ] Kunde hat unterschrieben
- [ ] Kurze Beschreibung der durchgefuehrten Arbeit
- [ ] Optional: Vorher/Nachher-Fotos

→ Direkt weiter zu Rechnung, KEIN zweiter Termin.

**OUTCOME B: Folgeeinsatz noetig**

Wann?
- Ersatzteil nicht dabei / nicht im Lager
- Groesserer Defekt als erwartet
- Zugang nicht moeglich (Geruest noetig, etc.)
- Spezialteil erforderlich

**Pflicht-Dokumentation bei Outcome B:**
- [ ] Foto Gesamtsituation (Uebersicht)
- [ ] Foto Defekt (Nahaufnahme)
- [ ] Foto Typenschild / Hersteller-Logo (falls sichtbar)
- [ ] Masse (falls fuer Ersatzteil relevant)
- [ ] Hersteller (erkannt oder vermutet)
- [ ] Kurze Problembeschreibung
- [ ] Zugangssituation (Leiter? Geruest? Innen/Aussen?)

→ Weiter zu Ersatzteil-Recherche (Kap. 3.4)

### 3.3.3 Lager/Standardteil-Logik (Quick Win)

> **Ziel:** Moeglichst viele Reparaturen beim 1. Besuch erledigen!

**Typische Standardteile (immer im Fahrzeug):**

| Teil | Haeufigkeit | Bemerkung |
|------|-------------|-----------|
| Rollo-Gurte (versch. Breiten) | Sehr haeufig | Top-Kandidat fuer Sofort-Erledigung |
| Standard-Griffe | Haeufig | Wenige gaengige Modelle abdecken |
| Schliessbleche | Haeufig | Universal-Typen |
| Dichtungen (Meterware) | Mittel | Gaengige Profile |
| Schrauben/Kleinteile | Immer | Basis-Sortiment |

**Konzept: Standard-Kits (optional fuer spaeter)**

Ein "Reparatur-Kit" pro Monteur koennte enthalten:
- Top 10 der haeufigsten Ersatzteile
- Regelmaessig aufgefuellt nach Verbrauch
- Ziel: 30-50% der Reparaturen beim 1. Besuch erledigbar

→ Konkrete Umsetzung spaeter, hier nur Konzept dokumentiert.

### 3.3.4 Ressourcen-Constraints (2-Mann-Jobs)

> **WICHTIG:** Nicht jeder Job kann von einer Person erledigt werden!

**Verfuegbare Ressourcen:**

| Ressource | Besetzung | Einsatzbereich |
|-----------|-----------|----------------|
| Servicetechniker | 1 Person (solo) | Standard-Reparaturen, Begutachtungen |
| Team 1 | 2 Personen | Grosse Elemente, schwere Arbeiten |
| Team 2 | 2 Personen | Grosse Elemente, schwere Arbeiten |

**Typische 2-Mann-Jobs (vorab erkennbar):**

| Job-Typ | Grund |
|---------|-------|
| Grosse Rollos (>2m Breite) | Gewicht, Handling |
| Hebeschiebetuer | Gewicht, Groesse |
| Markise | Gewicht, Montagehoehe |
| Grosse Fensterelemente | Transport, Einbau |
| Arbeiten mit Geruest | Sicherheit |

**Planungsregel:**

- Feld `mannstaerke` = 1 / 2 / unbekannt
- **Vorab setzen** wenn aus Anfrage/Beschreibung ersichtlich
- **Nach Servicebesuch 1** korrigieren falls noetig
- 2-Mann-Einsaetze als **Block planen** (Nachmittag oder ganzer Tag)
- NICHT: "Vormittag 2 Mann, danach solo" → Teams bleiben zusammen

### 3.4 Ersatzteil-Recherche (nur bei Outcome B)

> **NUR relevant wenn Servicebesuch 1 mit Outcome B endet!**
> Bei Outcome A (erledigt) wird dieser Schritt uebersprungen.

**Ablauf (nach Rueckkehr ins Buero):**
1. Ist das Ersatzteil im Lager?
2. Falls nein: Wo bestellbar?
3. Lieferzeit ermitteln
4. Preis ermitteln

**Problem:** Dieser Prozess ist zeitaufwendig und nervenaufreibend.
Er findet erst statt, wenn der Mitarbeiter zurueck ist.

### 3.5 Auftragsbestaetigung (nur bei Outcome B)

> **NUR relevant wenn Servicebesuch 1 mit Outcome B endet!**
> Bei Outcome A wurde bereits beim 1. Besuch repariert und unterschrieben.

**Unterschied zur Begutachtungsunterschrift:**
- Begutachtungsauftrag (beim 1. Besuch): Nur 100€ Pauschale
- Auftragsbestaetigung (nach Recherche): Voller Preis fuer Reparatur

**Inhalt:**
- Kunde (Name, Adresse)
- Dienstleistung (Beschreibung der Reparatur)
- Preis (nach Ersatzteil-Recherche bekannt)
- Geschaetzte Lieferzeit/Fertigstellungstermin

**Rechtliche Bedeutung:**
Unterschriebene Auftragsbestaetigung = Beauftragung durch Kunden.
Rechtlich sicherer als nur ein Angebot.

### 3.6 Servicebesuch 2 / Reparaturdurchfuehrung (nur bei Outcome B)

> **NUR relevant wenn Servicebesuch 1 mit Outcome B endet!**
> Bei Outcome A wurde bereits beim 1. Besuch repariert - Servicebesuch 2 entfaellt.

**Vor der Fahrt:**
- Montageschein erstellen und drucken
- Mitarbeiter nimmt Montageschein mit
- Ersatzteil einpacken

**Vor Ort:**
- Reparatur durchfuehren
- Erfolgsquote: >90% (kein Breakout-Prozess noetig vorerst)
- Montageschein vom Kunden unterschreiben lassen

**Nach der Rueckkehr:**
- Montageschein scannen
- Scanner-Webhook → `documents` Tabelle (bereits automatisiert!)

### 3.7 Rechnungsstellung

**Aktuell:**
- Rechnung wird im ERP (Work4all) erstellt
- Manueller Prozess

**Optional:**
- Zahlungserinnerung bei Faelligkeit
- Mahnung bei Nichtzahlung
- Dankeschoen-E-Mail (selten genutzt)

### 3.8 Auftrags-Statusmodell

> **KRITISCH:** Jeder Auftrag hat einen klar definierten Status.
> Ohne Statusmodell keine Nachverfolgung, keine Eskalation, keine Transparenz.

**Status-Ladder (Hauptstatus):**

```
OFFEN
  │
  ▼
IN_BEARBEITUNG ──► (Kunde kontaktiert ODER Termin reserviert)
  │
  ▼
TERMIN_RESERVIERT ──► (Zeitfenster vorgeschlagen, noch nicht bestaetigt)
  │
  ▼
TERMIN_FIX ──► (Kunde hat bestaetigt)
  │
  ▼
ERLEDIGT / GESCHLOSSEN
```

**Sonderstatus:**

| Status | Bedeutung | Trigger |
|--------|-----------|---------|
| `NO_SHOW` | Kunde war nicht da | Techniker meldet zurueck |
| `NICHT_BESTAETIGT` | Kunde reagiert nicht auf Terminvorschlag | Timeout nach X Tagen |
| `ARCHIVIERT` | Auftrag storniert/abgebrochen | Manuell |
| `ZU_LANGE_OFFEN` | Flag fuer Eskalation | Aging-Regel (siehe unten) |

**Definition "bearbeitet":**

> Ein Auftrag gilt als BEARBEITET wenn mindestens EINES zutrifft:
> - Kunde wurde kontaktiert (Anruf, E-Mail, SMS)
> - Termin wurde reserviert (auch wenn noch nicht bestaetigt)

**Nur "reingeschaut" zaehlt NICHT als bearbeitet!**

**Aging-Regel (Eskalation bei Stillstand):**

| Schwelle | Aktion |
|----------|--------|
| 2 Arbeitswochen ohne "bearbeitet" | Flag `ZU_LANGE_OFFEN` setzen |
| Flag gesetzt | Prioritaets-Bonus (wird nach oben sortiert) |

> **Ziel:** Kein Auftrag bleibt ewig liegen - auch nicht die "schlechten" Termine
> (weit weg, unguenstige Lage). Aging sorgt dafuer, dass alles irgendwann drankommt.

**No-Show-Regel:**

| Situation | Reaktion |
|-----------|----------|
| Kunde erscheint nicht zum Termin | Status → `NO_SHOW` |
| Neuer Termin | NUR nach aktiver Bestaetigung durch Kunde |
| Verrechnung | Initial NICHT verrechnen (kein Mini-Rechnungs-Chaos) |

> **Spaeter optional:** No-Show-Gebuehr wenn Beauftragung nachweisbar unterschrieben.

---

## 4. Automatisierungspotenzial / SOLL-Zustand

> Dieses Kapitel beschreibt die GEWUENSCHTEN Automatisierungen.
> Priorisierung und Reihenfolge werden spaeter festgelegt.

### 4.1 Automatisierungs-Uebersicht

| # | Prozessschritt | IST | SOLL | Prioritaet |
|---|----------------|-----|------|------------|
| 1 | Reparaturbedarf erfassen | Manuell (ausser E-Mail) | Alle Kanaele automatisiert | TBD |
| 2 | Begutachtungstermin koordinieren | Telefon/E-Mail | Voice-Bot / Telegram | TBD |
| 3 | Vor-Ort-Dokumentation | Fotos per Handy | Telegram-Bot fuer Foto-Upload | TBD |
| 4 | Ersatzteil-Recherche | Manuell, zeitaufwendig | Automatisierte Recherche | HOCH |
| 5 | Auftragsbestaetigung erstellen | Manuell | Auto-generiert | TBD |
| 6 | Reparaturtermin koordinieren | Telefon/E-Mail | Voice-Bot / Telegram | TBD |
| 7 | Terminerinnerung | NICHT VORHANDEN | SMS/E-Mail/Voice-Bot | TBD |
| 8 | Montageschein erstellen | Manuell | Auto-generiert | TBD |
| 9 | Rechnung erstellen | ERP (manuell) | Automatisiert | TBD |
| 10 | Zahlungserinnerung | Manuell | Automatisiert | TBD |
| 11 | Dankeschoen-E-Mail | Selten | Automatisiert | NIEDRIG |

### 4.2 Ersatzteil-Recherche Automatisierung (hohe Prioritaet)

**Aktuelles Problem:**
- Mitarbeiter muss zurueck ins Buero
- Manuelle Recherche: Lager? Lieferant? Preis? Lieferzeit?
- Zeitverlust, Frustration (15-45 Min pro Teil!)

**Gewuenschter Ablauf:**
1. Mitarbeiter macht Foto vor Ort
2. Foto wird via Telegram oder App hochgeladen
3. **KI-Vision identifiziert Ersatzteil** (siehe 4.2.1)
4. Automatische Lager-Pruefung
5. Automatische Lieferanten-Recherche (siehe 4.2.2)
6. Preis + Lieferzeit werden ermittelt
7. **Bearbeiter gibt Bestellung frei** (siehe 4.2.3)
8. Rueckmeldung an Mitarbeiter

### 4.2.1 KI-Vision Ersatzteil-Identifikation

**Ablauf:**
1. Foto wird hochgeladen
2. KI analysiert das Bild:
   - Hersteller-Logo erkennen (Winkhaus, Siegenia, Roto, etc.)
   - Bauteil-Typ ableiten (Getriebe, Griff, Schliessblech, etc.)
   - Masse aus Foto schaetzen
3. Ersatzteil-Vorschlag mit Confidence-Score:
   - **>90%:** "Wahrscheinlich Winkhaus Getriebe Typ X" → Auto-Weiter
   - **<90%:** "Koennte A oder B sein" → Bearbeiter pruefen

**Beispiel-Output:**
```
Erkannt: Winkhaus Getriebe FFH 1101-1400
Confidence: 94%

Moegliche Artikel:
✅ Winkhaus Getriebe 1101-1400    ~42€   (94%)
○  Winkhaus Getriebe 901-1100     ~38€   (12%)
○  Siegenia Getriebe axxent       ~45€   (5%)
```

### 4.2.2 Lieferanten-Recherche

**Bekannte Lieferanten:**
- Gruen Beschlaege
- Ott Beschlaege
- Tonitec
- Febes
- eBay (fuer Nachbauten)

**WICHTIG - Technische Einschraenkung:**
Die meisten Lieferanten bieten KEINEN direkten Webshop mit API.
Viele verkaufen nur ueber Plattformen wie eBay.
→ Automatische Bestellung per API ist daher NICHT moeglich.
→ Recherche kann automatisiert werden, Bestellung bleibt manuell.

**Gewuenschtes Ergebnis (Recherche-Matrix):**
```
| Lieferant | Preis  | Lieferzeit | Verfuegbar |
|-----------|--------|------------|------------|
| Gruen     | 42,50€ | 2-3 Tage   | ✅ Lager   |
| Ott       | 44,00€ | 3-4 Tage   | ✅ Lager   |
| Tonitec   | 41,80€ | 5-7 Tage   | ⏳ Bestellware |
| eBay      | 28,00€ | 7-10 Tage  | ✅ 3 Anbieter |
```

### 4.2.3 Bestellprozess (mit Freigabe)

**Ablauf:**
1. Recherche-Ergebnis liegt vor (Matrix)
2. System schlaegt guenstigsten/schnellsten Lieferanten vor
3. **Bearbeiter gibt Bestellung frei** (1-Klick)
4. Nach Freigabe:
   - ENTWEDER: Automatische Bestellung (falls API verfuegbar)
   - ODER: Bearbeiter bestellt manuell auf der Plattform/Webseite
5. Liefertermin wird im System erfasst
6. Kunde wird automatisch informiert

**Keine Auto-Bestellung ohne Freigabe!**
Auch bei guenstigen Teilen soll der Bearbeiter immer freigeben.

### 4.3 Terminkoordination Automatisierung

> **WICHTIG:** Terminplanung erfolgt FRUEH - direkt nach Annahme/Priorisierung!
> Nicht erst nach der Ersatzteil-Recherche.

**Primaer: Terminplanung fuer Servicebesuch 1**

Nach Annahme der Anfrage sollte SOFORT ein Termin koordiniert werden:
1. Verfuegbarkeit im Kalender pruefen
2. Kunde kontaktieren (automatisch oder manuell)
3. Zeitfenster anbieten (EMPFEHLUNG: vormittags/nachmittags statt exakte Uhrzeit)
4. Termin bestaetigen

**Zeitfenster-Empfehlung:**
| Zeitfenster | Uhrzeit |
|-------------|---------|
| Frueh | 08:00 - 10:00 |
| Vormittag | 10:00 - 12:00 |
| Nachmittag | 13:00 - 16:00 |
| Spaet | 16:00 - 18:00 |

→ Gibt dem Disponenten Flexibilitaet fuer Routenoptimierung.

**Sekundaer: Terminplanung fuer Servicebesuch 2 (nur bei Outcome B)**

Trigger: Ersatzteil ist eingetroffen (Wareneingang).
Dann: Termin fuer Servicebesuch 2 koordinieren.

**Optionale Kanaele (spaeter):**
- Voice-Bot (VAPI) fuer telefonische Terminvereinbarung
- Telegram-Bot fuer schriftliche Koordination
- Self-Service Buchungslink per SMS/E-Mail

### 4.4 Terminerinnerung (konkretisiert)

> **Ziel:** No-Shows reduzieren, Kundenzufriedenheit erhoehen.

**Erinnerungs-Kaskade (Empfehlung):**

| Zeitpunkt | Kanal | Inhalt |
|-----------|-------|--------|
| 24h vorher | SMS | "Erinnerung: Morgen [DATUM] [ZEITFENSTER] kommt unser Techniker." |
| 2h vorher | SMS | "Unser Techniker ist unterwegs. Ankunft ca. [UHRZEIT]." |
| Bei Ankunft | Optional | "Techniker ist eingetroffen." |

**Interaktive Option (Empfehlung):**

SMS mit Antwort-Moeglichkeit:
```
"Termin am [DATUM] [ZEITFENSTER] - alles OK?
Antworten Sie:
JA = Termin bestaetigt
NEU = Termin verschieben"
```

Bei "NEU" → Neue Terminvorschlaege senden oder Rueckruf anbieten.

**Technische Umsetzung:**
- SMS-Gateway (z.B. Twilio, 46elks, etc.)
- Trigger: X Stunden vor Termin-Timestamp
- Optional: WhatsApp Business API als Alternative zu SMS

### 4.5 Vor-Ort-Tool fuer Monteur (zwei Szenarien)

Der Monteur braucht ein Tool fuer:
- Fotos hochladen
- Zeit erfassen
- Status melden ("Fertig" / "Ersatzteil noetig")
- Ggf. Sprachnotizen

**Szenario A: Telegram-Bot**
- Vorteile: Schnell umsetzbar, keine App-Entwicklung, bereits installiert
- Nachteile: Weniger strukturiert, keine Offline-Funktion
- Funktionen:
  - Foto-Upload vor Ort (Ersatzteil-Dokumentation)
  - Status-Abfragen ("Wo steht Auftrag X?")
  - Benachrichtigungen (Ersatzteil eingetroffen, etc.)
  - Function Triggering (manuelle Aktionen ausloesen)
  - Schnelle Kommunikation mit Buero

**Szenario B: Eigene Monteur-App**
- Vorteile: Strukturierter Ablauf, Offline-faehig, Zeiterfassung integriert
- Nachteile: Entwicklungsaufwand, Wartung
- Funktionen:
  - Tages-Briefing mit Route
  - Digitale Unterschrift auf Tablet
  - Foto-Upload mit Kontext
  - Zeiterfassung (Start/Stop)
  - Sprachnotizen
  - Offline-Sync

**Empfehlung:** Mit Telegram starten (schneller Proof of Concept), spaeter ggf. App.

### 4.6 Weitere Telegram-Integration

Falls Telegram gewaehlt wird, zusaetzliche Einsatzgebiete:
1. Benachrichtigung wenn Ersatzteil eingetroffen
2. Erinnerung an offene Aufgaben
3. Schnelle Rueckfragen ans Buero
4. Status-Updates fuer Kunden (optional)

### 4.7 Rollout-Strategie (Step 1 / Step 2)

> **KRITISCH:** Klare Abgrenzung was JETZT gebaut wird vs. was SPAETER kommt.
> Verhindert Scope-Creep und sorgt fuer schnellen ersten Nutzen.

**Step 1: Workflow-Basics (MVP)**

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| Statusmodell | OFFEN → IN_BEARBEITUNG → TERMIN_FIX → ERLEDIGT | MUSS |
| Terminplanung | Zeitfenster, Reservierung, Bestaetigung | MUSS |
| Aging/Eskalation | Flag bei >2 Wochen ohne Bearbeitung | MUSS |
| Neukunde-Formular | Pflichtfelder vor Terminbestaetigung | MUSS |
| No-Show-Handling | Status + Regel fuer Neuterminierung | MUSS |
| 2-Mann-Constraints | Feld `mannstaerke` + Planungsregel | MUSS |

**Step 2: Automatisierung & KI (spaeter)**

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| Ersatzteil-KI | Vision-basierte Identifikation | HOCH |
| Lieferanten-Recherche | Automatische Preis/Lieferzeit-Matrix | HOCH |
| Telegram-Bot | Foto-Upload, Status-Abfragen | MITTEL |
| Voice-Bot | Automatische Terminkoordination | MITTEL |
| SMS-Erinnerungen | 24h + 2h vorher automatisch | MITTEL |

**Pilot-Strategie (kein Betriebsimpact):**

```
Phase 1: Bauen & Testen (isoliert)
    │
    ▼
Phase 2: Pilot mit Servicetechniker (nur 1 Person)
    │
    ▼
Phase 3: Rollout auf Teams (wenn Modell stabil)
    │
    ▼
Phase 4: Optional Outlook-Sync (wenn gewuenscht)
```

**WICHTIG - Outlook im Pilot:**

> Outlook/Calendar-Sync ist NICHT Teil von Step 1!
> Pilot startet OHNE Outlook-Abhaengigkeit.
> Perspektivisch soll Outlook als Planungs-Zentrale abgeloest werden.
> Sync kann spaeter optional hinzugefuegt werden.

---

## 5. Technologien und Integrationen

### 5.1 Bereits im Einsatz (NICHT ANFASSEN)

| Technologie | Einsatz | Status |
|-------------|---------|--------|
| Supabase | Datenbank, Edge Functions, Storage | PRODUKTIV |
| Supabase Edge Functions | Dokumentenverarbeitung | PRODUKTIV |
| Supabase Buckets | Datei-Speicherung | PRODUKTIV |
| Microsoft Graph API | E-Mail-Webhooks | PRODUKTIV |
| GPT (OpenAI) | Kategorisierung, Extraktion | PRODUKTIV |
| Mistral (OCR) | Texterkennung | PRODUKTIV |
| Scanner-Webhook | Physische Dokumente | PRODUKTIV |

### 5.2 Geplante Technologien

| Technologie | Einsatzzweck | Status | Step |
|-------------|--------------|--------|------|
| VAPI (oder Alternative) | Voice-Bots fuer Terminkoordination | GEPLANT | Step 2 |
| Telegram Bot API | Foto-Upload, Status-Abfragen, Benachrichtigungen | GEPLANT | Step 2 |
| SMS-Gateway | Terminerinnerungen | GEPLANT | Step 2 |
| Outlook/Calendar API | Termin-Sync (optional) | SPAETER | Step 3+ |

> **Hinweis:** Outlook-Sync ist bewusst NICHT in Step 1 oder 2.
> Pilot startet ohne Outlook-Abhaengigkeit. Perspektivisch soll Outlook als
> Planungs-Zentrale abgeloest werden, nicht tiefer integriert.

### 5.3 Integrationsarchitektur (High-Level)

```
                    ┌─────────────────┐
                    │   Eingangs-     │
                    │   Kanaele       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   [E-Mail]            [Telegram]           [Voice-Bot]
   (bereits            (geplant)            (geplant)
   aktiv)
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Supabase      │
                    │   documents     │
                    │   (Datenherz)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   [Edge           [Workflow-          [Benach-
   Functions]       Engine]            richtigungen]
   (OCR, KI)        (neu)              (SMS, E-Mail)
```

---

## 6. Spezialanweisungen und Einschraenkungen

### 6.1 Code-Aenderungen

| Regel | Beschreibung |
|-------|--------------|
| ADDITIV | Neue Funktionen hinzufuegen: OK |
| MINIMAL-INVASIV | Bestehende Functions anpassen: NUR wenn unbedingt noetig |
| VERBOTEN | Bestehende Logik loeschen oder grundlegend aendern |

### 6.2 Datenbank-Aenderungen

| Regel | Beschreibung |
|-------|--------------|
| Neue Tabellen | OK, mit RLS |
| Neue Spalten in `documents` | OK, aber nicht mehr als noetig |
| Bestehende Spalten aendern | NUR nach Ruecksprache |
| Constraints entfernen | VERBOTEN |

### 6.3 Vor jeder Aenderung pruefen

1. Wird eine BESTEHENDE Funktion beruehrt?
   → Falls ja: Ist das wirklich noetig? Minimal-invasiv?

2. Koennte diese Aenderung BESTEHENDE Prozesse brechen?
   → Falls ja: Ruecksprache mit Projektleiter

3. Gibt es eine ADDITIVE Alternative?
   → Falls ja: Diese bevorzugen

### 6.4 Dokumentation

Jede neue Edge Function oder Tabelle muss in diesem Dokument (Kapitel 2) nachgetragen werden, sobald sie produktiv ist.

---

*Ende der Spezifikation*
*Version 1.5 | Erstellt: 2026-01-26 | Autor: Projektleiter (Diktat von Andreas)*
*Aenderungen v1.1: 100€ Pauschale, Prio-Einstufung, KI-Vision Ersatzteil-ID, Bestellprozess mit Freigabe, Telegram vs. App Szenarien*
*Aenderungen v1.2: Servicebesuch 1 mit 2 Outcomes (A: erledigt, B: Folgeeinsatz), Terminplanung FRUEH nach Annahme, Begutachtungsauftrag vs. Auftragsbestaetigung klargestellt, Kap. 3.3.2 + 3.3.3 neu, Terminerinnerung konkretisiert*
*Aenderungen v1.3: Auftrags-Statusmodell (Kap. 3.8), Neukunde vs. Bestandskunde (Kap. 3.2), 2-Mann-Constraints (Kap. 3.3.4), No-Show-Regel, Aging-Eskalation, Rollout-Strategie Step 1/2 (Kap. 4.7), Outlook als SPAETER markiert*
*Aenderungen v1.4: Kapitel 2 aktualisiert mit neuen Edge Functions (reparatur-api, reparatur-aging, telegram-bot) und Tabellen (reparatur_auftraege, telegram_sessions)*
*Aenderungen v1.5: Step 1 MVP KOMPLETT - reparatur-api v1.5.0 mit 10 Endpoints (Kundensuche, Outcome, Termin-SV2, Mannstaerke) - GETESTET (T011-TEST: 10/10)*
