// =============================================================================
// Budget-Prompts - GPT-basierte Fenster/Tueren-Extraktion
// Version: 1.0.0 - 2026-02-04
// =============================================================================
// Spezialisierter Prompt fuer Budget-Extraktion aus Aufmassblaettern
// Verwendet GPT statt Regex fuer bessere Erkennung
// =============================================================================

/**
 * Budget-Extraktion Ergebnis - Einzelnes Element
 */
export interface BudgetElement {
  position: number;
  raum: string;
  typ: "fenster" | "tuer" | "hst" | "festfeld" | "haustuer" | "psk";
  oeffnungsart: string;
  breite_mm: number;
  hoehe_mm: number;
  menge: number;
  zubehoer: {
    rollladen: boolean;
    rollladen_elektrisch: boolean;
    raffstore: boolean;
    raffstore_elektrisch: boolean;
    insektenschutz: boolean;
    afb: boolean;
    ifb: boolean;
    plissee: boolean;
  };
  bemerkungen: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Budget-Extraktion Ergebnis - Kontext
 */
export interface BudgetKontext {
  hersteller: string;
  system: string;
  verglasung: string;
  farbe_innen: string;
  farbe_aussen: string;
  material: string;
}

/**
 * Budget-Extraktion Ergebnis - Montage
 */
export interface BudgetMontage {
  montage: boolean;
  demontage_alt: boolean;
  entsorgung_alt: boolean;
  montage_stunden: number | null;
  montage_tage: number | null;
}

/**
 * Budget-Extraktion Ergebnis - Kunde
 */
export interface BudgetKunde {
  name: string;
  adresse: string;
  telefon: string;
  email: string;
}

/**
 * Vollstaendiges GPT-Extraktionsergebnis
 */
export interface BudgetExtractionResult {
  kunde: BudgetKunde;
  kontext: BudgetKontext;
  elemente: BudgetElement[];
  montage: BudgetMontage;
  fehlende_infos: string[];
  annahmen: string[];
  gesamt_confidence: "high" | "medium" | "low";
}

/**
 * System-Prompt fuer GPT Budget-Extraktion
 */
export const BUDGET_EXTRACTION_PROMPT = `Du bist ein Experte für Fenster und Türen bei J.S. Fenster & Türen.

Analysiere das folgende Aufmassblatt/Kundenanfrage und extrahiere ALLE Informationen für ein Budgetangebot.

EXTRAHIERE:
1. Kunde (Name, Adresse, Telefon, E-Mail wenn vorhanden)
2. Kontext (Hersteller, System, Verglasung, Farben, Material)
3. JEDES Fenster/Tür einzeln mit:
   - Raum/Zimmer
   - Typ (fenster, tuer, hst, festfeld, haustuer, psk)
   - Öffnungsart (DK, DK/K, FIX, Kipp, Dreh, L, R, L+R, etc.)
   - Breite in mm
   - Höhe in mm
   - Menge (default: 1)
   - Zubehör (Rollladen, Raffstore, elektrisch, AFB, IFB, Insektenschutz, Plissee)
   - Bemerkungen
   - Confidence (high/medium/low je nach Datenqualitaet)
4. Montage-Infos (Montage, Demontage, Entsorgung, Stunden/Tage)
5. Was FEHLT (Höhe? Farbe? Verglasung?) → fehlende_infos
6. Was ANGENOMMEN werden muss → annahmen

REGELN FÜR MASSE:
- Maße IMMER in mm ausgeben
- "1230x1480" → Breite=1230, Höhe=1480 (schon mm)
- "123x148" → ACHTUNG: könnte cm sein → Breite=1230, Höhe=1480
- "1.23x1.48" oder "1,23x1,48" → Meter → Breite=1230, Höhe=1480
- "B=1230 H=1480" → explizit
- Bei Spalten "Breite" und "Höhe" ohne Einheit: Werte <500 sind vermutlich cm
- Fenster sind typischerweise 400-3500mm breit und 400-3000mm hoch

REGELN FÜR KONTEXT:
- Hersteller Default: WERU
- System Default: CALIDO (bei 3-fach) oder CASTELLO (bei 2-fach)
- 3-fach Verglasung → System CALIDO
- 2-fach Verglasung → System CASTELLO
- Farbe Default: weiss/weiss (innen/aussen)
- Material Default: Kunststoff

REGELN FÜR ZUBEHÖR:
- "RL" oder "Rollo" → rollladen: true
- "Raff" oder "Raffstore" → raffstore: true
- "Motor" oder "elektrisch" oder "E" → ..._elektrisch: true
- "AFB" oder "Aussen-Fensterbank" → afb: true
- "IFB" oder "Innen-Fensterbank" → ifb: true
- "IS" oder "Insekt" → insektenschutz: true

REGELN FÜR TYP:
- "HT" oder "Haustür" → typ: "haustuer"
- "HST" oder "Hebeschiebetür" → typ: "hst"
- "PSK" → typ: "psk"
- "Festfeld" oder "FIX" → typ: "festfeld"
- Sonst → typ: "fenster"

CONFIDENCE:
- high: Alle Daten eindeutig vorhanden
- medium: Einige Annahmen nötig (z.B. Einheit unklar)
- low: Viele Unklarheiten

Antworte NUR mit validem JSON im folgenden Format:
{
  "kunde": {
    "name": "",
    "adresse": "",
    "telefon": "",
    "email": ""
  },
  "kontext": {
    "hersteller": "",
    "system": "",
    "verglasung": "",
    "farbe_innen": "",
    "farbe_aussen": "",
    "material": ""
  },
  "elemente": [
    {
      "position": 1,
      "raum": "",
      "typ": "fenster",
      "oeffnungsart": "",
      "breite_mm": 0,
      "hoehe_mm": 0,
      "menge": 1,
      "zubehoer": {
        "rollladen": false,
        "rollladen_elektrisch": false,
        "raffstore": false,
        "raffstore_elektrisch": false,
        "insektenschutz": false,
        "afb": false,
        "ifb": false,
        "plissee": false
      },
      "bemerkungen": "",
      "confidence": "high"
    }
  ],
  "montage": {
    "montage": true,
    "demontage_alt": false,
    "entsorgung_alt": false,
    "montage_stunden": null,
    "montage_tage": null
  },
  "fehlende_infos": [],
  "annahmen": [],
  "gesamt_confidence": "high"
}`;

/**
 * Schnellcheck ob Text Budget-Items enthalten koennte
 * (Performance-Optimierung: Nur GPT-Call wenn wahrscheinlich relevant)
 */
export function shouldExtractBudget(text: string): boolean {
  // Mindestens Mass-Angaben vorhanden?
  const hasDimensions =
    /\d{3,4}\s*[xX×*]\s*\d{3,4}/.test(text) || // mm: 1230x1480
    /\d{2,3}\s*[xX×*]\s*\d{2,3}/.test(text) || // cm: 123x148
    /[Bb]\s*[=:]\s*\d+/.test(text) ||          // B=1230
    /[Bb]reite/.test(text) ||                   // Spalte "Breite"
    /[Hh](?:oe|ö)he/.test(text);               // Spalte "Höhe"

  // Fenster/Tuer-Keywords?
  const hasElementKeywords =
    /fenster|tuer|tür|hst|festfeld|haustuer|haustür/i.test(text);

  // Aufmassblatt-Keywords?
  const hasAufmassKeywords =
    /aufmass|aufmaß|massliste|maßliste|massblatt|maßblatt/i.test(text);

  return hasDimensions && (hasElementKeywords || hasAufmassKeywords);
}

/**
 * Validiert und normalisiert das GPT-Ergebnis
 */
export function validateExtractionResult(
  result: unknown
): BudgetExtractionResult | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const data = result as Record<string, unknown>;

