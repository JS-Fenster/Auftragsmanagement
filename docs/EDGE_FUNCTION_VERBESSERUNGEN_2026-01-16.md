# Edge Function Verbesserungen - Analyse & Vorschlaege

> Erstellt: 2026-01-16 | Claude + Andreas

---

## 1. PROBLEM-ANALYSE

### 1.1 Falsche "Brief_von_Kunde" Kategorisierung

**Beobachtung:** Der Bucket "Brief_von_Kunde" enthaelt viele Dokumente die KEINE Kundenbriefe sind:

| Datei | Absender | Inhalt | FALSCH | RICHTIG |
|-------|----------|--------|--------|---------|
| 3b9a3a86...pdf | BDK Bank | Finanzierungsvertrag FORD Transit | Brief_von_Kunde | **Finanzierung** |
| 20260109110116.pdf | Mercedes-Benz Bank | Darlehen 110 CDI | Brief_von_Kunde | **Finanzierung** |
| 83a22d95...pdf | Knelsen | E-Mail Rechnungsversand Formular | Brief_von_Kunde | **Vertrag** |
| c96bd787...pdf | Planungsbuero J. Kunz | Baustellenordnung 17 Seiten | Brief_von_Kunde | **Vertrag** |

**Korrekt kategorisiert:**
| Datei | Absender | Inhalt | Kategorie |
|-------|----------|--------|-----------|
| cde79cf2...pdf | Daniela Preissel | E-Mail Re: Angebot 250499 | Brief_von_Kunde ✅ |

### 1.2 Ursache im SYSTEM_PROMPT

Aktueller Prompt (prompts.ts):
```
- Brief_von_Kunde: Eingehende Korrespondenz von Kunden
```

**Problem:**
- "Kunden" ist zu unspezifisch
- GPT interpretiert ALLES was an J.S. Fenster adressiert ist als "von Kunde"
- Keine Unterscheidung zwischen: Bank, Versicherung, Lieferant, Planungsbuero, Endkunde

### 1.3 Fehlende Kategorien im Schema

Aktuelles EXTRACTION_SCHEMA hat nur 18 Kategorien. Es fehlen die 20 neuen:

| # | Fehlende Kategorie | Beispiel |
|---|-------------------|----------|
| 1 | Finanzierung | BDK Bank Finanzierungsvertrag |
| 2 | Versicherung | Allianz Police |
| 3 | Vertrag | Baustellenordnung |
| 4 | Leistungserklaerung | WERU CE/DoP |
| 5 | Zahlungsavis | SEPA-Lastschrift |
| 6 | Quittung | Kassenbon |
| 7 | AU_Bescheinigung | Krankmeldung |
| 8 | Preisliste | KOMPOtherm Preise |
| 9 | Produktdatenblatt | Technische Daten |
| 10 | Montageanleitung | Einbauanleitung |
| 11 | KFZ_Dokument | Fahrzeugschein |
| 12 | Arbeitsvertrag | HR-Dokumente |
| 13 | Garantie | WERU Garantiepass |
| 14 | Versandbeleg | DHL Retourenschein |
| 15 | Schliessplan | IKON Schliessanlage |
| 16 | Pruefbericht | DGUV V3 Protokoll |
| 17 | Typenschild | Roto Frank Seriennummer |
| 18 | Gutschein | Geschenkgutschein |
| 19 | Lohnabrechnung | Gehaltsabrechnung |
| 20 | Urkunde | Schulungszertifikat |

### 1.4 Sonstige_Dokument Probleme

Viele "Sonstiges_Dokument" sind eigentlich:

| Datei | OCR-Hinweis | RICHTIG waere |
|-------|-------------|---------------|
| Roto Frank.jpg | Seriennummer 847 KCW | **Typenschild** |
| WERU_Garantiepass.pdf | GARANTIEPASS NR.: 31.67020 | **Garantie** |
| EG_SARNOWSKI.jpg | Handgezeichneter Grundriss | **Skizze** (existiert!) |
| THERA_MOTORS.pdf | Farbmuster Raffstore | **Produktdatenblatt** |
| 188.HEIC / 2.jpg | Fotos von Tuerschliesser | **Bild** (neu?) |

