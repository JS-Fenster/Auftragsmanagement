// =============================================================================
// Budget-Dokument Generator - HTML Budgetangebot aus berechneten Positionen
// Version: 1.0.0 - 2026-02-05
// =============================================================================
// Generiert ein professionelles HTML-Budgetangebot mit Inline-CSS,
// druckfertig fuer A4 / PDF-Export.
//
// POST /functions/v1/budget-dokument
//   Body: { positionen, kunde, zusammenfassung, kontext, montage, annahmen }
//   Response: { success, html, angebots_nummer }
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// Environment
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// CORS Headers
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =============================================================================
// Types
// =============================================================================

interface ZubehoerItem {
  typ: string;
  preis: number;
}

interface Position {
  pos: number;
  raum: string;
  typ: string;
  bezeichnung: string;
  breite_mm: number;
  hoehe_mm: number;
  menge: number;
  einzel_preis: number;
  gesamt_preis: number;
  zubehoer?: ZubehoerItem[];
}

interface Kunde {
  name: string;
  adresse: string;
  telefon?: string;
}

interface Zusammenfassung {
  netto: number;
  mwst: number;
  brutto: number;
  brutto_gerundet: number;
  spanne_von: number;
  spanne_bis: number;
}

interface Kontext {
  system?: string;
  verglasung?: string;
  farbe_innen?: string;
  farbe_aussen?: string;
}

interface Montage {
  montage?: number;
  demontage?: number;
  entsorgung?: number;
}

