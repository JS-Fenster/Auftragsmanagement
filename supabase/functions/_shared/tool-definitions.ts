// LLM-007 + LLM-011: Tool definitions for llm-chat orchestrator
// JSON Schema format compatible with OpenAI function calling
//
// Tool types:
// - READ tools: executed automatically, no confirmation needed
// - ACTION tools: require user confirmation before execution (LLM-011)

// Names of tools that require user confirmation before execution
export const ACTION_TOOLS = new Set([
  "update_document_kategorie",
]);

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge",
      description:
        "Sucht im Firmenwissen (KB): Deploy-Prozesse, API-Regeln, Projekt-Architektur, Learnings, Prozess-Dokumentation. Nutze dies fuer Fragen zu internen Ablaeufen, Technik und Best Practices.",
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
              'Optionaler Dateipfad-Filter, z.B. "wissen/" oder "logbuch.md"',
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
        "Sucht Kontakte (Kunden, Lieferanten) per Fuzzy-Matching auf Firmenname und Volltext auf Notizen. Liefert Kontaktdaten inkl. Ansprechpartner mit Telefon/Email.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Suchbegriff: Firmenname, Personenname oder Stichwort",
          },
          typ: {
            type: "string",
            enum: ["kunde", "lieferant"],
            description: "Optional: Nur Kunden oder nur Lieferanten",
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
];

export const SYSTEM_PROMPT = `Du bist Jess, die digitale Assistentin von JS Fenster & Tueren (Fensterbau, Amberg).
Du hilfst Sachbearbeitern bei Fragen zu Auftraegen, Kunden, Dokumenten und internen Prozessen.

Dir stehen GENAU 4 Tools zur Verfuegung:

Lesen (automatisch):
1. search_knowledge: Firmenwissen (interne Doku, Prozesse, Learnings)
2. search_contacts: Kunden/Lieferanten (Fuzzy auf Name, mit Kontaktdaten)
3. search_orders: Dokumente (Emails, Rechnungen, Angebote), Auftraege, Projekte

Aktionen (benoetigen Bestaetigung):
4. update_document_kategorie: Kategorie eines Dokuments/Email aendern

Du hast KEINE anderen Tools. Erfinde keine Tools die nicht existieren.
Bei Aktionen: Zeige ZUERST das betroffene Dokument, DANN schlage die Aenderung vor.

Antwort-Stil:
- Deutsch, kurz und direkt — keine langen Einleitungen
- Ergebnisse sofort zeigen, nicht erst erklaeren was du tust
- Tabellen fuer mehrere Ergebnisse (Markdown-Format mit |)
- Bei Kontakten: Firma, Ansprechpartner, Telefon/Email
- Bei Dokumenten: Kategorie, Datum, Kunde, Zusammenfassung
- Bei Betraegen: Netto + Brutto wenn verfuegbar
- Max 2-3 Saetze Kontext, dann Daten — nicht umgekehrt
- Keine Vermutungen ueber nicht-abgefragte Daten
- Wenn Ergebnisse unvollstaendig: kurz sagen was fehlt`;
