// =============================================================================
// Shared Category Definitions, Canonicalization, and Heuristic Rules
// Version: 2.5.0 - 2026-02-23
// =============================================================================
// Aenderungen v2.5.0:
// - NEU: Kategorie "Fahrzeugdokument" (Fahrzeugschein, TÜV, Reparaturprotokoll, Stapler)
// - NEU: Kategorie "Personalunterlagen" (Stundennachweis, AU, Lohnabrechnung)
// - 36 -> 38 Kategorien
//
// Aenderungen v2.4.2:
// - FIX: canonicalizeKategorie() strippt jetzt Nummern-Prefixe ("12. Eingangslieferschein" -> "Eingangslieferschein")
//
// Aenderungen v2.4.0:
// - NEU: Kategorie "Kassenbeleg" (Tankquittungen, Baumarkt-Bons, Barbelege)
// - NEU: Heuristik-Regel Kassenbeleg (priority 82)
//
// Aenderungen v2.3.0:
// - NEU: Kategorie "Bauplan" (Grundriss, Schnitt, Ansicht, Lageplan, Architekt)
// - NEU: Kategorie "Zeichnung" (technische Zeichnungen, CAD)
// - NEU: Heuristik-Regel Bauplan (priority 88)
//
// Aenderungen v2.2.0:
// - NEU: Kategorie "Zahlungsavis" (Belastungsanzeige, Lastschrift, Sammelabbuchung)
// - NEU: Heuristik-Regel Zahlungsavis (priority 78)
//
// Aenderungen v2.1.0:
// - NEU: Kategorie "Reiseunterlagen" (Hotel, Flug, Bahn, Mietwagen)
// - NEU: Kategorie "Kundenbestellung" (PO vom Kunden an uns)
// - NEU: Heuristik-Regel Reiseunterlagen (priority 70)
// - NEU: Heuristik-Regel Kundenbestellung (priority 95)
// - VERBESSERT: Bestellung-Regel auf ausgehende Dokumente eingeschraenkt
// =============================================================================

// =============================================================================
// Canonical Document Categories (alphabetically sorted)
// =============================================================================

export const VALID_DOKUMENT_KATEGORIEN = [
  "Abnahmeprotokoll",
  "Angebot",
  "Aufmassblatt",
  "Auftragsbestaetigung",
  "Audio",
  "Ausgangsrechnung",
  "Bauplan",               // v2.3.0: Grundriss, Schnitt, Ansicht, Lageplan, Architekt
  "Bestellung",
  "Bild",
  "Brief_ausgehend",
  "Brief_eingehend",
  "Brief_von_Finanzamt",
  "Eingangslieferschein",
  "Eingangsrechnung",
  "Fahrzeugdokument",       // v2.5.0: Fahrzeugschein, TÜV, Reparatur, Stapler-Prüfung
  "Email_Anhang",
  "Email_Ausgehend",
  "Email_Eingehend",
  "Finanzierung",
  "Formular",
  "Gutschrift",
  "Kassenbeleg",            // v2.4.0: Tankquittungen, Baumarkt-Bons, Barbelege
  "Kundenanfrage",
  "Kundenbestellung",      // v2.1.0: PO vom Kunden an uns (eingehend)
  "Kundenlieferschein",
  "Leasing",
  "Lieferantenangebot",
  "Mahnung",
  "Montageauftrag",
  "Notiz",
  "Office_Dokument",
  "Personalunterlagen",     // v2.5.0: Stundennachweis, AU, Lohnabrechnung
  "Preisanfrage",
  "Produktdatenblatt",
  "Reiseunterlagen",       // v2.1.0: Hotel, Flug, Bahn, Mietwagen, Buchungen
  "Reklamation",
  "Serviceauftrag",
  "Skizze",
  "Sonstiges_Dokument",
  "Vertrag",
  "Video",
  "Zahlungsavis",          // v2.2.0: Belastungsanzeige, Lastschrift, Sammelabbuchung
  "Zahlungserinnerung",
  "Zeichnung",             // v2.3.0: Technische Zeichnungen, CAD-Zeichnungen
];

// =============================================================================
// Canonical Email Categories (alphabetically sorted)
// =============================================================================

export const VALID_EMAIL_KATEGORIEN = [
  "Anforderung_Unterlagen",
  "Angebot_Anforderung",
  "Antwort_oder_Weiterleitung",
  "Auftragserteilung",
  "BAFA_Foerderung",
  "Bestellbestaetigung",
  "Bewerbung",
  "Kundenanfrage",
  "Lead_Anfrage",
  "Lieferstatus_Update",
  "Newsletter_Werbung",
  "Rechnung_Eingang",
  "Rechnung_Gesendet",
  "Reklamation",
  "Serviceanfrage",
  "Sonstiges",
  "Terminanfrage",
  "Versicherung_Schaden",
];

