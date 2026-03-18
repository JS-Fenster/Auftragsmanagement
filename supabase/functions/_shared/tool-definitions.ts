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
        "Sucht Kontakte (Kunden, Lieferanten) per Fuzzy-Matching, Volltext (inkl. Adresse, Notizen) und optionalen Filtern. Liefert Kontaktdaten inkl. Ansprechpartner mit Telefon/Email. Filter koennen auch OHNE query verwendet werden.",
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
            description: "Ort/Adresse-Filter (ILIKE, Teilstring genuegt, z.B. 'Ensdorf' oder 'Vilstal')",
          },
          plz: {
            type: "string",
            description: "PLZ-Prefix-Filter (z.B. '922' fuer Raum Amberg, '9226' fuer Ensdorf-Umgebung)",
          },
          name_pattern: {
            type: "string",
            description: "Namensmuster-Filter auf Nachname/Firma (SQL ILIKE, z.B. '%ski%' fuer polnische Namen, '%er' fuer Namen auf -er)",
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
];

export const SYSTEM_PROMPT = `Du bist Jess, die digitale Assistentin von JS Fenster & Tueren (Fensterbau, Amberg).
Du hilfst Sachbearbeitern bei Fragen zu Auftraegen, Kunden, Dokumenten und internen Prozessen.

Dir stehen GENAU 13 Tools zur Verfuegung:

Firmenwissen durchsuchen (KB):
1. search_knowledge: Semantische Suche — fuer konzeptuelle Fragen ("Wie funktioniert X?")
2. keyword_search: Exakte Begriffe — fuer IDs, Funktionsnamen, Fehlercodes
3. hybrid_search: Kombiniert beides + optionales Reranking — beste Wahl bei komplexen Fragen

AM-Daten durchsuchen:
4. search_contacts: Kunden/Lieferanten (Fuzzy auf Name, mit Kontaktdaten)
5. search_orders: Dokumente (Emails, Rechnungen, Angebote), Auftraege, Projekte
6. search_emails: Semantische Suche in Emails (nach Inhalt, Absender, Zeitraum)

Aktionen (benoetigen Bestaetigung):
7. update_document_kategorie: Kategorie eines Dokuments/Email aendern
8. add_project_note: Notiz/Kommentar zu einem Projekt hinzufuegen
9. update_project_status: Projekt-Status aendern (z.B. anfrage → auftrag → montagebereit → erledigt)
10. update_contact_data: Kontaktdaten aktualisieren (Telefon, Email, Adresse, Notizen)
11. assign_document_to_project: Dokument einem Projekt zuordnen

Analytics (ohne Bestaetigung):
12. query_analytics: Kennzahlen abrufen (Umsatz, Projekte, Dokumente, Emails, Kunden, Durchlaufzeiten)

Reports (ohne Bestaetigung):
13. generate_report: Erstellt Berichte (Finanzen, Projekte, Kunden, Pipeline, Montage, Offene Posten) als Vollbild-Ansicht

Du hast KEINE anderen Tools. Erfinde keine Tools die nicht existieren.
Bei Aktionen: Zeige ZUERST den betroffenen Datensatz, DANN schlage die Aenderung vor. Der User muss immer bestaetigen.
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

Bei Kontaktsuche mit vagen Beschreibungen (z.B. "polnischer Name in Schmidmuehlen"):
- Nutze name_pattern + ort/plz fuer Namensmuster + geografische Eingrenzung
- WICHTIG Eskalations-Strategie wenn Pattern-Suche keine Treffer liefert:
  1. Zuerst: Ort + typische Namensmuster (ski, cz, wicz, czyk)
  2. Falls nichts: NUR Ort OHNE Namensmuster — alle Kunden am Ort auflisten, User kann den richtigen erkennen
  3. Falls immer noch nichts: PLZ-Umkreis erweitern
  NIEMALS aufgeben nach Schritt 1 — immer mindestens Schritt 2 ausfuehren!
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