interface BudgetDokumentRequest {
  budget_case_id?: string;
  positionen: Position[];
  kunde: Kunde;
  zusammenfassung: Zusammenfassung;
  kontext?: Kontext;
  montage?: Montage;
  annahmen?: string[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Formatiert eine Zahl als deutsches Waehrungsformat (1.234,56 EUR)
 */
function formatEuro(value: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " \u20AC";
}

/**
 * Formatiert das aktuelle Datum als DD.MM.YYYY
 */
function formatDatum(): string {
  const now = new Date();
  const tag = String(now.getDate()).padStart(2, "0");
  const monat = String(now.getMonth() + 1).padStart(2, "0");
  const jahr = now.getFullYear();
  return `${tag}.${monat}.${jahr}`;
}

/**
 * Gibt den Typ-Label auf Deutsch zurueck
 */
function typLabel(typ: string): string {
  const labels: Record<string, string> = {
    fenster: "Fenster",
    tuer: "T\u00fcr",
    hst: "Hebeschiebeet\u00fcr",
    festfeld: "Festfeld",
    haustuer: "Haust\u00fcr",
    psk: "Parallel-Schiebe-Kipp",
  };
  return labels[typ] || typ;
}

/**
 * Formatiert Masse als lesbare Dimension
 */
function formatMasse(breite_mm: number, hoehe_mm: number): string {
  return `${breite_mm} \u00D7 ${hoehe_mm} mm`;
}

// =============================================================================
// Angebotsnummer-Generierung
// =============================================================================

/**
 * Generiert die naechste Angebotsnummer im Format BA-YYYY-NNNN
 * Fragt Supabase nach der letzten Nummer und inkrementiert.
 */
async function generateAngebotsNummer(): Promise<string> {
  const jahr = new Date().getFullYear();
  const prefix = `BA-${jahr}-`;

  // Letztes Angebot dieses Jahres suchen
  const { data, error } = await supabase
    .from("budget_cases")
    .select("angebots_nummer")
    .like("angebots_nummer", `${prefix}%`)
    .order("angebots_nummer", { ascending: false })
    .limit(1);

  let nextNumber = 1;

  if (!error && data && data.length > 0 && data[0].angebots_nummer) {
    const lastNum = data[0].angebots_nummer as string;
    const numPart = lastNum.replace(prefix, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  const nummer = `${prefix}${String(nextNumber).padStart(4, "0")}`;
  return nummer;
}

/**
 * Speichert die Angebotsnummer zurueck in die budget_cases Tabelle
 */
async function saveAngebotsNummer(
  budgetCaseId: string | undefined,
  angebotsNummer: string,
): Promise<void> {
  if (!budgetCaseId) return;

  try {
    await supabase
      .from("budget_cases")
      .update({
        angebots_nummer: angebotsNummer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", budgetCaseId);
  } catch (err) {
    console.error(
      `[budget-dokument] Failed to save angebots_nummer: ${err}`,
    );
  }
}

// =============================================================================
// HTML Document Generation
// =============================================================================

function generateHTML(
  req: BudgetDokumentRequest,
  angebotsNummer: string,
): string {
  const { positionen, kunde, zusammenfassung, kontext, montage, annahmen } =
    req;
  const datum = formatDatum();

  // Zubehoer-Gesamtsumme berechnen
  let zubehoerTotal = 0;
  for (const pos of positionen) {
    if (pos.zubehoer) {
      for (const z of pos.zubehoer) {
        zubehoerTotal += z.preis * (pos.menge || 1);
      }
    }
  }

  // Fenster/Tueren Summe (ohne Zubehoer)
  let fensterTotal = 0;
  for (const pos of positionen) {
    fensterTotal += pos.gesamt_preis;
  }

  // Montage-Summe
  const montageTotal =
    (montage?.montage || 0) +
    (montage?.demontage || 0) +
    (montage?.entsorgung || 0);

  // Anrede ableiten
  const anrede = kunde.name.startsWith("Familie")
    ? `Sehr geehrte ${kunde.name}`
    : `Sehr geehrte/r ${kunde.name}`;

  // ------ Positionen-Rows generieren ------
  let positionenRows = "";
  for (const pos of positionen) {
    const dimensionen = formatMasse(pos.breite_mm, pos.hoehe_mm);
    const typText = typLabel(pos.typ);

    positionenRows += `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: center; vertical-align: top; color: #333;">
            ${pos.pos}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top;">
            <strong style="color: #333;">${escapeHtml(pos.bezeichnung)}</strong><br>
            <span style="color: #666; font-size: 0.9em;">
              ${escapeHtml(pos.raum)} &middot; ${escapeHtml(typText)} &middot; ${dimensionen}
            </span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: center; vertical-align: top; color: #333;">
            ${pos.menge}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; vertical-align: top; color: #333;">
            ${formatEuro(pos.einzel_preis)}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; vertical-align: top; color: #333; font-weight: 500;">
            ${formatEuro(pos.gesamt_preis)}
          </td>
        </tr>`;

    // Zubehoer als Sub-Items
    if (pos.zubehoer && pos.zubehoer.length > 0) {
      for (const z of pos.zubehoer) {
        const zGesamt = z.preis * (pos.menge || 1);
        positionenRows += `
        <tr style="background-color: #fafafa;">
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0;"></td>
          <td style="padding: 6px 8px 6px 24px; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 0.9em;">
            &rarr; ${escapeHtml(zubehoerLabel(z.typ))}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #666; font-size: 0.9em;">
            ${pos.menge}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666; font-size: 0.9em;">
            ${formatEuro(z.preis)}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666; font-size: 0.9em;">
            ${formatEuro(zGesamt)}
          </td>
        </tr>`;
      }
    }
  }

  // ------ Kontext-Box ------
  let kontextBox = "";
  if (kontext && (kontext.system || kontext.verglasung)) {
    const entries: string[] = [];
    if (kontext.system) entries.push(`<strong>System:</strong> ${escapeHtml(kontext.system)}`);
    if (kontext.verglasung) entries.push(`<strong>Verglasung:</strong> ${escapeHtml(kontext.verglasung)}`);
    if (kontext.farbe_innen || kontext.farbe_aussen) {
      entries.push(
        `<strong>Farbe:</strong> ${escapeHtml(kontext.farbe_innen || "weiss")} / ${escapeHtml(kontext.farbe_aussen || "weiss")}`,
      );
    }
    kontextBox = `
      <div style="background-color: #f0f4f8; border-left: 4px solid #003366; padding: 12px 16px; margin: 20px 0; font-size: 0.9em; color: #333;">
        <strong style="color: #003366;">Konfiguration</strong><br>
        ${entries.join(" &nbsp;&middot;&nbsp; ")}
      </div>`;
  }

  // ------ Montage-Zeilen ------
  let montageRows = "";
  if (montage) {
    if (montage.montage && montage.montage > 0) {
      montageRows += `
        <tr>
          <td style="padding: 6px 0; color: #555;">Montage</td>
          <td style="padding: 6px 0; text-align: right; color: #333;">${formatEuro(montage.montage)}</td>
        </tr>`;
    }
    if (montage.demontage && montage.demontage > 0) {
      montageRows += `
        <tr>
          <td style="padding: 6px 0; color: #555;">Demontage Altfenster</td>
          <td style="padding: 6px 0; text-align: right; color: #333;">${formatEuro(montage.demontage)}</td>
        </tr>`;
    }
    if (montage.entsorgung && montage.entsorgung > 0) {
      montageRows += `
        <tr>
          <td style="padding: 6px 0; color: #555;">Entsorgung Altmaterial</td>
          <td style="padding: 6px 0; text-align: right; color: #333;">${formatEuro(montage.entsorgung)}</td>
        </tr>`;
    }
  }

  // ------ Annahmen-Liste ------
  let annahmenHtml = "";
  if (annahmen && annahmen.length > 0) {
    const items = annahmen
      .map(
        (a) =>
          `<li style="margin-bottom: 4px; color: #555;">${escapeHtml(a)}</li>`,
      )
      .join("\n");
    annahmenHtml = `
      <div style="margin-top: 30px;">
        <h3 style="color: #003366; font-size: 1em; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
          Annahmen &amp; Grundlagen
        </h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.9em;">
          ${items}
        </ul>
      </div>`;
  }

  // ------ Vollstaendiges HTML ------
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Budgetangebot ${escapeHtml(angebotsNummer)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .page-container { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">

  <div class="page-container" style="max-width: 210mm; margin: 20px auto; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 40px;">

    <!-- ============================================================ -->
    <!-- COMPANY HEADER -->
    <!-- ============================================================ -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <tr>
        <td style="vertical-align: top; width: 60%;">
          <div style="font-size: 1.6em; font-weight: 700; color: #003366; letter-spacing: 0.5px;">
            J.S. Fenster &amp; T\u00fcren GmbH
          </div>
          <div style="color: #666; font-size: 0.85em; margin-top: 4px; line-height: 1.6;">
            Handwerksstra\u00DFe 12 &middot; 78549 Spaichingen<br>
            Tel: 07424 / 98 45-0<br>
            info@js-fenster.de &middot; www.js-fenster.de
          </div>
        </td>
        <td style="vertical-align: top; text-align: right; width: 40%;">
          <div style="background-color: #003366; color: #ffffff; padding: 12px 20px; display: inline-block; font-size: 0.8em; letter-spacing: 1px; text-transform: uppercase;">
            Budgetangebot
          </div>
        </td>
      </tr>
    </table>

    <!-- ============================================================ -->
    <!-- ABSENDER / EMPFAENGER -->
    <!-- ============================================================ -->
    <div style="font-size: 0.75em; color: #999; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 6px;">
      J.S. Fenster &amp; T\u00fcren GmbH &middot; Handwerksstra\u00DFe 12 &middot; 78549 Spaichingen
    </div>
    <div style="margin-bottom: 30px; min-height: 80px;">
      <strong style="color: #333;">${escapeHtml(kunde.name)}</strong><br>
      <span style="color: #555;">${escapeHtml(kunde.adresse)}</span>
      ${kunde.telefon ? `<br><span style="color: #555;">Tel: ${escapeHtml(kunde.telefon)}</span>` : ""}
    </div>

    <!-- ============================================================ -->
    <!-- TITEL + DATUM -->
    <!-- ============================================================ -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="vertical-align: bottom;">
          <h1 style="margin: 0; font-size: 1.3em; color: #003366;">
            Budgetangebot Nr. ${escapeHtml(angebotsNummer)}
          </h1>
        </td>
        <td style="text-align: right; vertical-align: bottom; color: #666; font-size: 0.9em;">
          Datum: ${datum}
        </td>
      </tr>
    </table>

    <!-- ============================================================ -->
    <!-- ANSCHREIBEN -->
    <!-- ============================================================ -->
    <p style="color: #333; margin-bottom: 6px;">
      ${escapeHtml(anrede)},
    </p>
    <p style="color: #555; margin-bottom: 20px;">
      vielen Dank f\u00fcr Ihre Anfrage. Gerne unterbreiten wir Ihnen folgende Budgetsch\u00e4tzung:
    </p>

    <!-- ============================================================ -->
    <!-- KONFIGURATION -->
    <!-- ============================================================ -->
    ${kontextBox}

    <!-- ============================================================ -->
    <!-- POSITIONS-TABELLE -->
    <!-- ============================================================ -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 25px;">
      <thead>
        <tr style="background-color: #003366; color: #ffffff;">
          <th style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 0.85em; width: 45px;">Pos.</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600; font-size: 0.85em;">Beschreibung</th>
          <th style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 0.85em; width: 55px;">Menge</th>
          <th style="padding: 10px 8px; text-align: right; font-weight: 600; font-size: 0.85em; width: 100px;">Einzelpreis</th>
          <th style="padding: 10px 8px; text-align: right; font-weight: 600; font-size: 0.85em; width: 100px;">Gesamtpreis</th>
        </tr>
      </thead>
      <tbody>
        ${positionenRows}
      </tbody>
    </table>

    <!-- ============================================================ -->
    <!-- ZUSAMMENFASSUNG -->
    <!-- ============================================================ -->
    <div style="border-top: 2px solid #003366; padding-top: 15px; margin-top: 10px;">
      <table style="width: 100%; border-collapse: collapse; max-width: 450px; margin-left: auto;">
        <tbody>
          <tr>
            <td style="padding: 6px 0; color: #555;">Summe Fenster / T\u00fcren</td>
            <td style="padding: 6px 0; text-align: right; color: #333;">${formatEuro(fensterTotal)}</td>
          </tr>
          ${zubehoerTotal > 0 ? `
          <tr>
            <td style="padding: 6px 0; color: #555;">Summe Zubeh\u00f6r</td>
            <td style="padding: 6px 0; text-align: right; color: #333;">${formatEuro(zubehoerTotal)}</td>
          </tr>` : ""}
          ${montageRows}
          ${montageTotal > 0 ? `
          <tr style="border-top: 1px solid #ddd;">
            <td style="padding: 6px 0; color: #555; font-style: italic;">Summe Montagearbeiten</td>
            <td style="padding: 6px 0; text-align: right; color: #333; font-style: italic;">${formatEuro(montageTotal)}</td>
          </tr>` : ""}
          <tr style="border-top: 2px solid #ccc;">
            <td style="padding: 10px 0 6px 0; color: #333; font-weight: 600;">Nettosumme</td>
            <td style="padding: 10px 0 6px 0; text-align: right; color: #333; font-weight: 600;">${formatEuro(zusammenfassung.netto)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #555;">zzgl. MwSt. 19 %</td>
            <td style="padding: 6px 0; text-align: right; color: #333;">${formatEuro(zusammenfassung.mwst)}</td>
          </tr>
          <tr style="border-top: 2px solid #003366;">
            <td style="padding: 12px 0; color: #003366; font-weight: 700; font-size: 1.15em;">Bruttosumme</td>
            <td style="padding: 12px 0; text-align: right; color: #003366; font-weight: 700; font-size: 1.15em;">${formatEuro(zusammenfassung.brutto)}</td>
          </tr>
          ${zusammenfassung.brutto_gerundet !== zusammenfassung.brutto ? `
          <tr>
            <td style="padding: 6px 0; color: #666; font-size: 0.9em;">Gerundeter Richtwert</td>
            <td style="padding: 6px 0; text-align: right; color: #003366; font-weight: 600; font-size: 1.05em;">ca. ${formatEuro(zusammenfassung.brutto_gerundet)}</td>
          </tr>` : ""}
        </tbody>
      </table>
    </div>

    <!-- ============================================================ -->
    <!-- PREISSPANNE -->
    <!-- ============================================================ -->
    <div style="background-color: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 14px 18px; margin: 25px 0; text-align: center;">
      <span style="color: #555; font-size: 0.95em;">
        Der gesch\u00e4tzte Endpreis liegt voraussichtlich zwischen
        <strong style="color: #003366;">${formatEuro(zusammenfassung.spanne_von)}</strong>
        und
        <strong style="color: #003366;">${formatEuro(zusammenfassung.spanne_bis)}</strong>.
      </span>
    </div>

    <!-- ============================================================ -->
    <!-- DISCLAIMER -->
    <!-- ============================================================ -->
    <div style="background-color: #fff8e1; border: 1px solid #ffe082; border-left: 4px solid #ffa000; border-radius: 4px; padding: 14px 18px; margin: 25px 0; font-size: 0.88em;">
      <strong style="color: #e65100;">Hinweis:</strong>
      <span style="color: #555;">
        Dieses Budgetangebot dient als unverbindliche Kostensch\u00e4tzung und stellt kein bindendes Angebot dar.
        Die tats\u00e4chlichen Kosten k\u00f6nnen nach Aufma\u00df und Detailplanung abweichen.
        Gerne erstellen wir Ihnen nach einem pers\u00f6nlichen Beratungsgespr\u00e4ch ein verbindliches Angebot.
      </span>
    </div>

    <!-- ============================================================ -->
    <!-- ANNAHMEN -->
    <!-- ============================================================ -->
    ${annahmenHtml}

    <!-- ============================================================ -->
    <!-- CLOSING -->
    <!-- ============================================================ -->
    <div style="margin-top: 35px; color: #555; font-size: 0.95em;">
      <p>F\u00fcr Fragen stehen wir Ihnen gerne zur Verf\u00fcgung.</p>
      <p style="margin-top: 6px;">Mit freundlichen Gr\u00fc\u00DFen</p>
    </div>

    <!-- ============================================================ -->
    <!-- SIGNATURE BLOCK -->
    <!-- ============================================================ -->
    <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="vertical-align: top; width: 50%;">
            <strong style="color: #003366;">J.S. Fenster &amp; T\u00fcren GmbH</strong><br>
            <span style="color: #666; font-size: 0.85em;">Gesch\u00e4ftsf\u00fchrung</span>
          </td>
          <td style="vertical-align: top; width: 50%; text-align: right; color: #999; font-size: 0.8em; line-height: 1.6;">
            Handwerksstra\u00DFe 12 &middot; 78549 Spaichingen<br>
            Tel: 07424 / 98 45-0 &middot; Fax: 07424 / 98 45-20<br>
            info@js-fenster.de &middot; www.js-fenster.de
          </td>
        </tr>
      </table>
    </div>

  </div>

</body>
</html>`;
}

// =============================================================================
// Helpers: HTML Escaping + Zubehoer Labels
// =============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function zubehoerLabel(typ: string): string {
  const labels: Record<string, string> = {
    rollladen: "Vorbau-Rollladen",
    rollladen_elektrisch: "Vorbau-Rollladen (elektrisch)",
    raffstore: "Aussenraffstore",
    raffstore_elektrisch: "Aussenraffstore (elektrisch)",
    insektenschutz: "Insektenschutz-Spannrahmen",
    afb: "Aussenfensterbank Aluminium",
    ifb: "Innenfensterbank",
    plissee: "Plissee / Faltstore",
    motor: "Elektromotor",
  };
  return labels[typ] || typ;
}

// =============================================================================
// Validation
// =============================================================================

function validateRequest(
  body: unknown,
): { valid: true; data: BudgetDokumentRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body muss ein JSON-Objekt sein" };
  }

  const data = body as Record<string, unknown>;

  // positionen
  if (!Array.isArray(data.positionen) || data.positionen.length === 0) {
    return {
      valid: false,
      error: "positionen muss ein nicht-leeres Array sein",
    };
  }

  // kunde
  if (!data.kunde || typeof data.kunde !== "object") {
    return { valid: false, error: "kunde muss ein Objekt sein" };
  }
  const kunde = data.kunde as Record<string, unknown>;
  if (!kunde.name || typeof kunde.name !== "string") {
    return { valid: false, error: "kunde.name ist erforderlich" };
  }
  if (!kunde.adresse || typeof kunde.adresse !== "string") {
    kunde.adresse = "";
  }

  // zusammenfassung
  if (!data.zusammenfassung || typeof data.zusammenfassung !== "object") {
    return { valid: false, error: "zusammenfassung muss ein Objekt sein" };
  }
  const zf = data.zusammenfassung as Record<string, unknown>;
  const requiredNumbers = [
    "netto",
    "mwst",
    "brutto",
    "brutto_gerundet",
  ];
  for (const key of requiredNumbers) {
    if (typeof zf[key] !== "number") {
      return {
        valid: false,
        error: `zusammenfassung.${key} muss eine Zahl sein`,
      };
    }
  }
  // spanne_von/spanne_bis optional - aus preis_spanne oder flach
  const preisSpanne = (zf.preis_spanne as Record<string, unknown>) || {};
  if (typeof zf.spanne_von !== "number") {
    zf.spanne_von = (typeof preisSpanne.von === "number" ? preisSpanne.von : (zf.netto as number) * 0.85);
  }
  if (typeof zf.spanne_bis !== "number") {
    zf.spanne_bis = (typeof preisSpanne.bis === "number" ? preisSpanne.bis : (zf.netto as number) * 1.15);
  }

  // Positionen validieren
  for (let i = 0; i < data.positionen.length; i++) {
    const pos = (data.positionen as unknown[])[i] as Record<string, unknown>;
    if (typeof pos.pos !== "number") {
      return {
        valid: false,
        error: `positionen[${i}].pos muss eine Zahl sein`,
      };
    }
    if (typeof pos.bezeichnung !== "string") {
      return {
        valid: false,
        error: `positionen[${i}].bezeichnung ist erforderlich`,
      };
    }
    // Normalize field names: accept both gesamtpreis and gesamt_preis
    if (typeof pos.gesamt_preis !== "number" && typeof pos.gesamtpreis === "number") {
      pos.gesamt_preis = pos.gesamtpreis;
    }
    if (typeof pos.einzel_preis !== "number" && typeof pos.einzelpreis === "number") {
      pos.einzel_preis = pos.einzelpreis;
    }
    if (typeof pos.breite_mm !== "number" && typeof pos.breite === "number") {
      pos.breite_mm = pos.breite;
    }
    if (typeof pos.hoehe_mm !== "number" && typeof pos.hoehe === "number") {
      pos.hoehe_mm = pos.hoehe;
    }
    if (typeof pos.gesamt_preis !== "number") {
      return {
        valid: false,
        error: `positionen[${i}].gesamt_preis muss eine Zahl sein`,
      };
    }
  }

  return { valid: true, data: data as unknown as BudgetDokumentRequest };
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Nur POST-Anfragen sind erlaubt" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Ungueltiges JSON im Request-Body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate
    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const requestData = validation.data;

    // Generate Angebotsnummer
    const angebotsNummer = await generateAngebotsNummer();
    console.log(
      `[budget-dokument] Generating document ${angebotsNummer} for ${requestData.kunde.name}`,
    );

    // Save Angebotsnummer back to budget_cases (if ID provided)
    await saveAngebotsNummer(requestData.budget_case_id, angebotsNummer);

    // Generate HTML
    const html = generateHTML(requestData, angebotsNummer);

    console.log(
      `[budget-dokument] Document generated: ${angebotsNummer}, ${html.length} bytes`,
    );

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        html,
        angebots_nummer: angebotsNummer,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(`[budget-dokument] ERROR: ${error}`);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