// =============================================================================
// Category Aliases (legacy -> canonical)
// =============================================================================

const KATEGORIE_ALIASES: Record<string, string> = {
  // Angebotsanfrage -> Kundenanfrage
  "Angebotsanfrage": "Kundenanfrage",

  // Brief_* -> Brief_eingehend / Brief_ausgehend
  "Brief_von_Kunde": "Brief_eingehend",
  "Brief_von_Amt": "Brief_eingehend",
  "Brief_an_Kunde": "Brief_ausgehend",

  // Archiv -> Sonstiges_Dokument
  "Archiv": "Sonstiges_Dokument",

  // Produktdatenblatt Synonyme
  "Produktbeschreibung": "Produktdatenblatt",
  "Datenblatt": "Produktdatenblatt",
  "Produktblatt": "Produktdatenblatt",

  // Auftragsbestaetigung Synonyme
  "Order confirmation": "Auftragsbestaetigung",
  "Bestellbestaetigung": "Auftragsbestaetigung",

  // GPT-5 mini Typo-Korrekturen (Backtest 500 Docs, 3x aufgetreten)
  "Brief_eingend": "Brief_eingehend",
  "Brief_eingang": "Brief_eingehend",

  // v2.1.0: "Purchase order" und "PO" entfernt - kann Bestellung ODER Kundenbestellung sein
  // Heuristik entscheidet basierend auf Kontext (wer ist Absender/Empfaenger)
};

// =============================================================================
// Heuristic Rules for Keyword-Based Classification
// =============================================================================

interface HeuristicRule {
  kategorie: string;
  keywords: string[];
  priority: number; // Higher = more specific, wins in conflicts
}

