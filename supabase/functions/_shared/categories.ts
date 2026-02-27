// =============================================================================
// Shared Category Definitions, Canonicalization, and Heuristic Rules
// Version: 3.3.0 - 2026-02-27
// =============================================================================
// Aenderungen v3.2.0 (G-021 Email-Kategorien Bereinigung):
// - Email-Kategorien: 22 -> 29 (5 Renames + 7 Neue)
// - RENAMED: Rechnung_Eingang -> Rechnung_Eingehend
// - RENAMED: Rechnung_Gesendet -> Rechnung_Ausgehend
// - RENAMED: Bestellbestaetigung -> Auftragsbestaetigung_Eingehend
// - RENAMED: Auftragserteilung -> Bestellung_Eingehend
// - RENAMED: Angebot_Anforderung -> Anfrage_Ausgehend
// - NEU: Angebot_Eingehend, Angebot_Ausgehend, Bestellung_Ausgehend
// - NEU: Auftragsbestaetigung_Ausgehend, Mahnung_Eingehend, Mahnung_Ausgehend
// - NEU: Lieferschein_Eingehend
// - NEU: KATEGORIE_EMAIL_ALIASES Map + canonicalizeEmailKategorie()
//
// Aenderungen v3.1 (2026-02-26):
// - Mahnung -> Mahnung_Eingehend / Mahnung_Ausgehend (G-030)
//
// Aenderungen v3.0.0 (Kategorien-Rename G-021 bis G-028):
// - RENAMED: Eingehend/Ausgehend-Schema statt Kunden/Lieferanten-Prefix
// - REMOVED: Email_Anhang, Email_Eingehend, Email_Ausgehend (Pseudo-Kategorien)
// - NEU: Steuer_Bescheid, Freistellungsbescheinigung, Buchhaltungsunterlagen
// - NEU: Retoure_Eingehend, Retoure_Ausgehend
// - 40 -> 45 Dokument-Kategorien, 18 -> 22 Email-Kategorien
// =============================================================================

// =============================================================================
// Canonical Document Categories (alphabetically sorted)
// =============================================================================

export const VALID_DOKUMENT_KATEGORIEN = [
  "Abnahmeprotokoll",
  "Anfrage_Ausgehend",          // v3.0: was Preisanfrage
  "Anfrage_Eingehend",          // v3.0: was Kundenanfrage
  "Angebot_Ausgehend",          // v3.0: was Angebot (unser Angebot an Kunden)
  "Angebot_Eingehend",          // v3.0: was Lieferantenangebot
  "Anleitung",                  // v2.6.0: Bedienungs-, Montage-, Programmieranleitungen
  "Aufmassblatt",
  "Auftragsbestaetigung_Ausgehend",  // v3.0: Split von Auftragsbestaetigung
  "Auftragsbestaetigung_Eingehend",  // v3.0: Split von Auftragsbestaetigung
  "Audio",
  "Bauplan",                    // v2.3.0: Grundriss, Schnitt, Ansicht, Lageplan, Architekt
  "Bestellung_Ausgehend",       // v3.0: was Bestellung (von uns an Lieferanten)
  "Bestellung_Eingehend",       // v3.0: was Kundenbestellung (PO vom Kunden an uns)
  "Bild",
  "Brief_ausgehend",
  "Brief_eingehend",
  "Brief_von_Finanzamt",
  "Buchhaltungsunterlagen",     // v3.0: NEU
  "Fahrzeugdokument",           // v2.5.0: Fahrzeugschein, TUeV, Reparatur, Stapler-Pruefung
  "Finanzierung",
  "Formular",
  "Freistellungsbescheinigung", // v3.0: NEU
  "Gutschrift",
  "Kassenbeleg_Ausgehend",      // v3.3: Split (von uns erstellt, Verkauf/Einnahme)
  "Kassenbeleg_Eingehend",      // v3.3: Split (erhalten, Einkauf/Ausgabe)
  "Leasing",
  "Lieferschein_Ausgehend",     // v3.0: was Kundenlieferschein
  "Lieferschein_Eingehend",     // v3.0: was Eingangslieferschein
  "Mahnung_Ausgehend",           // v3.1: Split Eingehend/Ausgehend
  "Mahnung_Eingehend",           // v3.1: Split (was Mahnung, merged mit Zahlungserinnerung)
  "Montageauftrag",
  "Notiz",
  "Office_Dokument",
  "Personalunterlagen",         // v2.5.0: Stundennachweis, AU, Lohnabrechnung
  "Produktdatenblatt",
  "Rechnung_Ausgehend",         // v3.0: was Ausgangsrechnung
  "Rechnung_Eingehend",         // v3.0: was Eingangsrechnung
  "Reiseunterlagen",            // v2.1.0: Hotel, Flug, Bahn, Mietwagen, Buchungen
  "Reklamation",
  "Retoure_Ausgehend",          // v3.0: NEU
  "Retoure_Eingehend",          // v3.0: NEU
  "Serviceauftrag",
  "Skizze",
  "Sonstiges_Dokument",
  "Spam",                       // v2.6.0: Fax-Spam, Werbe-Faxe, unerwuenschte Dokumente
  "Steuer_Bescheid",            // v3.0: NEU
  "Vertrag",
  "Video",
  "Zahlungsavis",               // v2.2.0: Belastungsanzeige, Lastschrift, Sammelabbuchung
  "Zeichnung",                  // v2.3.0: Technische Zeichnungen, CAD-Zeichnungen
];

