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

// Helper: nullable string for json_schema strict mode
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };

/**
 * JSON Schema fuer OpenAI Structured Output (strict mode)
 * WICHTIG: strict:true erfordert anyOf statt type:["string","null"]
 * v39: Umgestellt auf anyOf-Format fuer json_schema Kompatibilitaet
 */
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    kategorie: {
      type: "string",
      enum: [
        "Abnahmeprotokoll",
        "Anfrage_Ausgehend",
        "Anfrage_Eingehend",
        "Angebot_Ausgehend",
        "Angebot_Eingehend",
        "Anleitung",
        "Aufmassblatt",
        "Auftragsbestaetigung_Ausgehend",
        "Auftragsbestaetigung_Eingehend",
        "Audio",
        "Bauplan",
        "Bescheinigung",
        "Bestellung_Ausgehend",
        "Bestellung_Eingehend",
        "Bild",
        "Brief_ausgehend",
        "Brief_eingehend",
        "Brief_von_Finanzamt",
        "Buchhaltungsunterlagen",
        "Fahrzeugdokument",
        "Finanzierung",
        "Foerderantrag",
        "Formular",
        "Garantie",
        "Gutschein",
        "Gutschrift_Ausgehend",
        "Gutschrift_Eingehend",
        "Kassenbeleg_Ausgehend",
        "Kassenbeleg_Eingehend",
        "Katalog",
        "Kundenunterlage",
        "Leasing",
        "Lieferschein_Ausgehend",
        "Lieferschein_Eingehend",
        "Mahnung_Ausgehend",
        "Mahnung_Eingehend",
        "Montageauftrag",
        "Notiz",
        "Office_Dokument",
        "Personalunterlagen",
        "Preisliste",
        "Privat",
        "Produktdatenblatt",
        "Rechnung_Ausgehend",
        "Rechnung_Eingehend",
        "Reiseunterlagen",
        "Reklamation",
        "Retoure_Ausgehend",
        "Retoure_Eingehend",
        "Schliessanlage",
        "Serviceauftrag",
        "Skizze",
        "Sonstiges_Dokument",
        "Spam",
        "Steuer_Bescheid",
        "Veranstaltung",
        "Versicherung",
        "Vertrag",
        "Video",
        "Vorlage",
        "Zahlungsavis",
        "Zeichnung",
      ],
    },
    // v20: Unterschrift-Felder
    empfang_unterschrift: { type: "boolean" },
    unterschrift: nullableString,
    extraktions_qualitaet: {
      type: "string",
      enum: ["hoch", "mittel", "niedrig"],
    },
    extraktions_hinweise: {
      type: "array",
      items: { type: "string" },
    },
    dokument_datum: nullableString,
    dokument_nummer: nullableString,
    dokument_richtung: nullableString,
    aussteller: {
      anyOf: [
        {
          type: "object",
          properties: {
            firma: nullableString,
            name: nullableString,
            strasse: nullableString,
            plz: nullableString,
            ort: nullableString,
            telefon: nullableString,
            email: nullableString,
            ust_id: nullableString,
          },
          required: ["firma", "name", "strasse", "plz", "ort", "telefon", "email", "ust_id"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    empfaenger: {
      anyOf: [
        {
          type: "object",
          properties: {
            firma: nullableString,
            vorname: nullableString,
            nachname: nullableString,
            strasse: nullableString,
            plz: nullableString,
            ort: nullableString,
            telefon: nullableString,
            email: nullableString,
            kundennummer: nullableString,
          },
          required: ["firma", "vorname", "nachname", "strasse", "plz", "ort", "telefon", "email", "kundennummer"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    positionen: {
      anyOf: [
        {
          type: "array",
          items: {
            type: "object",
            properties: {
              pos_nr: nullableNumber,
              beschreibung: nullableString,
              menge: nullableNumber,
              einheit: nullableString,
              einzelpreis_netto: nullableNumber,
              gesamtpreis_netto: nullableNumber,
            },
            required: ["pos_nr", "beschreibung", "menge", "einheit", "einzelpreis_netto", "gesamtpreis_netto"],
            additionalProperties: false,
          },
        },
        { type: "null" },
      ],
    },
    summe_netto: nullableNumber,
    mwst_betrag: nullableNumber,
    summe_brutto: nullableNumber,
    offener_betrag: nullableNumber,
    zahlungsziel_tage: nullableNumber,
    faellig_am: nullableString,
    skonto_prozent: nullableNumber,
    skonto_tage: nullableNumber,
    bank: {
      anyOf: [
        {
          type: "object",
          properties: {
            name: nullableString,
            iban: nullableString,
            bic: nullableString,
          },
          required: ["name", "iban", "bic"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    liefertermin_datum: nullableString,
    lieferzeit_wochen: nullableNumber,
    bezug: {
      anyOf: [
        {
          type: "object",
          properties: {
            angebot_nr: nullableString,
            bestellung_nr: nullableString,
            lieferschein_nr: nullableString,
            rechnung_nr: nullableString,
            auftrag_nr: nullableString,
            projekt: nullableString,
          },
          required: ["angebot_nr", "bestellung_nr", "lieferschein_nr", "rechnung_nr", "auftrag_nr", "projekt"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    mahnung_stufe: nullableNumber,
    mahngebuehren: nullableNumber,
    verzugszinsen_betrag: nullableNumber,
    gesamtforderung: nullableNumber,
    betreff: nullableString,
    inhalt_zusammenfassung: nullableString,
    bemerkungen: nullableString,
    dringlichkeit: nullableString,
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