const HEURISTIC_RULES: HeuristicRule[] = [
  // Auftragsbestaetigung (priority 100 - wins over Bestellung/Kundenbestellung)
  {
    kategorie: "Auftragsbestaetigung",
    keywords: [
      "auftragsbestätigung",
      "auftragsbestaetigung",
      "order confirmation",
      "bestellbestätigung",
      "bestellbestaetigung",
      "wir bestätigen ihre bestellung",
      "wir bestaetigen ihre bestellung",
      "hiermit bestätigen wir",
      "hiermit bestaetigen wir",
      "auftragsnummer",
      "lieferwoche",
      "auftragseingang",
    ],
    priority: 100,
  },

  // v2.1.0: Kundenbestellung (priority 95) - PO vom Kunden an uns
  // Erkennt eingehende Bestellungen wo J.S. Fenster als Lieferant adressiert ist
  {
    kategorie: "Kundenbestellung",
    keywords: [
      "bitte auf lieferschein und rechnung angeben",
      "bitte auf lieferschein angeben",
      "bitte angeben auf lieferschein",
      "lieferant: j.s. fenster",
      "lieferant: js fenster",
      "an: j.s. fenster",
      "an: js fenster",
      "ihre bestellnummer",
      "unsere bestellnummer", // aus Kundensicht
      "bestellung an j.s.",
      "bestellung an js",
      "purchase order an",
      "einkaufsbestellung",
      "materialbestellung",
      "abrufbestellung",
    ],
    priority: 95,
  },

  // Bestellung (priority 90) - von uns an Lieferanten (ausgehend)
  // v2.1.0: Keywords angepasst fuer ausgehende Bestellungen
  {
    kategorie: "Bestellung",
    keywords: [
      "wir bestellen",
      "hiermit bestellen wir",
      "unsere bestellung",
      "bestellung von j.s. fenster",
      "bestellung von js fenster",
      "j.s. fenster bestellt",
      "lieferanschrift:", // wir geben Lieferadresse an
      "bestellposition",
      "bestellwert",
      "bestellnummer",
      "bestelldatum",
    ],
    priority: 90,
  },

  // v2.3.0: Bauplan (priority 88) - Architektenplaene, Grundrisse, Schnitte
  // Gewinnt gegen Skizze wenn Bauplan-spezifische Keywords vorhanden
  {
    kategorie: "Bauplan",
    keywords: [
      "grundriss",
      "schnitt",
      "ansicht",
      "lageplan",
      "planstand",
      "maßstab",
      "massstab",
      "m 1:",
      "1:100",
      "1:50",
      "1:200",
      "architekt",
      "bauplan",
      "bauzeichnung",
      "geschoss",
      "erdgeschoss",
      "obergeschoss",
      "kellergeschoss",
      "dachgeschoss",
      "baugenehmigung",
      "bauantrag",
      "flurkarte",
      "kataster",
    ],
    priority: 88,
  },

  // Produktdatenblatt (priority 80)
  {
    kategorie: "Produktdatenblatt",
    keywords: [
      "datenblatt",
      "technische daten",
      "produktdaten",
      "produktbeschreibung",
      "artikelnummer",
      "ean",
      "merkmale",
      "abbildung ähnlich",
      "abbildung aehnlich",
      "technische spezifikation",
      "produktspezifikation",
      "materialangaben",
    ],
    priority: 80,
  },

  // Finanzierung (priority 85)
  {
    kategorie: "Finanzierung",
    keywords: [
      "finanzierungsangebot",
      "finanzierungsvertrag",
      "effektiver jahreszins",
      "kreditbetrag",
      "monatsrate",
      "darlehen",
      "schlussrate",
      "nominalzins",
      "tilgung",
      "kreditvertrag",
      "ratenzahlung",
      "sollzins",
    ],
    priority: 85,
  },

  // Leasing (priority 85)
  {
    kategorie: "Leasing",
    keywords: [
      "leasing",
      "leasingrate",
      "kilometerleistung",
      "restwert",
      "leasinggeber",
      "leasingvertrag",
      "leasingnehmer",
      "laufzeit monate",
      "monatliche rate",
      "leasingfaktor",
    ],
    priority: 85,
  },

  // Lieferantenangebot (priority 70)
  {
    kategorie: "Lieferantenangebot",
    keywords: [
      "unser angebot",
      "wir bieten ihnen",
      "angebotsnummer",
      "gültig bis",
      "gueltig bis",
      "angebotspreis",
      "freibleibend",
    ],
    priority: 70,
  },

  // Eingangsrechnung (priority 75)
  {
    kategorie: "Eingangsrechnung",
    keywords: [
      "rechnung",
      "rechnungsnummer",
      "rechnungsdatum",
      "zahlbar bis",
      "zahlungsziel",
      "nettobetrag",
      "mwst",
      "ust-id",
    ],
    priority: 75,
  },

  // Gutschrift (priority 80 - wins over Eingangsrechnung)
  {
    kategorie: "Gutschrift",
    keywords: [
      "gutschrift",
      "stornorechnung",
      "korrekturrechnung",
      "rückerstattung",
      "rueckerstattung",
      "haben wir gutgeschrieben",
      "schreiben wir gut",
    ],
    priority: 80,
  },

  // Mahnung (priority 85)
  {
    kategorie: "Mahnung",
    keywords: [
      "mahnung",
      "zahlungserinnerung",
      "mahngebühr",
      "mahngebuehr",
      "verzugszinsen",
      "letzte mahnung",
      "inkasso",
    ],
    priority: 85,
  },

  // v2.1.0: Reiseunterlagen (priority 70)
  // Hotel, Flug, Bahn, Mietwagen, Buchungsbestaetigungen
  {
    kategorie: "Reiseunterlagen",
    keywords: [
      "buchungsbestätigung",
      "buchungsbestaetigung",
      "reservierungsbestätigung",
      "reservierungsbestaetigung",
      "hotelreservierung",
      "zimmerreservierung",
      "hotel reservation",
      "booking confirmation",
      "check-in",
      "check-out",
      "übernachtung",
      "uebernachtung",
      "reiseplan",
      "reiseroute",
      "flugnummer",
      "flugticket",
      "boarding pass",
      "bahnticket",
      "zugticket",
      "ice ticket",
      "mietwagen",
      "rental car",
      "car rental",
      "autovermietung",
      "reiseversicherung",
      "travel insurance",
      "reisekosten",
      "hotelvoucher",
      "anreise",
      "abreise",
      "einzelzimmer",
      "doppelzimmer",
    ],
    priority: 70,
  },

  // v2.4.0: Kassenbeleg (priority 82)
  // Tankquittungen, Baumarkt-Bons, Material-Belege, Bewirtung (alles was bar bezahlt wird)
  // Priority ueber Eingangsrechnung (75) und Gutschrift (80)
  {
    kategorie: "Kassenbeleg",
    keywords: [
      "kassenbon",
      "kassenbeleg",
      "kassenquittung",
      "quittung",
      "bar bezahlt",
      "barzahlung",
      "tankquittung",
      "tankstelle",
      "baumarkt",
      "hornbach",
      "obi",
      "toom",
      "hagebau",
      "globus",
      "bewirtungsbeleg",
      "bewirtung",
      "ec-zahlung",
      "kartenzahlung",
      "trinkgeld",
      "kasse:",
      "bon-nr",
      "tse-signatur",
    ],
    priority: 82,
  },

  // v2.2.0: Zahlungsavis (priority 78)
  // Belastungsanzeige, Lastschrift, Sammelabbuchung (Info ueber ausgefuehrte Zahlung)
  // Priority knapp ueber Eingangsrechnung (75), aber unter Gutschrift (80)
  {
    kategorie: "Zahlungsavis",
    keywords: [
      "belastungsanzeige",
      "zahlungsavis",
      "zahlungsavis nr",
      "lastschrift",
      "lastschrifteinzug",
      "sepa-lastschrift",
      "sammelabbuchung",
      "sammellastschrift",
      "zahlungslauf",
      "abbuchung erfolgt",
      "wir haben abgebucht",
      "belastet ihr konto",
      "kontobelastung",
      "einzug vom",
      "abbuchungsauftrag",
    ],
    priority: 78,
  },

  // v2.3.0: Zeichnung (priority 72)
  // Technische Zeichnungen, CAD - niedriger als Bauplan (88)
  {
    kategorie: "Zeichnung",
    keywords: [
      "technische zeichnung",
      "detailzeichnung",
      "cad",
      "autocad",
      "dwg",
      "dxf",
      "konstruktionszeichnung",
      "fertigungszeichnung",
      "explosionszeichnung",
      "stückliste",
      "stueckliste",
      "bemaßung",
      "bemassung",
      "iso-ansicht",
    ],
    priority: 72,
  },
];