// =============================================================================
// Canonical Email Categories (alphabetically sorted)
// =============================================================================

export const VALID_EMAIL_KATEGORIEN = [
  "Anforderung_Unterlagen",
  "Anfrage_Ausgehend",              // v3.2: was Angebot_Anforderung
  "Angebot_Ausgehend",              // v3.2: NEU - Unser Angebot per Email
  "Angebot_Eingehend",              // v3.2: NEU - Lieferantenangebot per Email
  "Antwort_oder_Weiterleitung",
  "Auftragsbestaetigung_Ausgehend", // v3.2: NEU - Unsere AB per Email
  "Auftragsbestaetigung_Eingehend", // v3.2: was Bestellbestaetigung
  "Automatische_Benachrichtigung",
  "BAFA_Foerderung",
  "Bestellung_Ausgehend",           // v3.2: NEU - Unsere Bestellung per Email
  "Bestellung_Eingehend",           // v3.2: was Auftragserteilung
  "Bewerbung",
  "Intern",
  "Kundenanfrage",
  "Lead_Anfrage",
  "Lieferschein_Eingehend",         // v3.2: NEU - Lieferschein per Email
  "Lieferstatus_Update",
  "Mahnung_Ausgehend",              // v3.2: NEU - Unsere Mahnung per Email
  "Mahnung_Eingehend",              // v3.2: NEU - Mahnung vom Lieferanten per Email
  "Marktplatz_Anfrage",
  "Nachverfolgung",
  "Newsletter_Werbung",
  "Rechnung_Ausgehend",             // v3.2: was Rechnung_Gesendet
  "Rechnung_Eingehend",             // v3.2: was Rechnung_Eingang
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
  // === v3.0 Renames: Eingehend/Ausgehend-Schema ===
  "Kundenanfrage": "Anfrage_Eingehend",
  "Preisanfrage": "Anfrage_Ausgehend",
  "Angebot": "Angebot_Ausgehend",          // Default: unser Angebot
  "Lieferantenangebot": "Angebot_Eingehend",
  "Auftragsbestaetigung": "Auftragsbestaetigung_Eingehend",  // Default: vom Lieferanten
  "Bestellung": "Bestellung_Ausgehend",
  "Kundenbestellung": "Bestellung_Eingehend",
  "Eingangslieferschein": "Lieferschein_Eingehend",
  "Kundenlieferschein": "Lieferschein_Ausgehend",
  "Eingangsrechnung": "Rechnung_Eingehend",
  "Ausgangsrechnung": "Rechnung_Ausgehend",
  "Zahlungserinnerung": "Mahnung_Eingehend",
  "Mahnung": "Mahnung_Eingehend",          // v3.1: Split
  "Kassenbeleg": "Kassenbeleg_Eingehend",  // v3.3: Split (Default: erhalten/Einkauf)

  // === v3.0 Removed Pseudo-Categories ===
  "Email_Anhang": "Sonstiges_Dokument",
  "Email_Eingehend": "Sonstiges_Dokument",
  "Email_Ausgehend": "Sonstiges_Dokument",

  // === Legacy Aliases (pre-v3.0) ===
  "Angebotsanfrage": "Anfrage_Eingehend",
  "Brief_von_Kunde": "Brief_eingehend",
  "Brief_von_Amt": "Brief_eingehend",
  "Brief_an_Kunde": "Brief_ausgehend",
  "Archiv": "Sonstiges_Dokument",
  "Produktbeschreibung": "Produktdatenblatt",
  "Datenblatt": "Produktdatenblatt",
  "Produktblatt": "Produktdatenblatt",
  "Order confirmation": "Auftragsbestaetigung_Eingehend",
  "Bestellbestaetigung": "Auftragsbestaetigung_Eingehend",

  // GPT-5 mini Typo-Korrekturen
  "Brief_eingend": "Brief_eingehend",
  "Brief_eingang": "Brief_eingehend",
};