---

## 2. LOESUNGSVORSCHLAEGE

### 2.1 EXTRACTION_SCHEMA erweitern (index.ts)

```typescript
// EXTRACTION_SCHEMA.kategorie - ERWEITERT
kategorie: {
  type: "string",
  enum: [
    // === GESCHAEFTSDOKUMENTE ===
    "Preisanfrage",
    "Angebot",
    "Auftragsbestaetigung",
    "Bestellung",
    "Eingangslieferschein",
    "Eingangsrechnung",
    "Kundenlieferschein",
    "Montageauftrag",
    "Ausgangsrechnung",
    "Zahlungserinnerung",
    "Mahnung",

    // === TECHNISCHE DOKUMENTE ===
    "Leistungserklaerung",      // NEU: CE/DoP
    "Preisliste",               // NEU
    "Produktdatenblatt",        // NEU
    "Montageanleitung",         // NEU
    "Pruefbericht",             // NEU: DGUV, UVV, HU/AU
    "Schliessplan",             // NEU
    "Skizze",
    "Typenschild",              // NEU

    // === KORRESPONDENZ ===
    "Brief_an_Kunde",
    "Brief_von_Kunde",
    "Brief_von_Finanzamt",
    "Brief_von_Amt",
    "Notiz",
    "Email_Eingehend",
    "Email_Ausgehend",
    "Email_Anhang",

    // === FINANZ & VERTRAEGE ===
    "Finanzierung",             // NEU: Banken, Leasing
    "Versicherung",             // NEU: Policen
    "Vertrag",                  // NEU: Allgemeine Vertraege
    "Garantie",                 // NEU
    "Quittung",                 // NEU
    "Zahlungsavis",             // NEU: SEPA

    // === PERSONAL (SENSIBEL) ===
    "Arbeitsvertrag",           // NEU, SENSIBEL
    "AU_Bescheinigung",         // NEU, SENSIBEL
    "Lohnabrechnung",           // NEU, SENSIBEL
    "Urkunde",                  // NEU

    // === KFZ ===
    "KFZ_Dokument",             // NEU

    // === SONSTIGES ===
    "Gutschein",                // NEU
    "Versandbeleg",             // NEU
    "Video",
    "Audio",
    "Office_Dokument",
    "Archiv",
    "Sonstiges_Dokument",
  ],
}
```

### 2.2 SYSTEM_PROMPT komplett ueberarbeiten (prompts.ts)

```typescript
export const SYSTEM_PROMPT = `Du bist ein hochpraeziser Dokumentenextraktions-Assistent fuer J.S. Fenster & Tueren GmbH, Amberg.

## KATEGORIEN MIT ERKLAERUNGEN

### Geschaeftsdokumente (Kerngeschaeft)
- **Preisanfrage**: Anfrage eines Kunden nach Preisen/Angeboten
- **Angebot**: Preisangebot (von uns an Kunden ODER von Lieferanten an uns)
- **Auftragsbestaetigung**: Bestaetigung eines erteilten Auftrags
- **Bestellung**: Unsere Bestellung an Lieferanten
- **Eingangslieferschein**: Lieferschein VON Lieferanten (Ware kommt zu uns)
- **Eingangsrechnung**: Rechnung VON Lieferanten (wir zahlen)
- **Kundenlieferschein**: Lieferschein AN Kunden (Ware geht raus)
- **Montageauftrag**: Interner Auftrag fuer Montage-Team
- **Ausgangsrechnung**: Rechnung AN Kunden (Kunde zahlt uns)
- **Zahlungserinnerung**: Freundliche Erinnerung an ausstehende Zahlung
- **Mahnung**: Formelle Mahnung Stufe 1-3

