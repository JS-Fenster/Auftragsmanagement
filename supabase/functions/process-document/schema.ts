// =============================================================================
// Process Document - Schema und TypeScript Interfaces
// Extrahiert aus index.ts fuer bessere Wartbarkeit
// =============================================================================

/**
 * v20: Kategorien die eine Unterschrift erfordern
 * Verwendet in buildDatabaseRecord() fuer Business-Logik
 */
export const UNTERSCHRIFT_ERFORDERLICH_KATEGORIEN = [
  "Auftragsbestaetigung",
  "Serviceauftrag",
  "Montageauftrag",
];

/**
 * TypeScript Interface fuer extrahierte Dokumente
 * Definiert die Struktur der GPT-Antwort nach Dokumentanalyse
 */
export interface ExtractedDocument {
  kategorie: string;
  extraktions_qualitaet: "hoch" | "mittel" | "niedrig";
  extraktions_hinweise: string[];
  dokument_datum: string | null;
  dokument_nummer: string | null;
  dokument_richtung: string | null;
  // v20: Unterschrift-Felder
  empfang_unterschrift: boolean;
  unterschrift: string | null;
  aussteller: {
    firma: string | null;
    name: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    telefon: string | null;
    email: string | null;
    ust_id: string | null;
  } | null;
  empfaenger: {
    firma: string | null;
    vorname: string | null;
    nachname: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    telefon: string | null;
    email: string | null;
    kundennummer: string | null;
  } | null;
  positionen: Array<{
    pos_nr: number | null;
    beschreibung: string | null;
    menge: number | null;
    einheit: string | null;
    einzelpreis_netto: number | null;
    gesamtpreis_netto: number | null;
  }> | null;
  summe_netto: number | null;
  mwst_betrag: number | null;
  summe_brutto: number | null;
  offener_betrag: number | null;
  zahlungsziel_tage: number | null;
  faellig_am: string | null;
  skonto_prozent: number | null;
  skonto_tage: number | null;
  bank: {
    name: string | null;
    iban: string | null;
    bic: string | null;
  } | null;
  liefertermin_datum: string | null;
  lieferzeit_wochen: number | null;
  bezug: {
    angebot_nr: string | null;
    bestellung_nr: string | null;
    lieferschein_nr: string | null;
    rechnung_nr: string | null;
    auftrag_nr: string | null;
    projekt: string | null;
  } | null;
  mahnung_stufe: number | null;
  mahngebuehren: number | null;
  verzugszinsen_betrag: number | null;
  gesamtforderung: number | null;
  betreff: string | null;
  inhalt_zusammenfassung: string | null;
  bemerkungen: string | null;
  dringlichkeit: string | null;
}