// =============================================================================
// Email Category Aliases (legacy -> canonical, v3.2.0)
// =============================================================================

const KATEGORIE_EMAIL_ALIASES: Record<string, string> = {
  "Rechnung_Eingang": "Rechnung_Eingehend",
  "Rechnung_Gesendet": "Rechnung_Ausgehend",
  "Bestellbestaetigung": "Auftragsbestaetigung_Eingehend",
  "Auftragserteilung": "Bestellung_Eingehend",
  "Angebot_Anforderung": "Anfrage_Ausgehend",
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
  // Auftragsbestaetigung_Eingehend (priority 100 - wins over Bestellung/Kundenbestellung)
  {
    kategorie: "Auftragsbestaetigung_Eingehend",
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

  // Bestellung_Eingehend (priority 95) - PO vom Kunden an uns
  {
    kategorie: "Bestellung_Eingehend",
    keywords: [
      "bitte auf lieferschein und rechnung angeben",
      "bitte auf lieferschein angeben",
      "bitte angeben auf lieferschein",
      "lieferant: j.s. fenster",
      "lieferant: js fenster",
      "an: j.s. fenster",
      "an: js fenster",
      "ihre bestellnummer",
      "unsere bestellnummer",
      "bestellung an j.s.",
      "bestellung an js",
      "purchase order an",
      "einkaufsbestellung",
      "materialbestellung",
      "abrufbestellung",
    ],
    priority: 95,
  },

  // Bestellung_Ausgehend (priority 90) - von uns an Lieferanten
  {
    kategorie: "Bestellung_Ausgehend",
    keywords: [
      "wir bestellen",
      "hiermit bestellen wir",
      "unsere bestellung",
      "bestellung von j.s. fenster",
      "bestellung von js fenster",
      "j.s. fenster bestellt",
      "lieferanschrift:",
      "bestellposition",
      "bestellwert",
      "bestellnummer",
      "bestelldatum",
    ],
    priority: 90,
  },

  // Bauplan (priority 88)
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

  // Mahnung_Eingehend (priority 85) - Default: eingehende Mahnungen
  {
    kategorie: "Mahnung_Eingehend",
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

  // Kassenbeleg_Eingehend (priority 82) - Default: erhaltene Belege
  {
    kategorie: "Kassenbeleg_Eingehend",
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

  // Gutschrift (priority 80 - wins over Rechnung_Eingehend)
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

  // Zahlungsavis (priority 78)
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

  // Rechnung_Eingehend (priority 75)
  {
    kategorie: "Rechnung_Eingehend",
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

  // Zeichnung (priority 72)
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

  // Angebot_Eingehend (priority 70) - Lieferantenangebot
  {
    kategorie: "Angebot_Eingehend",
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

  // Reiseunterlagen (priority 70)
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
 * Maps legacy/alias email category names to their canonical form.
 * Returns the input unchanged if no alias exists.
 *
 * @param kategorie - The email category to canonicalize
 * @returns The canonical email category name
 */
export function canonicalizeEmailKategorie(kategorie: string | null | undefined): string | null {
  if (!kategorie) return null;

  const canonical = KATEGORIE_EMAIL_ALIASES[kategorie];
  if (canonical) {
    console.log(`[CATEGORIES] Email alias mapped: "${kategorie}" -> "${canonical}"`);
    return canonical;
  }

  return kategorie;
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