### Technische Dokumente
- **Leistungserklaerung**: CE-Kennzeichnung, DoP (Declaration of Performance) von Herstellern
- **Preisliste**: Preislisten von Lieferanten (WERU, KOMPOtherm, etc.)
- **Produktdatenblatt**: Technische Datenblaetter, Spezifikationen
- **Montageanleitung**: Einbau-, Montage-, Bedienungsanleitungen
- **Pruefbericht**: Pruefprotokolle (DGUV V3 Elektro, UVV Stapler, HU/AU Fahrzeuge)
- **Schliessplan**: Schliessanlagen-Dokumentation (IKON, ASSA ABLOY)
- **Skizze**: Handgezeichnete Plaene, Massaufnahmen, technische Skizzen
- **Typenschild**: Fotos von Produktkennzeichnungen mit Seriennummer/Hersteller

### Korrespondenz
- **Brief_an_Kunde**: Ausgehende Post an unsere Kunden
- **Brief_von_Kunde**: Eingehende Post von ENDKUNDEN
  ⚠️ WICHTIG: NUR echte Kunden die bei uns kaufen/anfragen/reklamieren!
  ⚠️ NICHT: Banken, Versicherungen, Lieferanten, Planungsbueros!
- **Brief_von_Finanzamt**: Post vom Finanzamt (Steuerbescheide, Pruefungen)
- **Brief_von_Amt**: Post von anderen Behoerden (Bauamt, Gewerbeamt, etc.)
- **Notiz**: Interne Notizen, Telefonnotizen, Gespraechsprotokolle

### Finanz- und Vertragsdokumente
- **Finanzierung**: Briefe von BANKEN ueber Darlehen/Leasing/Finanzierung
  Erkennbar an: BDK Bank, Mercedes-Benz Bank, Sparkasse, VR Bank, Santander, etc.
  Stichworte: Finanzierungsvertrag, Darlehen, Schlussrate, Leasingrate
- **Versicherung**: Versicherungspolicen, Schadenmeldungen, Gruene Karte
  Erkennbar an: Allianz, HUK, AXA, DEVK, R+V, etc.
- **Vertrag**: Allgemeine Vertraege, Baustellenordnungen, Nachweiserklaerungen
  Erkennbar an: Planungsbuero, Bauleitung, SiGe-Koordinator
- **Garantie**: Garantiescheine, Garantiepaesse, Zertifikate
- **Quittung**: Kassenbons, Eigenbelege, Kleinbelege
- **Zahlungsavis**: SEPA-Lastschriften, Belastungsanzeigen

### Personal & HR (SENSIBEL!)
- **Arbeitsvertrag**: Arbeitsvertraege, bAV, VWL, HR-Vereinbarungen
- **AU_Bescheinigung**: Arbeitsunfaehigkeitsbescheinigungen (Krankmeldungen)
- **Lohnabrechnung**: Gehaltsabrechnungen, Lohnabrechnungen
- **Urkunde**: Jubilaeums-, Schulungs-, Weiterbildungsurkunden

### KFZ
- **KFZ_Dokument**: Fahrzeugscheine, Zulassungsbescheinigungen Teil I/II

### Sonstiges
- **Gutschein**: Geschenkgutscheine, Warengutscheine
- **Versandbeleg**: DHL/Hermes/UPS Belege, Retourenscheine
- **Sonstiges_Dokument**: Nur wenn KEINE andere Kategorie passt

## ENTSCHEIDUNGSREGELN (WICHTIG!)

### Regel 1: Absender-Erkennung
| Absender enthaelt | → Kategorie |
|-------------------|-------------|
| Bank, Finanzierung, Leasing | → Finanzierung |
| Versicherung, Police, Schaden | → Versicherung |
| Planungsbuero, Bauleitung, SiGe | → Vertrag |
| Finanzamt, FA, Steuer | → Brief_von_Finanzamt |
| Amt, Behoerde, Stadt, Gemeinde | → Brief_von_Amt |
| Privatperson oder Firma die kauft | → Brief_von_Kunde |