// =============================================================================
// Heuristic Classification Result
// =============================================================================

export interface HeuristicResult {
  kategorie: string | null;
  reason: string | null;
  matchedRule: string | null;
  confidence: "high" | "medium" | null;
}

/**
 * Applies heuristic rules to classify a document based on OCR text and filename.
 * Returns null if no rule matches with sufficient confidence.
 *
 * @param ocrText - The OCR extracted text
 * @param fileName - The original filename
 * @returns HeuristicResult with kategorie and reason, or null values if no match
 */
export function applyHeuristicRules(
  ocrText: string | null | undefined,
  fileName: string | null | undefined
): HeuristicResult {
  const noMatch: HeuristicResult = {
    kategorie: null,
    reason: null,
    matchedRule: null,
    confidence: null,
  };

  if (!ocrText && !fileName) return noMatch;

  // Normalize text for matching (lowercase, handle umlauts)
  const normalizedText = (ocrText || "").toLowerCase();
  const normalizedFileName = (fileName || "").toLowerCase();
  const combinedText = `${normalizedText} ${normalizedFileName}`;

  // Find all matching rules
  const matches: Array<{ rule: HeuristicRule; matchedKeyword: string }> = [];

  for (const rule of HEURISTIC_RULES) {
    for (const keyword of rule.keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        matches.push({ rule, matchedKeyword: keyword });
        break; // One match per rule is enough
      }
    }
  }

  if (matches.length === 0) return noMatch;

  // Sort by priority (highest first)
  matches.sort((a, b) => b.rule.priority - a.rule.priority);

  const bestMatch = matches[0];

  // Determine confidence based on match count and priority difference
  let confidence: "high" | "medium" = "medium";
  if (matches.length === 1 || bestMatch.rule.priority > matches[1]?.rule.priority + 5) {
    confidence = "high";
  }

  return {
    kategorie: bestMatch.rule.kategorie,
    reason: `Keyword "${bestMatch.matchedKeyword}" matched`,
    matchedRule: bestMatch.rule.kategorie,
    confidence,
  };
}

// =============================================================================
// Canonicalize Function
// =============================================================================

/**
 * Maps legacy/alias category names to their canonical form.
 * Returns the input unchanged if no alias exists.
 *
 * @param kategorie - The category to canonicalize
 * @returns The canonical category name
 */
export function canonicalizeKategorie(kategorie: string | null | undefined): string | null {
  if (!kategorie) return null;

  // v2.4.1: Strip numbered prefixes from GPT output (e.g. "12. Eingangslieferschein" -> "Eingangslieferschein")
  let cleaned = kategorie.replace(/^\d+\.\s*/, "");

  // Check if there's an alias mapping
  const canonical = KATEGORIE_ALIASES[cleaned];
  if (canonical) {
    console.log(`[CATEGORIES] Mapped alias: "${kategorie}" -> "${canonical}"`);
    return canonical;
  }

  if (cleaned !== kategorie) {
    console.log(`[CATEGORIES] Stripped prefix: "${kategorie}" -> "${cleaned}"`);
  }

  return cleaned;
}

/**
 * Validates if a category is in the canonical list.
 *
 * @param kategorie - The category to validate
 * @returns true if valid, false otherwise
 */
export function isValidDokumentKategorie(kategorie: string | null | undefined): boolean {
  if (!kategorie) return false;
  return VALID_DOKUMENT_KATEGORIEN.includes(kategorie);
}

/**
 * Validates if an email category is in the canonical list.
 *
 * @param kategorie - The category to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmailKategorie(kategorie: string | null | undefined): boolean {
  if (!kategorie) return false;
  return VALID_EMAIL_KATEGORIEN.includes(kategorie);
}