/**
 * JSON Schema fuer OpenAI Structured Output
 * Wird verwendet in categorizeAndExtract() fuer response_format
 * v23: + Kundenbestellung, Reiseunterlagen, Zahlungsavis, Bauplan
 */
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    kategorie: {
      type: "string",
      enum: [
        "Abnahmeprotokoll",
        "Angebot",
        "Aufmassblatt",
        "Auftragsbestaetigung",
        "Ausgangsrechnung",
        "Bauplan",
        "Bestellung",
        "Bild",
        "Brief_ausgehend",
        "Brief_eingehend",
        "Brief_von_Finanzamt",
        "Eingangslieferschein",
        "Eingangsrechnung",
        "Finanzierung",
        "Formular",
        "Gutschrift",
        "Kassenbeleg",
        "Kundenanfrage",
        "Kundenbestellung",
        "Kundenlieferschein",
        "Leasing",
        "Lieferantenangebot",
        "Mahnung",
        "Montageauftrag",
        "Notiz",
        "Preisanfrage",
        "Produktdatenblatt",
        "Reiseunterlagen",
        "Reklamation",
        "Serviceauftrag",
        "Skizze",
        "Sonstiges_Dokument",
        "Vertrag",
        "Zahlungsavis",
        "Zahlungserinnerung",
        "Zeichnung",
      ],
    },
    // v20: Unterschrift-Felder
    empfang_unterschrift: { type: "boolean" },
    unterschrift: { type: ["string", "null"] },
    extraktions_qualitaet: {
      type: "string",
      enum: ["hoch", "mittel", "niedrig"],
    },
    extraktions_hinweise: {
      type: "array",
      items: { type: "string" },
    },
    dokument_datum: { type: ["string", "null"] },
    dokument_nummer: { type: ["string", "null"] },
    dokument_richtung: { type: ["string", "null"] },
    aussteller: {
      type: ["object", "null"],
      properties: {
        firma: { type: ["string", "null"] },
        name: { type: ["string", "null"] },
        strasse: { type: ["string", "null"] },
        plz: { type: ["string", "null"] },
        ort: { type: ["string", "null"] },
        telefon: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        ust_id: { type: ["string", "null"] },
      },
      required: ["firma", "name", "strasse", "plz", "ort", "telefon", "email", "ust_id"],
      additionalProperties: false,
    },
    empfaenger: {
      type: ["object", "null"],
      properties: {
        firma: { type: ["string", "null"] },
        vorname: { type: ["string", "null"] },
        nachname: { type: ["string", "null"] },
        strasse: { type: ["string", "null"] },
        plz: { type: ["string", "null"] },
        ort: { type: ["string", "null"] },
        telefon: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        kundennummer: { type: ["string", "null"] },
      },
      required: ["firma", "vorname", "nachname", "strasse", "plz", "ort", "telefon", "email", "kundennummer"],
      additionalProperties: false,
    },
    positionen: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          pos_nr: { type: ["number", "null"] },
          beschreibung: { type: ["string", "null"] },
          menge: { type: ["number", "null"] },
          einheit: { type: ["string", "null"] },
          einzelpreis_netto: { type: ["number", "null"] },
          gesamtpreis_netto: { type: ["number", "null"] },
        },
        required: ["pos_nr", "beschreibung", "menge", "einheit", "einzelpreis_netto", "gesamtpreis_netto"],
        additionalProperties: false,
      },
    },
    summe_netto: { type: ["number", "null"] },
    mwst_betrag: { type: ["number", "null"] },
    summe_brutto: { type: ["number", "null"] },
    offener_betrag: { type: ["number", "null"] },
    zahlungsziel_tage: { type: ["number", "null"] },
    faellig_am: { type: ["string", "null"] },
    skonto_prozent: { type: ["number", "null"] },
    skonto_tage: { type: ["number", "null"] },
    bank: {
      type: ["object", "null"],
      properties: {
        name: { type: ["string", "null"] },
        iban: { type: ["string", "null"] },
        bic: { type: ["string", "null"] },
      },
      required: ["name", "iban", "bic"],
      additionalProperties: false,
    },
    liefertermin_datum: { type: ["string", "null"] },
    lieferzeit_wochen: { type: ["number", "null"] },
    bezug: {
      type: ["object", "null"],
      properties: {
        angebot_nr: { type: ["string", "null"] },
        bestellung_nr: { type: ["string", "null"] },
        lieferschein_nr: { type: ["string", "null"] },
        rechnung_nr: { type: ["string", "null"] },
        auftrag_nr: { type: ["string", "null"] },
        projekt: { type: ["string", "null"] },
      },
      required: ["angebot_nr", "bestellung_nr", "lieferschein_nr", "rechnung_nr", "auftrag_nr", "projekt"],
      additionalProperties: false,
    },
    mahnung_stufe: { type: ["number", "null"] },
    mahngebuehren: { type: ["number", "null"] },
    verzugszinsen_betrag: { type: ["number", "null"] },
    gesamtforderung: { type: ["number", "null"] },
    betreff: { type: ["string", "null"] },
    inhalt_zusammenfassung: { type: ["string", "null"] },
    bemerkungen: { type: ["string", "null"] },
    dringlichkeit: { type: ["string", "null"] },
  },
  required: [
    "kategorie",
    "extraktions_qualitaet",
    "extraktions_hinweise",
    "dokument_datum",
    "dokument_nummer",
    "dokument_richtung",
    "empfang_unterschrift",
    "unterschrift",
    "aussteller",
    "empfaenger",
    "positionen",
    "summe_netto",
    "mwst_betrag",
    "summe_brutto",
    "offener_betrag",
    "zahlungsziel_tage",
    "faellig_am",
    "skonto_prozent",
    "skonto_tage",
    "bank",
    "liefertermin_datum",
    "lieferzeit_wochen",
    "bezug",
    "mahnung_stufe",
    "mahngebuehren",
    "verzugszinsen_betrag",
    "gesamtforderung",
    "betreff",
    "inhalt_zusammenfassung",
    "bemerkungen",
    "dringlichkeit",
  ],
  additionalProperties: false,
} as const;