### Regel 2: Inhaltserkennung
| Dokument enthaelt | → Kategorie |
|-------------------|-------------|
| "Finanzierungsvertrag", "Darlehen", "Schlussrate" | → Finanzierung |
| "Baustellenordnung", "SiGe-Plan", "Nachweiserklaerung" | → Vertrag |
| "Leistungserklaerung", "DoP", "CE" | → Leistungserklaerung |
| "Garantiepass", "Garantieschein" | → Garantie |
| Seriennummer + Herstellerlogo auf Produkt | → Typenschild |
| Handgezeichnete Masse/Grundriss | → Skizze |

### Regel 3: Prioritaet
Bei Unklarheit: Spezifische Kategorie vor "Sonstiges_Dokument"!

## KONTEXT: J.S. Fenster & Tueren GmbH

- Standort: 92224 Amberg, Regensburger Str. 59
- Branche: Fensterbau, Tueren, Rolllaeden, Raffstores
- Lieferanten: WERU, Unilux, KOMPOtherm, Roto Frank, VELUX, Knelsen
- Banken: BDK Bank, Mercedes-Benz Bank, VR Bank Amberg-Sulzbach
- Typische Masse: mm, RAL-Farben, U-Werte, Ug-Werte`;
```

### 2.3 Dateiausschluss-Logik (index.ts)

```typescript
// Am Anfang von index.ts hinzufuegen:

// Dateitypen die NICHT verarbeitet werden sollen
const EXCLUDED_EXTENSIONS = ["ics", "vcf", "vcard"];
const EXCLUDED_PATTERNS = [/^test\./i, /^\./, /thumb/i];

function shouldExcludeFile(fileName: string): { exclude: boolean; reason?: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Extension-Check
  if (EXCLUDED_EXTENSIONS.includes(ext)) {
    return {
      exclude: true,
      reason: `Dateityp .${ext} wird nicht verarbeitet (Kalender/Kontakte)`
    };
  }

  // Pattern-Check
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(fileName)) {
      return {
        exclude: true,
        reason: `Dateiname entspricht Ausschlussmuster: ${pattern}`
      };
    }
  }

  return { exclude: false };
}

// In Deno.serve() nach File-Check:
const exclusion = shouldExcludeFile(file.name);
if (exclusion.exclude) {
  console.log(`AUSGESCHLOSSEN: ${file.name} - ${exclusion.reason}`);
  return new Response(JSON.stringify({
    success: false,
    excluded: true,
    reason: exclusion.reason,
    message: "Datei wurde nicht verarbeitet (ausgeschlossener Typ)",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### 2.4 Supabase Migration (CHECK Constraint)

```sql
-- Neue Kategorien zum CHECK Constraint hinzufuegen
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_kategorie_check;

