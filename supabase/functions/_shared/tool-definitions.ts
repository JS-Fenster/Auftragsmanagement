// LLM-007 + LLM-011: Tool definitions for llm-chat orchestrator
// JSON Schema format compatible with OpenAI function calling
//
// Tool types:
// - READ tools: executed automatically, no confirmation needed
// - ACTION tools: require user confirmation before execution (LLM-011)

// Names of tools that require user confirmation before execution
export const ACTION_TOOLS = new Set([
  "update_document_kategorie",
  "add_project_note",
  "update_project_status",
  "update_contact_data",
  "assign_document_to_project",
  "create_contact_from_image",
]);

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge",
      description:
        "Semantische Suche im Firmenwissen (KB): Prozesse, Architektur, Learnings, Doku. Fuer konzeptuelle Fragen wie 'Wie funktioniert X?'. Fuer exakte Begriffe (IDs, Funktionsnamen) nutze keyword_search.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natuerlichsprachige Suchanfrage (Deutsch oder Englisch)",
          },
          top_k: {
            type: "integer",
            description: "Anzahl Ergebnisse (1-20)",
            default: 5,
          },
          filter_path: {
            type: "string",
            description:
              'Optionaler Dateipfad-Filter, z.B. "wissen/" oder "LOGBUCH.md"',
          },
          filter_projekt: {
            type: "string",
            description: 'Projekt-Filter: "AM", "PDF", "WA", "KB", "GP"',
          },
          filter_typ: {
            type: "string",
            description:
              'Typ-Filter: "typescript", "python", "sql", "wissen", "additiv", "invasiv"',
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "keyword_search",
      description:
        "Exakte Keyword-Suche im Firmenwissen (KB). Nutze dies fuer IDs (KB-L23, AM-0127), Funktionsnamen (process-email), Fehlercodes oder wenn du den genauen Begriff kennst.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Exakte Suchbegriffe",
          },
          top_k: {
            type: "integer",
            description: "Anzahl Ergebnisse (1-20)",
            default: 5,
          },
          filter_projekt: {
            type: "string",
            description: 'Projekt-Filter: "AM", "PDF", "WA", "KB", "GP"',
          },
          filter_typ: {
            type: "string",
            description:
              'Typ-Filter: "typescript", "python", "sql", "wissen", "additiv", "invasiv"',
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "hybrid_search",
      description:
        "Kombinierte Suche (semantisch + keyword) im Firmenwissen mit optionalem Reranking. Beste Wahl wenn sowohl Bedeutung als auch spezifische Begriffe wichtig sind, z.B. 'Wie funktioniert die Email-Kategorisierung in process-email?'",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Suchanfrage (Deutsch oder Englisch)",
          },
          top_k: {
            type: "integer",
            description: "Anzahl Ergebnisse (1-20)",
            default: 5,
          },
          rerank: {
            type: "boolean",
            description:
              "Reranking fuer maximale Praezision (langsamer, ~1s extra). Nur bei wichtigen Fragen.",
            default: false,
          },
          filter_projekt: {
            type: "string",
            description: 'Projekt-Filter: "AM", "PDF", "WA", "KB", "GP"',
          },
          filter_typ: {
            type: "string",
            description:
              'Typ-Filter: "typescript", "python", "sql", "wissen", "additiv", "invasiv"',
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_contacts",
      description:
        "Sucht Kontakte (Kunden, Lieferanten) per Fuzzy-Matching, Volltext, Umkreis und phonetischer Namenssuche. Liefert Kontaktdaten inkl. Ansprechpartner mit Telefon/Email. Filter koennen auch OHNE query verwendet werden. Fuer Umkreissuche: zentrum_plz + radius_km setzen. Fuer phonetische Namenssuche: name_pattern + phonetisch=true.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Suchbegriff: Firmenname, Personenname, Ort oder Stichwort. Optional wenn Filter gesetzt.",
          },
          typ: {
            type: "string",
            enum: ["kunde", "lieferant"],
            description: "Optional: Nur Kunden oder nur Lieferanten",
          },
          ort: {
            type: "string",
            description: "Ort/Adresse-Filter (ILIKE, Teilstring genuegt). Wird ignoriert wenn zentrum_plz gesetzt.",
          },
          plz: {
            type: "string",
            description: "PLZ-Prefix-Filter (z.B. '922'). Wird ignoriert wenn zentrum_plz gesetzt.",
          },
          zentrum_plz: {
            type: "string",
            description: "Zentrum-PLZ fuer Umkreissuche (z.B. '92224' fuer Amberg). Muss zusammen mit radius_km verwendet werden.",
          },
          radius_km: {
            type: "integer",
            description: "Radius in Kilometern fuer Umkreissuche (z.B. 15 fuer 15km). Muss zusammen mit zentrum_plz verwendet werden.",
          },
          name_pattern: {
            type: "string",
            description: "Namensmuster-Filter auf Nachname/Firma. Bei phonetisch=false: SQL ILIKE (z.B. '%ski%'). Bei phonetisch=true: exakter Name fuer phonetischen Vergleich (z.B. 'Rekos').",
          },
          phonetisch: {
            type: "boolean",
            description: "Aktiviert phonetischen Namensvergleich (Soundex + Levenshtein). Statt ILIKE-Pattern werden aehnlich klingende Namen gefunden. Nur sinnvoll mit name_pattern.",
            default: false,
          },
          limit: {
            type: "integer",
            description: "Max. Ergebnisse (1-50)",
            default: 10,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_orders",
      description:
        "Sucht in Dokumenten (Emails, Rechnungen, Angebote), Reparaturauftraegen und Projekten. Liefert Netto/Brutto-Betraege bei Rechnungen/Angeboten. Unterstuetzt Volltext-Suche und Filter nach Kategorie, Kunde, Status, Zeitraum. Ergebnisse sind nach Relevanz und dann nach Brutto-Betrag sortiert.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Volltext-Suchbegriff (optional wenn Filter gesetzt)",
          },
          kategorie: {
            type: "string",
            description:
              "Dokument-Kategorie: Rechnung_Eingehend, Rechnung_Ausgehend, Angebot_Eingehend, Angebot_Ausgehend, Bestellung, Auftragsbestaetigung, Lieferschein, Montageauftrag, Aufmassblatt, Reklamation, Mahnung, Email, etc.",
          },
          kunde: {
            type: "string",
            description: "Kundenname (ILIKE-Suche, Teilstring genuegt)",
          },
          status: {
            type: "string",
            description: "Status-Filter: done, pending, error, etc.",
          },
          datum_von: {
            type: "string",
            description: "Start-Datum (ISO 8601, z.B. 2026-01-01)",
          },
          datum_bis: {
            type: "string",
            description: "End-Datum (ISO 8601)",
          },
          limit: {
            type: "integer",
            description: "Max. Ergebnisse (1-100)",
            default: 20,
          },
        },
        additionalProperties: false,
      },
    },
  },
  // LLM-013: Semantic email search
  {
    type: "function" as const,
    function: {
      name: "search_emails",
      description:
        "Semantische Suche in E-Mails. Findet Emails nach Inhalt, Absender, Zeitraum. Nutze dies wenn der User nach bestimmten Emails oder Kommunikation sucht.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Suchanfrage (natuerliche Sprache, z.B. 'Lieferverzoegerung von Salamander')",
          },
          absender: {
            type: "string",
            description: "Absender-Filter (Teilstring, z.B. 'mueller' oder 'salamander')",
          },
          kategorie: {
            type: "string",
            description: "Email-Kategorie Filter",
          },
          datum_von: {
            type: "string",
            description: "Start-Datum (ISO 8601)",
          },
          datum_bis: {
            type: "string",
            description: "End-Datum (ISO 8601)",
          },
          limit: {
            type: "integer",
            description: "Max. Ergebnisse (1-50)",
            default: 10,
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  // LLM-022: Cross-entity search (READ — no confirmation needed)
  {
    type: "function" as const,
    function: {
      name: "search_combined",
      description:
        "Kombinierte Suche: Findet Kontakte MIT ihren zugehoerigen Dokumenten/Auftraegen. Nutze dies wenn der User nach Kontakten in Verbindung mit bestimmten Dokumenttypen fragt, z.B. 'Kunden mit Reklamationen', 'Lieferanten mit offenen Rechnungen im Raum Amberg', 'Wer hat letzten Monat Bestellungen gehabt?'. Liefert pro Kontakt: Anzahl Dokumente, Gesamtsumme, Kategorien, letzte Aktivitaet.",
      parameters: {
        type: "object",
        properties: {
          search_query: {
            type: "string",
            description: "Volltext-Suche in Dokumenten (optional). Findet Dokumente deren Inhalt diesen Begriff enthaelt.",
          },
          filter_kontakt_ort: {
            type: "string",
            description: "Ort-Filter fuer Kontakte (ILIKE). Wird ignoriert wenn zentrum_plz gesetzt.",
          },
          filter_kontakt_plz: {
            type: "string",
            description: "PLZ-Prefix fuer Kontakte. Wird ignoriert wenn zentrum_plz gesetzt.",
          },
          filter_kontakt_typ: {
            type: "string",
            enum: ["kunde", "lieferant"],
            description: "Nur Kunden oder Lieferanten",
          },
          filter_kontakt_name: {
            type: "string",
            description: "Firmenname-Filter (Teilstring, z.B. 'Mueller')",
          },
          filter_dok_kategorie: {
            type: "string",
            description: "Dokument-Kategorie: Rechnung_Eingehend, Rechnung_Ausgehend, Angebot_Eingehend, Angebot_Ausgehend, Bestellung, Reklamation, Mahnung, Email, etc.",
          },
          filter_dok_datum_von: {
            type: "string",
            description: "Start-Datum fuer Dokumente (ISO 8601)",
          },
          filter_dok_datum_bis: {
            type: "string",
            description: "End-Datum fuer Dokumente (ISO 8601)",
          },
          zentrum_plz: {
            type: "string",
            description: "Zentrum-PLZ fuer Umkreissuche (z.B. '92224' fuer Amberg)",
          },
          radius_km: {
            type: "integer",
            description: "Radius in km fuer Umkreissuche",
          },
          limit: {
            type: "integer",
            description: "Max. Ergebnisse (1-50)",
            default: 20,
          },
        },
        additionalProperties: false,
      },
    },
  },
  // LLM-021: Analytics tool (READ — no confirmation needed)
  {
    type: "function" as const,
    function: {
      name: "query_analytics",
      description:
        "Ruft vordefinierte Kennzahlen/Metriken ab: Umsatz, Dokumente pro Kategorie, Projektstatus-Verteilung, offene Rechnungen, Email-Volumen, Durchlaufzeiten, Top-Kunden. Gibt Labels und Werte zurueck die direkt in der Antwort verwendet werden koennen.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: [
              "umsatz_monatlich",
              "dokumente_pro_kategorie",
              "projekte_pro_status",
              "offene_rechnungen_summe",
              "email_volumen",
              "durchlaufzeit_projekte",
              "top_kunden_umsatz",
            ],
            description: "Die abzufragende Metrik",
          },
          zeitraum_von: {
            type: "string",
            description: "Start-Datum (ISO 8601)",
          },
          zeitraum_bis: {
            type: "string",
            description: "End-Datum (ISO 8601)",
          },
          gruppierung: {
            type: "string",
            enum: ["tag", "woche", "monat"],
            description: "Zeitliche Gruppierung (nur fuer umsatz_monatlich, email_volumen)",
          },
          limit: {
            type: "integer",
            description: "Max. Ergebnisse (fuer top_kunden_umsatz)",
            default: 10,
          },
        },
        required: ["metric"],
        additionalProperties: false,
      },
    },
  },
  // LLM-016: Action tools - require user confirmation
  {
    type: "function" as const,
    function: {
      name: "add_project_note",
      description:
        "Fuegt eine Notiz/Kommentar zu einem Projekt hinzu. ACHTUNG: Schreibt echte Daten! Nur wenn der User explizit darum bittet.",
      parameters: {
        type: "object",
        properties: {
          projekt_id: {
            type: "string",
            description: "UUID des Projekts",
          },
          text: {
            type: "string",
            description: "Inhalt der Notiz",
          },
          typ: {
            type: "string",
            enum: ["notiz", "intern", "kunde"],
            description: "Art der Notiz: allgemeine Notiz, interner Vermerk, oder Kunden-Kommunikation",
          },
        },
        required: ["projekt_id", "text", "typ"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_project_status",
      description:
        "Aendert den Status eines Projekts (z.B. auf 'in Montage', 'erledigt'). Aktualisiert automatisch das zugehoerige Datum und erstellt einen Historie-Eintrag.",
      parameters: {
        type: "object",
        properties: {
          projekt_id: {
            type: "string",
            description: "UUID des Projekts",
          },
          neuer_status: {
            type: "string",
            enum: [
              "anfrage", "angebot", "auftrag", "bestellt", "ab_erhalten",
              "lieferung_geplant", "montagebereit", "abnahme", "rechnung",
              "bezahlt", "erledigt", "reklamation", "storniert", "pausiert",
            ],
            description: "Neuer Projekt-Status",
          },
          kommentar: {
            type: "string",
            description: "Optionaler Kommentar zur Status-Aenderung",
          },
        },
        required: ["projekt_id", "neuer_status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_contact_data",
      description:
        "Aktualisiert Kontaktdaten eines Kunden/Lieferanten (Telefon, Email, Adresse oder Notizen). ACHTUNG: Aendert echte Daten!",
      parameters: {
        type: "object",
        properties: {
          kontakt_id: {
            type: "string",
            description: "UUID des Kontakts",
          },
          field: {
            type: "string",
            enum: ["telefon", "email", "adresse", "notizen"],
            description: "Welches Feld geaendert werden soll",
          },
          value: {
            type: "string",
            description: "Neuer Wert fuer das Feld",
          },
        },
        required: ["kontakt_id", "field", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "assign_document_to_project",
      description:
        "Ordnet ein Dokument einem Projekt zu (erstellt Verknuepfung in projekt_dokumente). Nuetzlich wenn ein Dokument noch keinem Projekt zugeordnet ist.",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "string",
            description: "UUID des Dokuments",
          },
          projekt_id: {
            type: "string",
            description: "UUID des Projekts dem das Dokument zugeordnet werden soll",
          },
        },
        required: ["document_id", "projekt_id"],
        additionalProperties: false,
      },
    },
  },
  // LLM-012: Report generation (READ tool - no confirmation needed)
  {
    type: "function" as const,
    function: {
      name: "generate_report",
      description:
        "Erstellt einen strukturierten Report/Bericht. Oeffnet sich im Dashboard als Vollbild-Ansicht mit Tabellen und Charts. Nutze dies wenn der User nach Berichten, Uebersichten oder Analysen fragt.",
      parameters: {
        type: "object",
        properties: {
          report_type: {
            type: "string",
            enum: ["finanzbericht", "projekt_zusammenfassung", "kunden_historie", "pipeline_analyse", "montage_uebersicht", "offene_posten"],
            description: "Typ des Reports",
          },
          parameters: {
            type: "object",
            description: "Report-Parameter: zeitraum_von, zeitraum_bis (ISO Datum), kunde_id, projekt_id — je nach Report-Typ",
          },
          titel: {
            type: "string",
            description: "Titel fuer den Report (wird als Ueberschrift angezeigt)",
          },
        },
        required: ["report_type", "titel"],
        additionalProperties: false,
      },
    },
  },
  // LLM-011: Action tool - requires user confirmation
  {
    type: "function" as const,
    function: {
      name: "update_document_kategorie",
      description:
        "Aendert die Kategorie eines Dokuments oder einer E-Mail. ACHTUNG: Dies aendert echte Daten! Nutze dies nur wenn der Benutzer explizit darum bittet. Zeige immer zuerst das Dokument an und frage nach Bestaetigung.",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "string",
            description: "UUID des Dokuments das geaendert werden soll",
          },
          neue_kategorie: {
            type: "string",
            description:
              "Neue Kategorie: Rechnung_Eingehend, Rechnung_Ausgehend, Angebot_Eingehend, Angebot_Ausgehend, Bestellung, Auftragsbestaetigung, Lieferschein, Montageauftrag, Aufmassblatt, Reklamation, Mahnung, Kundenanfrage, etc.",
          },
          grund: {
            type: "string",
            description: "Kurze Begruendung warum die Kategorie geaendert wird",
          },
        },
        required: ["document_id", "neue_kategorie", "grund"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_feedback",
      description:
        "Speichert einen Verbesserungsvorschlag, Bug-Report oder Feature-Wunsch in der Feedback-Tabelle. Nutze dieses Tool wenn der User ein Problem meldet, einen Verbesserungsvorschlag macht, oder du selbst einen UX-Fehler bemerkst.",
      parameters: {
        type: "object",
        properties: {
          feedback_type: {
            type: "string",
            enum: ["bug", "verbesserung", "feature", "ux"],
            description: "Art des Feedbacks",
          },
          title: {
            type: "string",
            description: "Kurzer Titel (max 100 Zeichen)",
          },
          description: {
            type: "string",
            description: "Detaillierte Beschreibung des Problems oder Vorschlags",
          },
          page_context: {
            type: "string",
            description: "Auf welcher Seite/Bereich ist das Problem aufgetreten (z.B. Cockpit, Projekte, Belege)",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "critical"],
            description: "Prioritaet: low=nice-to-have, normal=standard, high=stoert Arbeit, critical=blockiert Arbeit",
          },
        },
        required: ["feedback_type", "title", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_contact_from_image",
      description:
        "Erstellt eine neue Person mit Kontaktdaten aus extrahierten Informationen (z.B. Visitenkarte, Screenshot). Nutze dieses Tool wenn der User ein Bild mit Kontaktdaten hochlaedt und die Person anlegen moechte.",
      parameters: {
        type: "object",
        properties: {
          vorname: { type: "string", description: "Vorname der Person" },
          nachname: { type: "string", description: "Nachname der Person" },
          anrede: { type: "string", enum: ["herr", "frau", "divers"], description: "Anrede" },
          firma: { type: "string", description: "Firmenname (optional)" },
          kontaktdaten: {
            type: "array",
            description: "Kontaktdaten (Telefon, Email, etc.)",
            items: {
              type: "object",
              properties: {
                typ: { type: "string", enum: ["telefon_fest", "telefon_mobil", "email", "fax", "webseite"], description: "Typ" },
                wert: { type: "string", description: "Telefonnummer, Email-Adresse, etc." },
                label: { type: "string", description: "Label (z.B. Buero, Privat, Mobil)" },
              },
              required: ["typ", "wert"],
            },
          },
          adresse: {
            type: "object",
            description: "Adresse (optional)",
            properties: {
              strasse: { type: "string" },
              plz: { type: "string" },
              ort: { type: "string" },
            },
          },
          notiz: { type: "string", description: "Quelle/Notiz (z.B. 'Aus Visitenkarte erfasst')" },
        },
        required: ["vorname", "nachname"],
        additionalProperties: false,
      },
    },
  },
];

export const SYSTEM_PROMPT = `Du bist Jess, die digitale Assistentin von JS Fenster & Tueren (Fensterbau, Amberg).
Du hilfst Sachbearbeitern bei Fragen zu Auftraegen, Kunden, Dokumenten und internen Prozessen.

Dir stehen GENAU 16 Tools zur Verfuegung:

Firmenwissen durchsuchen (KB):
1. search_knowledge: Semantische Suche — fuer konzeptuelle Fragen ("Wie funktioniert X?")
2. keyword_search: Exakte Begriffe — fuer IDs, Funktionsnamen, Fehlercodes
3. hybrid_search: Kombiniert beides + optionales Reranking — beste Wahl bei komplexen Fragen

AM-Daten durchsuchen:
4. search_contacts: Kunden/Lieferanten (Fuzzy, Umkreis, Phonetik). Neu: zentrum_plz+radius_km fuer Umkreissuche, phonetisch=true fuer aehnlich klingende Namen
5. search_orders: Dokumente (Emails, Rechnungen, Angebote), Auftraege, Projekte
6. search_emails: Semantische Suche in Emails (nach Inhalt, Absender, Zeitraum)
7. search_combined: Kontakte + Dokumente kombiniert — fuer Fragen wie "Kunden mit Reklamationen" oder "Lieferanten mit offenen Rechnungen im Raum Amberg"

Aktionen (benoetigen Bestaetigung):
7. update_document_kategorie: Kategorie eines Dokuments/Email aendern
8. add_project_note: Notiz/Kommentar zu einem Projekt hinzufuegen
9. update_project_status: Projekt-Status aendern (z.B. anfrage → auftrag → montagebereit → erledigt)
10. update_contact_data: Kontaktdaten aktualisieren (Telefon, Email, Adresse, Notizen)
11. assign_document_to_project: Dokument einem Projekt zuordnen

Analytics (ohne Bestaetigung):
13. query_analytics: Kennzahlen abrufen (Umsatz, Projekte, Dokumente, Emails, Kunden, Durchlaufzeiten)

Reports (ohne Bestaetigung):
14. generate_report: Erstellt Berichte (Finanzen, Projekte, Kunden, Pipeline, Montage, Offene Posten) als Vollbild-Ansicht

Feedback (ohne Bestaetigung):
15. save_feedback: Speichert Verbesserungsvorschlaege, Bugs, Feature-Wuensche. Nutze es wenn der User ein Problem meldet oder du selbst einen UX-Fehler bemerkst waehrend der Konversation.
16. create_contact_from_image: Erstellt eine neue Person mit Kontaktdaten (z.B. aus Visitenkarte). Nutze es wenn der User ein Bild mit Kontaktdaten hochlaedt. Extrahiere Vorname, Nachname, Telefon, Email, Adresse aus dem Bild/Text und erstelle die Person. ERFORDERT BESTAETIGUNG.

Du hast KEINE anderen Tools. Erfinde keine Tools die nicht existieren.
Bei Aktionen: Rufe das Tool SOFORT auf wenn die Anweisung klar ist. Frage NICHT vorher im Text nach Bestaetigung — das Dashboard zeigt automatisch einen Bestaetigungs-Dialog mit allen Details. Der User bestaetigt dort per Klick.
Waehle das KB-Tool je nach Frage-Typ: keyword fuer exakte Begriffe, semantic fuer Konzepte, hybrid fuer beides.

## Dashboard-Kontext

Wenn der User 'dieses Projekt', 'dieser Kunde', 'diese Rechnung', 'hier' etc. sagt, bezieht er sich auf den aktuell im Dashboard geoeffneten Datensatz. Die Kontext-Informationen werden dir automatisch mitgegeben — nutze die entity_id und entity_type fuer deine Tool-Aufrufe.

## Deep-Links

Wenn du Ergebnisse mit konkreten Datensaetzen zurueckgibst (Kontakte, Projekte, Dokumente, Emails, Belege), formatiere sie als klickbare Links im Format: [[link:typ:uuid:Anzeigename]]

Unterstuetzte Typen: kontakt, projekt, document, email, beleg

Beispiele:
- "Der Kunde [[link:kontakt:abc-123:Mueller GmbH]] hat 3 offene Projekte."
- "Siehe [[link:projekt:def-456:Fenster EG Meier]] fuer Details."
- In Tabellen: | [[link:kontakt:id:Name]] | Ort | Status |

Verwende Deep-Links nur wenn du eine konkrete UUID hast. Erfinde keine IDs.

## Such-Strategien

Bei Kontaktsuche mit vagen Beschreibungen (z.B. "polnischer Name in Schmidmuehlen"):
- Nutze name_pattern + ort/plz fuer Namensmuster + geografische Eingrenzung
- NEU: Nutze phonetisch=true wenn der Name bekannt ist aber die Schreibweise unklar
- NEU: Nutze zentrum_plz + radius_km fuer Umkreissuche (z.B. "im Raum Amberg" → zentrum_plz='92224', radius_km=15)
- WICHTIG Eskalations-Strategie wenn Pattern-Suche keine Treffer liefert:
  1. Zuerst: Ort + typische Namensmuster (ski, cz, wicz, czyk)
  2. Falls nichts: Phonetische Suche mit phonetisch=true
  3. Falls nichts: NUR Ort/Umkreis OHNE Namensmuster — alle Kunden auflisten
  NIEMALS aufgeben nach Schritt 1 — immer mindestens Schritt 2 ausfuehren!

Bei uebergreifenden Fragen (Kontakte + Dokumente/Auftraege):
- "Kunden die reklamiert haben" → search_combined mit filter_dok_kategorie='Reklamation'
- "Lieferanten mit Rechnungen im Raum Amberg" → search_combined mit filter_kontakt_typ='lieferant', filter_dok_kategorie='Rechnung_Eingehend', zentrum_plz='92224', radius_km=20
- "Wer hat letzten Monat bestellt?" → search_combined mit filter_dok_kategorie='Bestellung', filter_dok_datum_von/bis
- search_combined ist IMMER besser als search_contacts + search_orders getrennt aufrufen!

- NIEMALS dich selbst kommentieren ("ich muss nochmal suchen", "sorry", "kein Tool genutzt") — einfach suchen und Ergebnisse zeigen

Antwort-Stil:
- Deutsch, kurz und direkt — keine langen Einleitungen
- NIEMALS technische Interna in der Antwort zeigen: keine SQL-Pattern (%ski%, %cz%), keine Tool-Namen, keine Parameter-Namen, keine PLZ-Wildcards (9226*). Stattdessen natuerliche Sprache: "polnische Endungen wie -ski, -cz" statt "%ski%, %cz%", "Umkreis Ensdorf" statt "PLZ 9226*"
- NIEMALS englische Gedanken/Anweisungen an dich selbst in die Antwort schreiben
- Ergebnisse sofort zeigen, nicht erst erklaeren was du tust
- Tabellen fuer mehrere Ergebnisse (Markdown-Format mit |)
- Bei Kontakten: Firma, Ansprechpartner, Telefon/Email
- Bei Dokumenten: Kategorie, Datum, Kunde, Zusammenfassung
- Bei Betraegen: Netto + Brutto wenn verfuegbar
- Max 2-3 Saetze Kontext, dann Daten — nicht umgekehrt
- Keine Vermutungen ueber nicht-abgefragte Daten
- Wenn Ergebnisse unvollstaendig: kurz sagen was fehlt`;
