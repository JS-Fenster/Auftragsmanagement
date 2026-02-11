// =============================================================================
// Budget-KI - GPT-5.2 Function Calling fuer Budgetangebote
// Version: 1.3.0 - 2026-02-11
// =============================================================================
// Empfaengt Freitext-Beschreibung von Fenstern/Tueren und nutzt GPT-5.2
// mit Function Calling (tools) um:
// 1. Text in strukturierte Budget-Positionen zu parsen
// 2. Aehnliche historische Positionen in Supabase zu suchen
// 3. Budget-Schaetzung zu berechnen
// =============================================================================
// CHANGELOG v1.3.0:
// - Fix 1: Verglasung-Format Normalisierung (3fach->3-fach, 2fach->2-fach)
// - Fix 2: HST/PSK als fenster-Kategorie behandeln (kategorie-Mapping)
// =============================================================================
// CHANGELOG v1.2.0:
// - Fix 1: Fallback-Stufen 3+4 entfernt (kat+gk, nur kat) - schadet Median
// - Fix 2: DK->DKR+DKL Mapping (oeffnungsart IN statt EQ)
// - Fix 3: Rollladen Smart-Hybrid (Filter nur bei hat_rollladen=true)
// - Kein Match nach Stufe 2 -> return null + Hinweis auf berechne_fensterpreis
// =============================================================================
// CHANGELOG v1.1.0:
// - Neues Tool: suche_lv_granular (Weighted Average Matching)
// - 3-Stufen-Matching: exact -> relaxed -> fallback
// - FIX->festfeld Kategorie-Mapping
// - Rollladen-Aufpreis im Matching
// - SYSTEM_PROMPT erweitert mit Regeln fuer granulare Suche
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// ENVIRONMENT & CLIENTS
// =============================================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// CORS HEADERS
// =============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
  "Content-Type": "application/json",
};

// =============================================================================
// PRICING CONSTANTS
// =============================================================================

const SYSTEM_PRICES: Record<string, number> = {
  CASTELLO: 400,
  CALIDO: 420,
  IMPREO: 520,
  AFINO: 480,
  DEFAULT: 400,
};

const COLOR_SURCHARGES: Record<string, number> = {
  "weiss/weiss": 0,
  "weiss/anthrazit": 0.08,
  "anthrazit/weiss": 0.08,
  "anthrazit/anthrazit": 0.12,
  "golden_oak": 0.10,
  "nussbaum": 0.12,
  "schokobraun": 0.10,
  DEFAULT_COLOR: 0.05,
};

const ACCESSORY_PRICES = {
  rollladen: { price_per_m: 180, min_price: 120 },
  raffstore: { price_per_m: 280, min_price: 200 },
  motor: { price_per_unit: 150 },
  afb: { price_per_lfm: 35, min_price: 25 },
  ifb: { price_per_lfm: 45, min_price: 30 },
  insektenschutz: { price_per_unit: 80 },
  plissee: { price_per_unit: 120 },
};

const WORK_PRICES = {
  montage: { price_per_element: 80 },
  demontage: { price_per_element: 40 },
  entsorgung: { price_per_element: 25 },
};

const VAT_RATE = 19;

const MIN_WINDOW_PRICE = 150;
const OVERSIZED_SURCHARGE = 0.10;
const OVERSIZED_WIDTH_THRESHOLD = 1800;
const OVERSIZED_HEIGHT_THRESHOLD = 2400;

const MAX_TOOL_ROUNDS = 5;
const GPT_TIMEOUT_MS = 55000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundTo50(value: number): number {
  return Math.round(value / 50) * 50;
}

function normalizeColor(color: string | null | undefined): string {
  if (!color) return "weiss";
  const c = color.toLowerCase().trim();
  if (/wei[s\u00df]|white/i.test(c)) return "weiss";
  if (/anthrazit|anthracite|ral\s*7016/i.test(c)) return "anthrazit";
  if (/golden.*oak|eiche|golden/i.test(c)) return "golden_oak";
  if (/nussbaum|walnut|nuss/i.test(c)) return "nussbaum";
  if (/schoko|braun|chocolate/i.test(c)) return "schokobraun";
  return "weiss";
}

function normalizeColorKey(colorInside: string | null, colorOutside: string | null): string {
  const inside = normalizeColor(colorInside);
  const outside = normalizeColor(colorOutside);

  if (inside === outside) {
    if (inside === "weiss") return "weiss/weiss";
    if (inside === "anthrazit") return "anthrazit/anthrazit";
    if (COLOR_SURCHARGES[inside] !== undefined) return inside;
  }

  const key = `${inside}/${outside}`;
  if (COLOR_SURCHARGES[key] !== undefined) return key;

  return "DEFAULT_COLOR";
}

/**
 * v1.3.0: Normalisiert das Verglasung-Format.
 * Stellt sicher, dass immer '2-fach' oder '3-fach' (MIT Bindestrich) verwendet wird.
 * GPT sendet manchmal '2fach' oder '3fach' ohne Bindestrich.
 */
function normalizeVerglasung(verglasung: string | null | undefined): string | null {
  if (!verglasung) return null;
  const v = verglasung.trim().toLowerCase();
  if (/^3[- ]?fach$/i.test(v)) return "3-fach";
  if (/^2[- ]?fach$/i.test(v)) return "2-fach";
  return verglasung; // Unbekanntes Format durchreichen
}

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

/**
 * Tool 1: suche_leistungsverzeichnis - Text-basierte LV-Suche (Fallback)
 */