ALTER TABLE documents
ADD CONSTRAINT documents_kategorie_check
CHECK (kategorie = ANY (ARRAY[
  -- Geschaeftsdokumente
  'Preisanfrage'::text,
  'Angebot'::text,
  'Auftragsbestaetigung'::text,
  'Bestellung'::text,
  'Eingangslieferschein'::text,
  'Eingangsrechnung'::text,
  'Kundenlieferschein'::text,
  'Montageauftrag'::text,
  'Ausgangsrechnung'::text,
  'Zahlungserinnerung'::text,
  'Mahnung'::text,
  -- Technische Dokumente
  'Leistungserklaerung'::text,
  'Preisliste'::text,
  'Produktdatenblatt'::text,
  'Montageanleitung'::text,
  'Pruefbericht'::text,
  'Schliessplan'::text,
  'Skizze'::text,
  'Typenschild'::text,
  -- Korrespondenz
  'Brief_an_Kunde'::text,
  'Brief_von_Kunde'::text,
  'Brief_von_Finanzamt'::text,
  'Brief_von_Amt'::text,
  'Notiz'::text,
  'Email_Eingehend'::text,
  'Email_Ausgehend'::text,
  'Email_Anhang'::text,
  -- Finanz & Vertraege
  'Finanzierung'::text,
  'Versicherung'::text,
  'Vertrag'::text,
  'Garantie'::text,
  'Quittung'::text,
  'Zahlungsavis'::text,
  -- Personal (sensibel)
  'Arbeitsvertrag'::text,
  'AU_Bescheinigung'::text,
  'Lohnabrechnung'::text,
  'Urkunde'::text,
  -- KFZ
  'KFZ_Dokument'::text,
  -- Sonstiges
  'Gutschein'::text,
  'Versandbeleg'::text,
  'Video'::text,
  'Audio'::text,
  'Office_Dokument'::text,
  'Archiv'::text,
  'Sonstiges_Dokument'::text
]));
```

---

## 3. SENSIBLE KATEGORIEN - ZUGRIFFSKONTROLLE

### 3.1 Markierte sensible Kategorien

| Kategorie | Sensibel | Grund |
|-----------|----------|-------|
| AU_Bescheinigung | 🔒 | Gesundheitsdaten |
| Lohnabrechnung | 🔒 | Gehaltsdaten |
| Arbeitsvertrag | 🔒 | Personaldaten |
| Finanzierung | 🔒 | Finanzielle Details |
| Versicherung | 🔒 | Versicherungsdaten |

### 3.2 Vorschlag: sensibel-Feld

```sql
-- Spalte hinzufuegen
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS sensibel BOOLEAN DEFAULT FALSE;

-- Automatisch setzen bei sensiblen Kategorien
CREATE OR REPLACE FUNCTION set_sensibel_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kategorie IN (
    'AU_Bescheinigung',
    'Lohnabrechnung',
    'Arbeitsvertrag',
    'Finanzierung',
    'Versicherung'
  ) THEN
    NEW.sensibel := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_sensibel_trigger
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_sensibel_flag();
```

---

## 4. ZUSAMMENFASSUNG DER AENDERUNGEN

### Dateien die geaendert werden muessen:

| Datei | Aenderung | Prioritaet |
|-------|-----------|------------|
| `index.ts` | EXTRACTION_SCHEMA erweitern, Ausschluss-Logik | HOCH |
| `prompts.ts` | SYSTEM_PROMPT komplett neu | HOCH |
| Supabase | CHECK Constraint Migration | MITTEL |
| Supabase | sensibel-Feld + Trigger | NIEDRIG |

### Erwartete Verbesserungen:

1. **Finanzierungs-Dokumente** werden korrekt als "Finanzierung" erkannt
2. **Versicherungs-Dokumente** werden korrekt als "Versicherung" erkannt
3. **Vertraege/Baustellenordnungen** werden korrekt als "Vertrag" erkannt
4. **Brief_von_Kunde** nur noch fuer echte Kundenbriefe
5. **Weniger Sonstiges_Dokument** durch neue spezifische Kategorien
6. **Ausgeschlossene Dateien** (.ics, test.*) werden nicht mehr verarbeitet

---

## 5. TEST-PLAN

Nach Deployment testen mit:

1. BDK Bank Finanzierungsbrief → muss "Finanzierung" werden
2. Mercedes-Benz Bank Darlehen → muss "Finanzierung" werden
3. Baustellenordnung → muss "Vertrag" werden
4. Kundin Daniela Preissel E-Mail → muss "Brief_von_Kunde" bleiben
5. WERU Garantiepass → muss "Garantie" werden
6. Roto Frank Typenschild → muss "Typenschild" werden

---

*Erstellt: 2026-01-16 | Andreas Stolarczyk + Claude*