  // Minimale Validierung
  if (!Array.isArray(data.elemente)) {
    return null;
  }

  // Defaults setzen
  const validated: BudgetExtractionResult = {
    kunde: {
      name: (data.kunde as BudgetKunde)?.name || "",
      adresse: (data.kunde as BudgetKunde)?.adresse || "",
      telefon: (data.kunde as BudgetKunde)?.telefon || "",
      email: (data.kunde as BudgetKunde)?.email || "",
    },
    kontext: {
      hersteller: (data.kontext as BudgetKontext)?.hersteller || "WERU",
      system: (data.kontext as BudgetKontext)?.system || "",
      verglasung: (data.kontext as BudgetKontext)?.verglasung || "",
      farbe_innen: (data.kontext as BudgetKontext)?.farbe_innen || "weiss",
      farbe_aussen: (data.kontext as BudgetKontext)?.farbe_aussen || "weiss",
      material: (data.kontext as BudgetKontext)?.material || "Kunststoff",
    },
    elemente: [],
    montage: {
      montage: (data.montage as BudgetMontage)?.montage ?? true,
      demontage_alt: (data.montage as BudgetMontage)?.demontage_alt ?? false,
      entsorgung_alt: (data.montage as BudgetMontage)?.entsorgung_alt ?? false,
      montage_stunden: (data.montage as BudgetMontage)?.montage_stunden || null,
      montage_tage: (data.montage as BudgetMontage)?.montage_tage || null,
    },
    fehlende_infos: Array.isArray(data.fehlende_infos)
      ? (data.fehlende_infos as string[])
      : [],
    annahmen: Array.isArray(data.annahmen) ? (data.annahmen as string[]) : [],
    gesamt_confidence:
      (data.gesamt_confidence as "high" | "medium" | "low") || "medium",
  };

  // Elemente validieren und normalisieren
  for (const elem of data.elemente as unknown[]) {
    if (!elem || typeof elem !== "object") continue;

    const e = elem as Record<string, unknown>;

    // Pflichtfelder pruefen
    if (
      typeof e.breite_mm !== "number" ||
      typeof e.hoehe_mm !== "number" ||
      e.breite_mm <= 0 ||
      e.hoehe_mm <= 0
    ) {
      continue;
    }

    // Sanity Check: Realistische Fenstermasse (300-5000mm)
    if (
      e.breite_mm < 300 ||
      e.breite_mm > 5000 ||
      e.hoehe_mm < 300 ||
      e.hoehe_mm > 5000
    ) {
      continue;
    }

    const zubehoer = (e.zubehoer as Record<string, boolean>) || {};

    validated.elemente.push({
      position: (e.position as number) || validated.elemente.length + 1,
      raum: (e.raum as string) || "",
      typ: (e.typ as BudgetElement["typ"]) || "fenster",
      oeffnungsart: (e.oeffnungsart as string) || "",
      breite_mm: Math.round(e.breite_mm as number),
      hoehe_mm: Math.round(e.hoehe_mm as number),
      menge: (e.menge as number) || 1,
      zubehoer: {
        rollladen: zubehoer.rollladen ?? false,
        rollladen_elektrisch: zubehoer.rollladen_elektrisch ?? false,
        raffstore: zubehoer.raffstore ?? false,
        raffstore_elektrisch: zubehoer.raffstore_elektrisch ?? false,
        insektenschutz: zubehoer.insektenschutz ?? false,
        afb: zubehoer.afb ?? false,
        ifb: zubehoer.ifb ?? false,
        plissee: zubehoer.plissee ?? false,
      },
      bemerkungen: (e.bemerkungen as string) || "",
      confidence: (e.confidence as "high" | "medium" | "low") || "medium",
    });
  }

  return validated;
}
