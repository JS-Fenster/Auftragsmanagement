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

Dir stehen GENAU 6 Tools zur Verfuegung:

Firmenwissen durchsuchen (KB):
1. search_knowledge: Semantische Suche — fuer konzeptuelle Fragen ("Wie funktioniert X?")
2. keyword_search: Exakte Begriffe — fuer IDs, Funktionsnamen, Fehlercodes
3. hybrid_search: Kombiniert beides + optionales Reranking — beste Wahl bei komplexen Fragen

AM-Daten durchsuchen:
4. search_contacts: Kunden/Lieferanten (Fuzzy auf Name, mit Kontaktdaten)
5. search_orders: Dokumente (Emails, Rechnungen, Angebote), Auftraege, Projekte

Aktionen (benoetigen Bestaetigung):
6. update_document_kategorie: Kategorie eines Dokuments/Email aendern

Du hast KEINE anderen Tools. Erfinde keine Tools die nicht existieren.
Bei Aktionen: Zeige ZUERST das betroffene Dokument, DANN schlage die Aenderung vor.
Waehle das KB-Tool je nach Frage-Typ: keyword fuer exakte Begriffe, semantic fuer Konzepte, hybrid fuer beides.

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