async function sucheLeistungsverzeichnis(args: {
  kategorie: string;
  suchbegriff: string;
  limit: number;
}): Promise<unknown> {
  const { kategorie, suchbegriff, limit = 10 } = args;

  try {
    let query = supabase
      .from("leistungsverzeichnis")
      .select("*")
      .ilike("bezeichnung", `%${suchbegriff}%`)
      .limit(Math.min(limit, 50));

    if (kategorie) {
      query = query.ilike("kategorie", `%${kategorie}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[TOOL] suche_leistungsverzeichnis Fehler:", error.message);
      return { error: error.message, results: [] };
    }

    return {
      results: data || [],
      count: data?.length || 0,
      suchbegriff,
      kategorie,
    };
  } catch (err) {
    console.error("[TOOL] suche_leistungsverzeichnis Exception:", err);
    return { error: String(err), results: [] };
  }
}

/**
 * Tool 2: hole_preishistorie - Holt Preishistorie fuer aehnliche Positionen
 */
async function holePreishistorie(args: {
  kategorie: string;
  breite_mm: number;
  hoehe_mm: number;
}): Promise<unknown> {
  const { kategorie, breite_mm, hoehe_mm } = args;

  const breiteTol = breite_mm * 0.15;
  const hoeheTol = hoehe_mm * 0.15;

  try {
    const { data, error } = await supabase
      .from("erp_rechnungs_positionen")
      .select(`
        id,
        bezeichnung,
        menge,
        einzel_preis,
        gesamt_preis,
        breite_mm,
        hoehe_mm,
        erp_rechnungen!inner (
          rechnungs_datum,
          rechnungs_nr
        )
      `)
      .gte("breite_mm", breite_mm - breiteTol)
      .lte("breite_mm", breite_mm + breiteTol)
      .gte("hoehe_mm", hoehe_mm - hoeheTol)
      .lte("hoehe_mm", hoehe_mm + hoeheTol)
      .order("erp_rechnungen(rechnungs_datum)", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[TOOL] hole_preishistorie Fehler:", error.message);
      return {
        error: error.message,
        results: [],
        hinweis: "Preishistorie konnte nicht abgerufen werden. Verwende Kalkulationsformel.",
      };
    }

    if (!data || data.length === 0) {
      return {
        results: [],
        hinweis: `Keine historischen Preise fuer ${breite_mm}x${hoehe_mm}mm gefunden. Verwende Kalkulationsformel.`,
        empfehlung: "berechne_fensterpreis verwenden",
      };
    }

    const preise = data
      .map((d) => d.einzel_preis)
      .filter((p): p is number => typeof p === "number" && p > 0);

    const statistik = preise.length > 0
      ? {
          min: Math.min(...preise),
          max: Math.max(...preise),
          durchschnitt: round2(preise.reduce((a, b) => a + b, 0) / preise.length),
          anzahl: preise.length,
        }
      : null;

    return {
      results: data,
      statistik,
      suchparameter: { kategorie, breite_mm, hoehe_mm },
    };
  } catch (err) {
    console.error("[TOOL] hole_preishistorie Exception:", err);
    return {
      error: String(err),
      results: [],
      hinweis: "Fehler bei Preishistorie. Verwende Kalkulationsformel.",
    };
  }
}

/**
 * Tool 3: berechne_fensterpreis - Berechnet den Fensterpreis nach Formel
 */
function berechneFensterpreis(args: {
  breite_mm: number;
  hoehe_mm: number;
  system: string;
  farbe_innen: string;
  farbe_aussen: string;
}): unknown {
  const {
    breite_mm,
    hoehe_mm,
    system = "CALIDO",
    farbe_innen = "weiss",
    farbe_aussen = "weiss",
  } = args;

  const area_sqm = (breite_mm * hoehe_mm) / 1_000_000;

  const systemKey = (system || "DEFAULT").toUpperCase();
  const base_per_sqm = SYSTEM_PRICES[systemKey] ?? SYSTEM_PRICES.DEFAULT;

  let unit_price = area_sqm * base_per_sqm;

  if (unit_price < MIN_WINDOW_PRICE) {
    unit_price = MIN_WINDOW_PRICE;
  }

  const aufschlaege: string[] = [];

  const colorKey = normalizeColorKey(farbe_innen, farbe_aussen);
  const colorSurcharge = COLOR_SURCHARGES[colorKey] ?? COLOR_SURCHARGES.DEFAULT_COLOR;
  if (colorSurcharge > 0) {
    unit_price *= 1 + colorSurcharge;
    aufschlaege.push(`Farbaufschlag ${colorKey}: +${Math.round(colorSurcharge * 100)}%`);
  }

  const isOversized = breite_mm > OVERSIZED_WIDTH_THRESHOLD || hoehe_mm > OVERSIZED_HEIGHT_THRESHOLD;
  if (isOversized) {
    unit_price *= 1 + OVERSIZED_SURCHARGE;
    aufschlaege.push(`Sondermass-Aufschlag: +${Math.round(OVERSIZED_SURCHARGE * 100)}%`);
  }

  return {
    einzel_preis: round2(unit_price),
    flaeche_qm: round2(area_sqm),
    system: systemKey,
    base_per_sqm,
    aufschlaege,
    hinweis: "Preis berechnet nach Formel: Flaeche * System-Preis * Aufschlaege",
  };
}

/**
 * Tool 4: suche_lv_granular - Strukturierte LV-Suche mit Weighted Average
 *
 * v1.3.0 - Verglasung-Normalisierung + HST/PSK als fenster:
 *   - verglasung wird normalisiert: '3fach'->'3-fach', '2fach'->'2-fach'
 *   - kategorie 'hst'/'psk' wird auf 'fenster' gemappt (zusaetzlich gesucht)
 *
 * v1.2.0 - 2-Stufen-Matching (Fallback-Stufen 3+4 entfernt):
 *   1. Exact: kategorie + oeffnungsart + groessen_klasse + verglasung + hat_rollladen (nur wenn true)
 *   2. Relaxed: kategorie + oeffnungsart + groessen_klasse (ohne verglasung/rollladen)
 *   Kein Match -> return null + Hinweis auf berechne_fensterpreis
 *
 * DK-Mapping: oeffnungsart="DK" sucht gegen IN ('DK', 'DKR', 'DKL')
 * FIX-Mapping: oeffnungsart=FIX sucht auch in kategorie=festfeld
 * RL Smart-Hybrid: hat_rollladen Filter nur bei hat_rollladen=true
 * Weighted Average: SUM(avg_preis * sample_count) / SUM(sample_count)
 */
async function sucheLvGranular(args: {
  kategorie: string;
  oeffnungsart?: string;
  groessen_klasse?: string;
  verglasung?: string;
  hat_rollladen?: boolean;
  ist_kombi?: boolean;
}): Promise<unknown> {
  const { kategorie: rawKategorie, oeffnungsart, groessen_klasse, hat_rollladen, ist_kombi } = args;

  // v1.3.0: Verglasung-Format normalisieren (3fach -> 3-fach, 2fach -> 2-fach)
  const verglasung = normalizeVerglasung(args.verglasung);

  // v1.3.0: HST/PSK Kategorie-Mapping - auf fenster mappen
  let kategorie = rawKategorie;
  if (kategorie === "hst" || kategorie === "psk") {
    console.log(`[TOOL] suche_lv_granular: Kategorie '${kategorie}' -> 'fenster' (P019 Mapping)`);
    kategorie = "fenster";
  }

  console.log(`[TOOL] suche_lv_granular: kat=${kategorie}, oeffnung=${oeffnungsart}, groesse=${groessen_klasse}, verglasung=${verglasung}, rollladen=${hat_rollladen}, kombi=${ist_kombi}`);

  try {
    // FIX-Mapping: Wenn oeffnungsart=FIX, suche AUCH in kategorie=festfeld
    const kategorien: string[] = [kategorie];
    if (oeffnungsart === "FIX" && kategorie !== "festfeld") {
      kategorien.push("festfeld");
    }
    if (kategorie === "festfeld" && !kategorien.includes("fenster")) {
      kategorien.push("fenster");
    }

    // =========================================================================
    // Helper: OA-Filter anwenden (DK-Mapping)
    // Wenn oeffnungsart="DK", suche gegen IN ('DK', 'DKR', 'DKL')
    // =========================================================================
    function applyOaFilter(query: any, oa: string): any {
      if (oa === "DK") {
        return query.in("oeffnungsart", ["DK", "DKR", "DKL"]);
      }
      return query.eq("oeffnungsart", oa);
    }

    // =========================================================================
    // Stufe 1: Exact Match
    // =========================================================================
    let matchedEntries: any[] = [];
    let matchQuality = "exact";

    if (oeffnungsart && groessen_klasse) {
      let query = supabase
        .from("leistungsverzeichnis")
        .select("*")
        .in("kategorie", kategorien)
        .eq("groessen_klasse", groessen_klasse);

      // DK-Mapping: DK -> IN ('DK', 'DKR', 'DKL')
      query = applyOaFilter(query, oeffnungsart);

      if (verglasung) {
        query = query.eq("verglasung", verglasung);
      }
      // RL Smart-Hybrid: Filter NUR bei hat_rollladen=true
      if (hat_rollladen === true) {
        query = query.eq("hat_rollladen", true);
      }
      if (typeof ist_kombi === "boolean") {
        query = query.eq("ist_kombi", ist_kombi);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[TOOL] suche_lv_granular exact Fehler:", error.message);
      } else {
        matchedEntries = data || [];
      }

      console.log(`[TOOL] Exact match: ${matchedEntries.length} Treffer`);
    }

    // =========================================================================
    // Stufe 2: Relaxed Match (falls <3 Treffer)
    // kategorie + oeffnungsart + groessen_klasse (ohne verglasung/rollladen)
    // =========================================================================
    if (matchedEntries.length < 3 && oeffnungsart && groessen_klasse) {
      matchQuality = "relaxed";

      let query = supabase
        .from("leistungsverzeichnis")
        .select("*")
        .in("kategorie", kategorien)
        .eq("groessen_klasse", groessen_klasse);

      // DK-Mapping: DK -> IN ('DK', 'DKR', 'DKL')
      query = applyOaFilter(query, oeffnungsart);

      const { data, error } = await query;

      if (error) {
        console.error("[TOOL] suche_lv_granular relaxed Fehler:", error.message);
      } else {
        matchedEntries = data || [];
      }

      console.log(`[TOOL] Relaxed match: ${matchedEntries.length} Treffer`);
    }

    // =========================================================================
    // KEIN weiterer Fallback! (Stufen 3+4 entfernt in v1.2.0)
    // Bei 0 Treffern nach Stufe 2: return no_match mit Hinweis
    // =========================================================================
    if (matchedEntries.length === 0) {
      console.log(`[TOOL] suche_lv_granular: Kein Match nach Stufe 2. Kein Fallback (v1.2.0).`);

      return {
        weighted_avg_preis: null,
        median_preis: null,
        min_preis: null,
        max_preis: null,
        total_samples: 0,
        match_count: 0,
        match_quality: "no_match",
        entries: [],
        hinweis: "Kein passender LV-Eintrag gefunden. Nutze berechne_fensterpreis als Fallback.",
        suchparameter: {
          kategorie,
          kategorien_gesucht: kategorien,
          oeffnungsart: oeffnungsart || null,
          groessen_klasse: groessen_klasse || null,
          verglasung: verglasung || null,
          hat_rollladen: hat_rollladen ?? null,
          ist_kombi: ist_kombi ?? null,
        },
      };
    }

    // =========================================================================
    // Weighted Average berechnen
    // =========================================================================
    const validEntries = matchedEntries.filter(
      (e: any) => typeof e.avg_preis === "number" && e.avg_preis > 0 &&
                   typeof e.sample_count === "number" && e.sample_count > 0
    );

    let weightedAvgPreis = 0;
    let totalSamples = 0;
    let minPreis = Infinity;
    let maxPreis = 0;
    const preisValues: number[] = [];

    for (const entry of validEntries) {
      weightedAvgPreis += entry.avg_preis * entry.sample_count;
      totalSamples += entry.sample_count;

      if (entry.min_preis !== null && entry.min_preis !== undefined && entry.min_preis < minPreis) {
        minPreis = entry.min_preis;
      }
      if (entry.max_preis !== null && entry.max_preis !== undefined && entry.max_preis > maxPreis) {
        maxPreis = entry.max_preis;
      }

      preisValues.push(entry.avg_preis);
    }

    if (totalSamples > 0) {
      weightedAvgPreis = round2(weightedAvgPreis / totalSamples);
    }

    // Median berechnen
    let medianPreis = 0;
    if (preisValues.length > 0) {
      const sorted = [...preisValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianPreis = sorted.length % 2 !== 0
        ? round2(sorted[mid])
        : round2((sorted[mid - 1] + sorted[mid]) / 2);
    }

    // Ergebnis-Entries (max 15 fuer Token-Effizienz)
    const resultEntries = validEntries.slice(0, 15).map((e: any) => ({
      bezeichnung: e.bezeichnung,
      kategorie: e.kategorie,
      oeffnungsart: e.oeffnungsart,
      groessen_klasse: e.groessen_klasse,
      verglasung: e.verglasung,
      hat_rollladen: e.hat_rollladen,
      ist_kombi: e.ist_kombi,
      avg_preis: e.avg_preis,
      sample_count: e.sample_count,
      flaeche_qm: e.flaeche_qm,
    }));

    const result = {
      weighted_avg_preis: weightedAvgPreis,
      median_preis: medianPreis,
      min_preis: minPreis === Infinity ? 0 : round2(minPreis),
      max_preis: round2(maxPreis),
      total_samples: totalSamples,
      match_count: validEntries.length,
      match_quality: matchQuality,
      entries: resultEntries,
      suchparameter: {
        kategorie,
        kategorien_gesucht: kategorien,
        oeffnungsart: oeffnungsart || null,
        groessen_klasse: groessen_klasse || null,
        verglasung: verglasung || null,
        hat_rollladen: hat_rollladen ?? null,
        ist_kombi: ist_kombi ?? null,
      },
    };

    console.log(`[TOOL] suche_lv_granular Ergebnis: ${matchQuality}, weighted_avg=${weightedAvgPreis}, samples=${totalSamples}, matches=${validEntries.length}`);

    return result;
  } catch (err) {
    console.error("[TOOL] suche_lv_granular Exception:", err);
    return {
      error: String(err),
      weighted_avg_preis: 0,
      median_preis: 0,
      min_preis: 0,
      max_preis: 0,
      total_samples: 0,
      match_count: 0,
      match_quality: "error",
      entries: [],
    };
  }
}

// =============================================================================
// OPENAI TOOLS DEFINITION
// =============================================================================

const OPENAI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "suche_lv_granular",
      description:
        "Sucht im Leistungsverzeichnis mit strukturierten Filtern. " +
        "Nutze dies BEVORZUGT fuer Fenster, Tueren und Elemente mit bekannter " +
        "Oeffnungsart und Groesse. Liefert gewichteten Durchschnittspreis " +
        "basierend auf historischen Rechnungs- und Angebotsdaten. " +
        "Bei match_quality='no_match' nutze berechne_fensterpreis als Fallback. " +
        "HST und PSK werden automatisch als fenster-Kategorie behandelt.",
      parameters: {
        type: "object",
        properties: {
          kategorie: {
            type: "string",
            enum: ["fenster", "haustuer", "hst", "psk", "festfeld", "balkontuer",
                   "tuer", "rollladen", "raffstore", "insektenschutz", "fensterbank",
                   "montage", "entsorgung"],
            description: "Produkt-Kategorie. HST und PSK werden intern als fenster behandelt.",
          },
          oeffnungsart: {
            type: "string",
            enum: ["DK", "DKR", "DKL", "Stulp", "FIX", "HST", "PSK", "D", "K"],
            description: "Oeffnungsart des Elements. Bei DK wird automatisch auch DKR und DKL gesucht.",
          },
          groessen_klasse: {
            type: "string",
            enum: ["XS", "S", "M", "L1", "L2", "XL"],
            description: "Groessenklasse: XS(<0.3qm), S(0.3-0.7), M(0.7-1.3), L1(1.3-1.8), L2(1.8-2.5), XL(>2.5)",
          },
          verglasung: {
            type: "string",
            enum: ["2-fach", "3-fach"],
            description: "Verglasungstyp (mit Bindestrich: 2-fach oder 3-fach)",
          },
          hat_rollladen: {
            type: "boolean",
            description: "Element hat Rollladen-Fuehrungsschiene (Aufpreis!). NUR bei true setzen - bei false weglassen.",
          },
          ist_kombi: {
            type: "boolean",
            description: "Kombielement (mehrere Felder in einem Rahmen)",
          },
        },
        required: ["kategorie"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suche_leistungsverzeichnis",
      description:
        "Durchsucht das Leistungsverzeichnis per Textsuche nach passenden Positionen. " +
        "Nutze dies als FALLBACK fuer Sonderpositionen, Zubehoer oder wenn suche_lv_granular " +
        "keine Treffer liefert.",
      parameters: {
        type: "object",
        properties: {
          kategorie: {
            type: "string",
            description: "Kategorie im Leistungsverzeichnis, z.B. 'Fenster', 'Tuer', 'Rollladen', 'Montage'",
          },
          suchbegriff: {
            type: "string",
            description: "Suchbegriff fuer die Bezeichnung, z.B. 'Kunststofffenster DK/DK', 'Rollladen Vorbau'",
          },
          limit: {
            type: "number",
            description: "Maximale Anzahl Ergebnisse (default: 10, max: 50)",
          },
        },
        required: ["suchbegriff"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "hole_preishistorie",
      description:
        "Holt historische Preise fuer aehnliche Fenster/Tueren aus vergangenen Rechnungen. " +
        "Sucht nach Positionen mit aehnlichen Dimensionen (+/- 15%). " +
        "Nutze dies um realistische Marktpreise zu ermitteln.",
      parameters: {
        type: "object",
        properties: {
          kategorie: {
            type: "string",
            description: "Typ des Elements: 'fenster', 'tuer', 'hst', 'festfeld', 'haustuer', 'psk'",
          },
          breite_mm: {
            type: "number",
            description: "Breite in Millimeter",
          },
          hoehe_mm: {
            type: "number",
            description: "Hoehe in Millimeter",
          },
        },
        required: ["breite_mm", "hoehe_mm"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "berechne_fensterpreis",
      description:
        "Berechnet den Fensterpreis nach der internen Kalkulationsformel: " +
        "Flaeche(qm) * System-Preis * Farbaufschlag * Sondermassaufschlag. " +
        "Nutze dies als Fallback wenn suche_lv_granular match_quality='no_match' liefert, " +
        "oder um die historischen Preise zu validieren.",
      parameters: {
        type: "object",
        properties: {
          breite_mm: {
            type: "number",
            description: "Breite in Millimeter",
          },
          hoehe_mm: {
            type: "number",
            description: "Hoehe in Millimeter",
          },
          system: {
            type: "string",
            description: "Profilsystem: CASTELLO, CALIDO, IMPREO, AFINO (Default: CALIDO)",
          },
          farbe_innen: {
            type: "string",
            description: "Farbe innen, z.B. 'weiss', 'anthrazit', 'golden_oak' (Default: weiss)",
          },
          farbe_aussen: {
            type: "string",
            description: "Farbe aussen, z.B. 'weiss', 'anthrazit' (Default: weiss)",
          },
        },
        required: ["breite_mm", "hoehe_mm"],
      },
    },
  },
];

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `Du bist ein Experte fuer Fenster und Tueren bei J.S. Fenster & Tueren (WERU-Haendler).

DEINE AUFGABE:
Analysiere die Freitext-Beschreibung des Kunden und erstelle ein strukturiertes Budgetangebot.

ABLAUF:
1. Parse den Text: Erkenne Raeume, Fenstertypen, Masse, Zubehoer
2. Nutze die Tools um Preise zu ermitteln:
   - suche_lv_granular: BEVORZUGT fuer alle Fenster/Tueren/Elemente (strukturierte Suche)
   - Falls suche_lv_granular match_quality="no_match" liefert: berechne_fensterpreis nutzen
   - suche_leistungsverzeichnis: Nur fuer Sonderpositionen (Textsuche)
   - hole_preishistorie: Pruefe historische Preise fuer aehnliche Masse
3. Erstelle das Budget mit allen Positionen

REGELN FUER PREISSUCHE:
- BEVORZUGE suche_lv_granular fuer alle Fenster/Tueren/Elemente
- Berechne die Groessenklasse aus den Massen: Flaeche = Breite*Hoehe/1000000 qm
  XS: <0.3qm, S: 0.3-0.7, M: 0.7-1.3, L1: 1.3-1.8, L2: 1.8-2.5, XL: >2.5
- Nutze den weighted_avg_preis als Referenzpreis
- Rollladen: Setze hat_rollladen NUR bei true (bei false/unbekannt WEGLASSEN)
- Bei match_quality="no_match": Sofort berechne_fensterpreis als Fallback nutzen
- Bei Kombielementen (z.B. F/DKR): ist_kombi=true setzen
- Bei FIX-Verglasung: oeffnungsart="FIX" setzen (sucht automatisch auch in festfeld)
- DK (ohne Richtung): Wird automatisch gegen DK+DKR+DKL gesucht
- HST: kategorie="fenster", oeffnungsart="HST" (wird automatisch gemappt)
- PSK: kategorie="fenster", oeffnungsart="PSK" (wird automatisch gemappt)
- Verglasung IMMER mit Bindestrich: "3-fach" oder "2-fach"

REGELN FUER MASSE:
- Masse IMMER in mm interpretieren/ausgeben
- "1230x1480" -> Breite=1230, Hoehe=1480 (schon mm)
- "123x148" -> ACHTUNG: koennte cm sein -> Breite=1230, Hoehe=1480
- "1.23x1.48" oder "1,23x1,48" -> Meter -> Breite=1230, Hoehe=1480
- Fenster sind typischerweise 400-3500mm breit und 400-3000mm hoch

REGELN FUER KONTEXT:
- Hersteller Default: WERU
- System Default: CALIDO (bei 3-fach) oder CASTELLO (bei 2-fach)
- Wenn kein System angegeben: CALIDO (3-fach Standard)
- Farbe Default: weiss/weiss
- Material Default: Kunststoff

REGELN FUER ZUBEHOER:
- "RL" oder "Rollo" oder "Rollladen" -> rollladen
- "Raff" oder "Raffstore" -> raffstore
- "Motor" oder "elektrisch" oder "E" -> elektrisch
- "AFB" oder "Aussen-Fensterbank" -> afb
- "IFB" oder "Innen-Fensterbank" -> ifb
- "IS" oder "Insektenschutz" -> insektenschutz

ZUBEHOER-PREISE (als Referenz):
- Rollladen: 180 EUR/m Breite (min. 120 EUR)
- Raffstore: 280 EUR/m Breite (min. 200 EUR)
- Motor: 150 EUR/Stueck
- AFB: 35 EUR/lfm (min. 25 EUR)
- IFB: 45 EUR/lfm (min. 30 EUR)
- Insektenschutz: 80 EUR/Stueck
- Plissee: 120 EUR/Stueck

MONTAGE-PREISE:
- Montage: 80 EUR/Element
- Demontage: 40 EUR/Element
- Entsorgung: 25 EUR/Element

MWST: 19%

REGELN FUER TYP:
- "HT" oder "Haustuer" -> typ: "haustuer"
- "HST" oder "Hebeschiebetuer" -> typ: "hst"
- "PSK" -> typ: "psk"
- "Festfeld" oder "FIX" -> typ: "festfeld"
- Sonst -> typ: "fenster"

CONFIDENCE:
- high: Alle Daten eindeutig vorhanden
- medium: Einige Annahmen noetig
- low: Viele Unklarheiten

WICHTIG: Antworte am Ende (nach Tool-Nutzung) NUR mit validem JSON im folgenden Format:
{
  "kunde": { "name": "", "adresse": "" },
  "kontext": {
    "hersteller": "WERU",
    "system": "CALIDO",
    "verglasung": "3-fach",
    "farbe_innen": "weiss",
    "farbe_aussen": "weiss",
    "material": "Kunststoff"
  },
  "positionen": [
    {
      "pos": 1,
      "raum": "Wohnzimmer",
      "typ": "fenster",
      "bezeichnung": "2-flg. Kunststofffenster DK/DK",
      "breite_mm": 1230,
      "hoehe_mm": 1480,
      "menge": 2,
      "einzel_preis": 780.00,
      "gesamt_preis": 1560.00,
      "zubehoer": [
        { "typ": "rollladen", "preis": 220.00 }
      ],
      "confidence": "high"
    }
  ],
  "montage": {
    "montage": 0,
    "demontage": 0,
    "entsorgung": 0
  },
  "zusammenfassung": {
    "netto": 0.00,
    "mwst": 0.00,
    "brutto": 0.00,
    "brutto_gerundet": 0.00,
    "spanne_von": 0.00,
    "spanne_bis": 0.00
  },
  "annahmen": [],
  "fehlende_infos": []
}`;

// =============================================================================
// TOOL EXECUTION DISPATCHER
// =============================================================================

async function executeToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  console.log(`[TOOL] Executing: ${name}`, JSON.stringify(args));

  let result: unknown;

  switch (name) {
    case "suche_lv_granular":
      result = await sucheLvGranular(args as {
        kategorie: string;
        oeffnungsart?: string;
        groessen_klasse?: string;
        verglasung?: string;
        hat_rollladen?: boolean;
        ist_kombi?: boolean;
      });
      break;

    case "suche_leistungsverzeichnis":
      result = await sucheLeistungsverzeichnis(args as {
        kategorie: string;
        suchbegriff: string;
        limit: number;
      });
      break;

    case "hole_preishistorie":
      result = await holePreishistorie(args as {
        kategorie: string;
        breite_mm: number;
        hoehe_mm: number;
      });
      break;

    case "berechne_fensterpreis":
      result = berechneFensterpreis(args as {
        breite_mm: number;
        hoehe_mm: number;
        system: string;
        farbe_innen: string;
        farbe_aussen: string;
      });
      break;

    default:
      result = { error: `Unbekanntes Tool: ${name}` };
  }

  return JSON.stringify(result);
}

// =============================================================================
// GPT TOOL LOOP
// =============================================================================

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

async function runGptToolLoop(userText: string, systemOverride?: string): Promise<{
  result: unknown;
  tool_calls_count: number;
  rounds: number;
}> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemOverride || SYSTEM_PROMPT },
    { role: "user", content: userText },
  ];

  let totalToolCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[GPT] Round ${round + 1}/${MAX_TOOL_ROUNDS}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GPT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages,
          tools: OPENAI_TOOLS,
          tool_choice: "auto",
          reasoning_effort: "low",
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if ((fetchError as Error).name === "AbortError") {
        throw new Error(`GPT-Timeout nach ${GPT_TIMEOUT_MS}ms in Runde ${round + 1}`);
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Fehler: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error("Keine Antwort von GPT erhalten");
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (
      choice.finish_reason === "tool_calls" ||
      (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0)
    ) {
      const toolCalls = assistantMessage.tool_calls || [];
      totalToolCalls += toolCalls.length;

      console.log(`[GPT] ${toolCalls.length} Tool-Call(s) in Runde ${round + 1}`);

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;

        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
          console.error(`[GPT] Fehler beim Parsen der Tool-Argumente fuer ${fnName}`);
        }

        const toolResult = await executeToolCall(fnName, fnArgs);

        messages.push({
          role: "tool",
          content: toolResult,
          tool_call_id: toolCall.id,
        });
      }

      continue;
    }

    console.log(`[GPT] Finale Antwort in Runde ${round + 1}, ${totalToolCalls} Tool-Calls gesamt`);

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(assistantMessage.content || "{}");
    } catch {
      console.error("[GPT] Antwort ist kein valides JSON, versuche Extraktion...");
      const jsonMatch = (assistantMessage.content || "").match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error("GPT-Antwort konnte nicht als JSON geparst werden");
        }
      } else {
        throw new Error("GPT-Antwort enthaelt kein JSON");
      }
    }

    return {
      result: parsedResult,
      tool_calls_count: totalToolCalls,
      rounds: round + 1,
    };
  }

  throw new Error(`Maximale Anzahl Tool-Runden (${MAX_TOOL_ROUNDS}) erreicht`);
}

// =============================================================================
// BUDGET RESULT ENRICHMENT
// =============================================================================

interface BudgetPosition {
  pos: number;
  raum: string;
  typ: string;
  bezeichnung: string;
  breite_mm: number;
  hoehe_mm: number;
  menge: number;
  einzel_preis: number;
  gesamt_preis: number;
  zubehoer: Array<{ typ: string; preis: number }>;
  confidence: string;
}

interface BudgetResult {
  kunde: { name: string; adresse: string };
  kontext: {
    hersteller: string;
    system: string;
    verglasung: string;
    farbe_innen: string;
    farbe_aussen: string;
    material: string;
  };
  positionen: BudgetPosition[];
  montage: { montage: number; demontage: number; entsorgung: number };
  zusammenfassung: {
    netto: number;
    mwst: number;
    brutto: number;
    brutto_gerundet: number;
    spanne_von: number;
    spanne_bis: number;
  };
  annahmen: string[];
  fehlende_infos: string[];
}

function enrichBudgetResult(
  raw: Record<string, unknown>,
  optionen: { montage: boolean; demontage: boolean; system?: string }
): BudgetResult {
  const positionen = (raw.positionen as BudgetPosition[]) || [];
  const kontext = (raw.kontext as BudgetResult["kontext"]) || {
    hersteller: "WERU",
    system: optionen.system || "CALIDO",
    verglasung: "3-fach",
    farbe_innen: "weiss",
    farbe_aussen: "weiss",
    material: "Kunststoff",
  };

  if (optionen.system) {
    kontext.system = optionen.system;
  }

  let positionenNetto = 0;
  let totalElements = 0;

  for (const pos of positionen) {
    if (typeof pos.einzel_preis !== "number" || pos.einzel_preis <= 0) {
      const calc = berechneFensterpreis({
        breite_mm: pos.breite_mm,
        hoehe_mm: pos.hoehe_mm,
        system: kontext.system,
        farbe_innen: kontext.farbe_innen,
        farbe_aussen: kontext.farbe_aussen,
      }) as { einzel_preis: number };
      pos.einzel_preis = calc.einzel_preis;
    }

    pos.gesamt_preis = round2(pos.einzel_preis * (pos.menge || 1));

    let zubehoerTotal = 0;
    if (Array.isArray(pos.zubehoer)) {
      for (const zub of pos.zubehoer) {
        if (typeof zub.preis === "number" && zub.preis > 0) {
          zubehoerTotal += zub.preis * (pos.menge || 1);
        }
      }
    }

    positionenNetto += pos.gesamt_preis + zubehoerTotal;
    totalElements += pos.menge || 1;
  }

  const montageKosten = optionen.montage
    ? WORK_PRICES.montage.price_per_element * totalElements
    : 0;
  const demontageKosten = optionen.demontage
    ? WORK_PRICES.demontage.price_per_element * totalElements
    : 0;
  const entsorgungKosten = optionen.demontage
    ? WORK_PRICES.entsorgung.price_per_element * totalElements
    : 0;

  const montageGesamt = montageKosten + demontageKosten + entsorgungKosten;

  const netto = round2(positionenNetto + montageGesamt);
  const mwst = round2(netto * VAT_RATE / 100);
  const brutto = round2(netto + mwst);
  const bruttoGerundet = roundTo50(brutto);

  const spanneVon = roundTo50(bruttoGerundet * 0.85);
  const spanneBis = roundTo50(bruttoGerundet * 1.15);

  return {
    kunde: (raw.kunde as BudgetResult["kunde"]) || { name: "", adresse: "" },
    kontext,
    positionen,
    montage: {
      montage: montageKosten,
      demontage: demontageKosten,
      entsorgung: entsorgungKosten,
    },
    zusammenfassung: {
      netto,
      mwst,
      brutto,
      brutto_gerundet: bruttoGerundet,
      spanne_von: spanneVon,
      spanne_bis: spanneBis,
    },
    annahmen: (raw.annahmen as string[]) || [],
    fehlende_infos: (raw.fehlende_infos as string[]) || [],
  };
}

// =============================================================================
// SAVE BUDGET TO SUPABASE
// =============================================================================

async function saveBudgetToSupabase(
  budgetResult: BudgetResult,
  kundeInfo: { name?: string; code?: number } | null,
  rawText: string
): Promise<string | null> {
  try {
    const { data: caseData, error: caseError } = await supabase
      .from("budget_cases")
      .insert({
        erp_kunden_code: kundeInfo?.code || null,
        lead_name: kundeInfo?.name || budgetResult.kunde.name || null,
        kanal: "api",
        status: "calculated",
        notes: budgetResult.kunde.adresse || null,
      })
      .select("id")
      .single();

    if (caseError) {
      console.error("[SAVE] Fehler bei budget_cases:", caseError.message);
      return null;
    }

    const caseId = caseData.id;
    console.log(`[SAVE] Budget-Case erstellt: ${caseId}`);

    const { error: profileError } = await supabase
      .from("budget_profile")
      .insert({
        budget_case_id: caseId,
        manufacturer: budgetResult.kontext.hersteller || "WERU",
        system: budgetResult.kontext.system || null,
        glazing: budgetResult.kontext.verglasung || null,
        color_inside: budgetResult.kontext.farbe_innen || "weiss",
        color_outside: budgetResult.kontext.farbe_aussen || "weiss",
        material_class: budgetResult.kontext.material || "Kunststoff",
        inferred: true,
        manual_override: false,
      });

    if (profileError) {
      console.error("[SAVE] Fehler bei budget_profile:", profileError.message);
    }

    for (const pos of budgetResult.positionen) {
      const { data: itemData, error: itemError } = await supabase
        .from("budget_items")
        .insert({
          budget_case_id: caseId,
          room: pos.raum || null,
          element_type: pos.typ || "fenster",
          width_mm: pos.breite_mm,
          height_mm: pos.hoehe_mm,
          qty: pos.menge || 1,
          position_in_source: pos.pos,
          notes: pos.bezeichnung || null,
          confidence: pos.confidence || "medium",
        })
        .select("id")
        .single();

      if (itemError) {
        console.error(`[SAVE] Fehler bei budget_item pos ${pos.pos}:`, itemError.message);
        continue;
      }

      if (itemData && Array.isArray(pos.zubehoer) && pos.zubehoer.length > 0) {
        const hasRollladen = pos.zubehoer.some((z) => z.typ === "rollladen");
        const hasRaffstore = pos.zubehoer.some((z) => z.typ === "raffstore");
        const hasMotor = pos.zubehoer.some((z) => z.typ === "motor");
        const hasAfb = pos.zubehoer.some((z) => z.typ === "afb");
        const hasIfb = pos.zubehoer.some((z) => z.typ === "ifb");
        const hasInsekt = pos.zubehoer.some((z) => z.typ === "insektenschutz");
        const hasPlissee = pos.zubehoer.some((z) => z.typ === "plissee");

        const { error: accError } = await supabase
          .from("budget_accessories")
          .insert({
            budget_item_id: itemData.id,
            shutter: hasRollladen || hasRaffstore,
            shutter_type: hasRaffstore ? "raffstore" : hasRollladen ? "rollladen" : null,
            shutter_electric: hasMotor,
            motor_qty: hasMotor ? 1 : 0,
            afb: hasAfb,
            ifb: hasIfb,
            insect: hasInsekt,
            plissee: hasPlissee,
          });

        if (accError) {
          console.error(`[SAVE] Fehler bei accessories pos ${pos.pos}:`, accError.message);
        }
      }
    }

    const { error: resultError } = await supabase
      .from("budget_results")
      .insert({
        budget_case_id: caseId,
        net_total: budgetResult.zusammenfassung.netto,
        vat_rate: VAT_RATE,
        gross_total: budgetResult.zusammenfassung.brutto,
        gross_rounded_50: budgetResult.zusammenfassung.brutto_gerundet,
        range_low: budgetResult.zusammenfassung.spanne_von,
        range_high: budgetResult.zusammenfassung.spanne_bis,
        assumptions_json: {
          annahmen: budgetResult.annahmen,
          fehlende_infos: budgetResult.fehlende_infos,
          kontext: budgetResult.kontext,
          montage: budgetResult.montage,
        },
        model_version: "budget-ki-v1.3.0",
      });

    if (resultError) {
      console.error("[SAVE] Fehler bei budget_results:", resultError.message);
    }

    const { error: inputError } = await supabase
      .from("budget_inputs")
      .insert({
        budget_case_id: caseId,
        source_type: "freitext",
        raw_ocr: rawText,
        parsing_confidence: budgetResult.positionen.length > 0
          ? budgetResult.positionen[0].confidence
          : "medium",
        parsed_at: new Date().toISOString(),
      });

    if (inputError) {
      console.error("[SAVE] Fehler bei budget_inputs:", inputError.message);
    }

    console.log(`[SAVE] Budget vollstaendig gespeichert fuer Case ${caseId}`);
    return caseId;
  } catch (err) {
    console.error("[SAVE] Unerwarteter Fehler:", err);
    return null;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        service: "budget-ki",
        version: "1.3.0",
        status: "ready",
        model: "gpt-5.2",
        tools: OPENAI_TOOLS.map((t) => t.function.name),
        max_tool_rounds: MAX_TOOL_ROUNDS,
        timeout_ms: GPT_TIMEOUT_MS,
        matching: {
          stufen: ["exact (kat+oa+gk+verglasung+rl_smart)", "relaxed (kat+oa+gk)"],
          fallback: "no_match -> berechne_fensterpreis",
          dk_mapping: "DK -> IN (DK, DKR, DKL)",
          rl_smart: "Filter nur bei hat_rollladen=true",
          hst_psk: "HST/PSK -> fenster (v1.3.0)",
          verglasung: "Normalisierung: 3fach->3-fach, 2fach->2-fach (v1.3.0)",
        },
        configured: {
          openai: !!OPENAI_API_KEY,
          supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: CORS_HEADERS }
    );
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { text, kunde, optionen } = body as {
      text: string;
      kunde?: { name?: string; code?: number };
      optionen?: {
        montage?: boolean;
        demontage?: boolean;
        system?: string;
      };
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "text ist erforderlich und darf nicht leer sein",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log(`[BUDGET-KI] Start: ${text.length} Zeichen, Kunde: ${kunde?.name || "unbekannt"}`);

    const effectiveOptionen = {
      montage: optionen?.montage ?? true,
      demontage: optionen?.demontage ?? true,
      system: optionen?.system,
    };

    let userPrompt = text;
    if (kunde?.name) {
      userPrompt = `Kunde: ${kunde.name}\n\n${text}`;
    }
    if (effectiveOptionen.system) {
      userPrompt += `\n\nHinweis: System ist ${effectiveOptionen.system}.`;
    }
    if (!effectiveOptionen.montage) {
      userPrompt += "\n\nHinweis: Keine Montage gewuenscht.";
    }

    const gptResult = await runGptToolLoop(userPrompt);

    console.log(
      `[BUDGET-KI] GPT fertig: ${gptResult.rounds} Runde(n), ${gptResult.tool_calls_count} Tool-Call(s)`
    );

    const enrichedResult = enrichBudgetResult(
      gptResult.result as Record<string, unknown>,
      effectiveOptionen
    );

    let budgetCaseId: string | null = null;
    try {
      budgetCaseId = await saveBudgetToSupabase(enrichedResult, kunde || null, text);
    } catch (saveError) {
      console.error("[BUDGET-KI] Speichern fehlgeschlagen:", saveError);
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[BUDGET-KI] Fertig in ${processingTimeMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedResult,
        budget_case_id: budgetCaseId,
        processing_time_ms: processingTimeMs,
        meta: {
          model: "gpt-5.2",
          tool_calls: gptResult.tool_calls_count,
          rounds: gptResult.rounds,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error("[BUDGET-KI] Fehler:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Budget-Berechnung fehlgeschlagen",
        debug: String(error),
        stack: (error as Error).stack || null,
        processing_time_ms: processingTimeMs,
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
