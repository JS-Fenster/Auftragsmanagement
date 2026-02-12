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
  email?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
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
// Brand Constants
// =============================================================================

const FIRMA = {
  name: "J.S. Fenster & T\u00fcren GmbH",
  slogan: "Ihr Fachbetrieb f\u00fcr Fenster und T\u00fcren",
  strasse: "Regensburger Stra\u00dfe 59",
  plz_ort: "92224 Amberg",
  telefon: "09621 / 76 35 33",
  fax: "09621 / 78 32 59",
  email: "info@js-fenster.de",
  web: "www.js-fenster.de",
  gf: "Andreas Stolarczyk, Jaroslaw Stolarczyk",
  bank: "VR Bank Amberg-Sulzbach eG",
  iban: "DE36 7529 0000 0000 0795 61",
  bic: "GENODEF1AMV",
  ag: "Amberg, HRB 6616",
  ust: "DE327803003",
} as const;

const BRAND = {
  orange: "#E8A600",
  orangeLight: "#F5D060",
  grau: "#9E9E9E",
  dunkel: "#333333",
  mittel: "#555555",
  hell: "#666666",
  hintergrund: "#f5f5f5",
} as const;

// =============================================================================
// SVG Generators (inline, keine externen Dateien)
// =============================================================================

function renderLogoSvg(): string {
  return `<svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="22" height="22" rx="2" fill="${BRAND.grau}" opacity="0.85"/>
    <rect x="28" y="2" width="22" height="22" rx="2" fill="${BRAND.grau}" opacity="0.65"/>
    <rect x="2" y="28" width="22" height="22" rx="2" fill="${BRAND.grau}" opacity="0.65"/>
    <rect x="28" y="28" width="22" height="22" rx="2" fill="${BRAND.orange}"/>
    <line x1="13" y1="2" x2="13" y2="24" stroke="white" stroke-width="1.5"/>
    <line x1="2" y1="13" x2="24" y2="13" stroke="white" stroke-width="1.5"/>
    <line x1="39" y1="2" x2="39" y2="24" stroke="white" stroke-width="1.5"/>
    <line x1="28" y1="13" x2="50" y2="13" stroke="white" stroke-width="1.5"/>
    <line x1="13" y1="28" x2="13" y2="50" stroke="white" stroke-width="1.5"/>
    <line x1="2" y1="39" x2="24" y2="39" stroke="white" stroke-width="1.5"/>
    <line x1="39" y1="28" x2="39" y2="50" stroke="white" stroke-width="1.5"/>
    <line x1="28" y1="39" x2="50" y2="39" stroke="white" stroke-width="1.5"/>
  </svg>`;
}

function iconPhone(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${BRAND.orange}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
}

function iconFax(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${BRAND.orange}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
}

function iconMail(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${BRAND.orange}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
}

function iconWeb(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${BRAND.orange}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`;
}

function renderWatermark(): string {
  return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:0;">
    <svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
      <rect x="80" y="100" width="280" height="280" rx="8" transform="rotate(30 220 240)" fill="#9E9E9E" opacity="0.035"/>
      <rect x="140" y="120" width="260" height="260" rx="8" transform="rotate(40 270 250)" fill="#9E9E9E" opacity="0.03"/>
      <rect x="120" y="80" width="300" height="300" rx="8" transform="rotate(35 270 230)" fill="#F5D060" opacity="0.025"/>
    </svg>
  </div>`;
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

  // ── Berechnungen ────────────────────────────────────────
  let zubehoerTotal = 0;
  for (const pos of positionen) {
    if (pos.zubehoer) {
      for (const z of pos.zubehoer) {
        zubehoerTotal += z.preis * (pos.menge || 1);
      }
    }
  }

  let fensterTotal = 0;
  for (const pos of positionen) {
    fensterTotal += pos.gesamt_preis;
  }

  const montageTotal =
    (montage?.montage || 0) +
    (montage?.demontage || 0) +
    (montage?.entsorgung || 0);

  // Anrede ableiten
  const anrede = kunde.name.startsWith("Familie")
    ? `Sehr geehrte ${kunde.name}`
    : `Sehr geehrte/r ${kunde.name}`;

  // Kundenadresse aufbauen
  const adresseZeile1 = kunde.strasse || "";
  const adresseZeile2 = [kunde.plz, kunde.ort].filter(Boolean).join(" ");
  // Fallback auf altes adresse-Feld
  const hatAdresse = adresseZeile1 || adresseZeile2;

  // ── Render-Sektionen ───────────────────────────────────
  const styles = renderStyles();
  const header = renderHeader();
  const addressSection = renderAddressSection(kunde, adresseZeile1, adresseZeile2, hatAdresse);
  const docTitle = renderDocTitle(angebotsNummer, datum);
  const kontextBox = renderKontextBox(kontext);
  const posTable = renderPositionenTable(positionen);
  const summary = renderSummary(zusammenfassung, fensterTotal, zubehoerTotal, montage, montageTotal);
  const priceRange = renderPriceRange(zusammenfassung);
  const disclaimer = renderDisclaimer();
  const annahmenBlock = renderAnnahmen(annahmen);
  const footer = renderFooter();
  const watermark = renderWatermark();

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Budgetangebot ${escapeHtml(angebotsNummer)}</title>
  ${styles}
</head>
<body>
  <div class="page-container">
    ${watermark}
    <div style="position:relative;z-index:1;">
      ${header}
      ${addressSection}
      ${docTitle}
      <!-- Anschreiben -->
      <p style="color:${BRAND.dunkel};margin:0 0 6px 0;font-size:13px;">${escapeHtml(anrede)},</p>
      <p style="color:${BRAND.mittel};margin:0 0 20px 0;font-size:13px;">vielen Dank f\u00fcr Ihre Anfrage. Gerne unterbreiten wir Ihnen folgende Budgetsch\u00e4tzung:</p>
      ${kontextBox}
      ${posTable}
      ${summary}
      ${priceRange}
      ${disclaimer}
      ${annahmenBlock}
      <!-- Closing -->
      <div style="margin-top:30px;font-size:13px;color:${BRAND.mittel};">
        <p style="margin:0 0 4px 0;">F\u00fcr Fragen stehen wir Ihnen gerne zur Verf\u00fcgung.</p>
        <p style="margin:0 0 0 0;">Mit freundlichen Gr\u00fc\u00dfen</p>
        <p style="margin:6px 0 0 0;font-weight:600;color:${BRAND.dunkel};">${escapeHtml(FIRMA.name)}</p>
      </div>
      ${footer}
    </div>
  </div>
</body>
</html>`;
}

// ── Template Sub-Funktionen ─────────────────────────────────

function renderStyles(): string {
  return `<style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background-color: ${BRAND.hintergrund};
      font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
      font-size: 13px; line-height: 1.45; color: ${BRAND.dunkel};
    }
    .page-container {
      position: relative; overflow: hidden;
      width: 210mm; min-height: 297mm;
      margin: 0 auto; background: #fff;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      padding: 15mm 20mm 20mm 20mm;
    }
    @media print {
      body { background: none; }
      .page-container { box-shadow: none; margin: 0; width: auto; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    .pos-table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; }
    .pos-table th {
      padding: 8px 6px; text-align: left; font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.3px;
      color: ${BRAND.dunkel}; border-bottom: 2px solid ${BRAND.orange};
    }
    .pos-table th.r { text-align: right; }
    .pos-table th.c { text-align: center; }
    .pos-table td { padding: 7px 6px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 12px; }
    .pos-table td.r { text-align: right; }
    .pos-table td.c { text-align: center; }
    .pos-table tr.zub td { padding: 4px 6px 4px 18px; border-bottom: 1px solid #f5f5f5; color: ${BRAND.hell}; font-size: 11px; }
    .sum-table { width: 100%; border-collapse: collapse; max-width: 380px; margin-left: auto; }
    .sum-table td { padding: 5px 0; font-size: 12px; }
    .sum-table td.r { text-align: right; }
  </style>`;
}

function renderHeader(): string {
  return `
    <!-- Header: Logo + Firmenname + oranger Balken -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>
        <td style="vertical-align:middle;width:60px;padding-right:12px;">
          ${renderLogoSvg()}
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:20px;font-weight:700;color:${BRAND.dunkel};letter-spacing:0.3px;">
            J.S. Fenster &amp; T\u00fcren
          </div>
          <div style="font-size:11px;color:${BRAND.hell};margin-top:1px;letter-spacing:0.2px;">
            ${escapeHtml(FIRMA.slogan)}
          </div>
        </td>
      </tr>
    </table>
    <div style="height:3px;background:linear-gradient(90deg, ${BRAND.orange} 0%, ${BRAND.orangeLight} 100%);margin:8px 0 20px 0;border-radius:2px;"></div>`;
}

function renderAddressSection(
  kunde: Kunde,
  adresseZeile1: string,
  adresseZeile2: string,
  hatAdresse: string | boolean,
): string {
  // Absenderzeile (klein, ueber dem Adressfeld)
  const absenderZeile = `${FIRMA.name} \u00b7 ${FIRMA.strasse} \u00b7 ${FIRMA.plz_ort}`;

  return `
    <!-- Adressblock: links Kunde, rechts Firmenkontakt -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          <div style="font-size:8px;color:#999;border-bottom:1px solid #ccc;padding-bottom:2px;margin-bottom:5px;">
            ${escapeHtml(absenderZeile)}
          </div>
          <div style="min-height:65px;font-size:13px;">
            <strong style="color:${BRAND.dunkel};">${escapeHtml(kunde.name)}</strong>
            ${hatAdresse ? `<br><span style="color:${BRAND.mittel};">${adresseZeile1 ? escapeHtml(adresseZeile1) + "<br>" : ""}${adresseZeile2 ? escapeHtml(adresseZeile2) : ""}</span>` : (kunde.adresse ? `<br><span style="color:${BRAND.mittel};">${escapeHtml(kunde.adresse)}</span>` : "")}
          </div>
        </td>
        <td style="vertical-align:top;width:45%;padding-left:20px;">
          <table style="border-collapse:collapse;font-size:11px;color:${BRAND.hell};line-height:1.7;">
            <tr><td style="padding:0 6px 0 0;vertical-align:middle;">${iconPhone()}</td><td>${escapeHtml(FIRMA.telefon)}</td></tr>
            <tr><td style="padding:0 6px 0 0;vertical-align:middle;">${iconFax()}</td><td>${escapeHtml(FIRMA.fax)}</td></tr>
            <tr><td style="padding:0 6px 0 0;vertical-align:middle;">${iconMail()}</td><td>${escapeHtml(FIRMA.email)}</td></tr>
            <tr><td style="padding:0 6px 0 0;vertical-align:middle;">${iconWeb()}</td><td>${escapeHtml(FIRMA.web)}</td></tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function renderDocTitle(angebotsNummer: string, datum: string): string {
  return `
    <!-- Dokumenttitel + Seitennummer -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="vertical-align:bottom;">
          <div style="font-size:16px;font-weight:700;color:${BRAND.dunkel};">
            BUDGETANGEBOT <span style="color:${BRAND.orange};">${escapeHtml(angebotsNummer)}</span>
          </div>
        </td>
        <td style="text-align:right;vertical-align:bottom;font-size:11px;color:${BRAND.hell};">
          Seite 1
        </td>
      </tr>
    </table>
    <!-- Kontaktzeile -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-top:1px solid #eee;border-bottom:1px solid #eee;">
      <tr style="font-size:11px;color:${BRAND.hell};">
        <td style="padding:6px 0;">
          <strong style="color:${BRAND.dunkel};">Kontakt:</strong> A. Stolarczyk
        </td>
        <td style="padding:6px 0;">
          <strong style="color:${BRAND.dunkel};">Telefon:</strong> ${escapeHtml(FIRMA.telefon)}
        </td>
        <td style="padding:6px 0;">
          <strong style="color:${BRAND.dunkel};">E-Mail:</strong> as@js-fenster.de
        </td>
        <td style="padding:6px 0;text-align:right;">
          <strong style="color:${BRAND.dunkel};">Datum:</strong> ${datum}
        </td>
      </tr>
    </table>`;
}

function renderKontextBox(kontext?: Kontext): string {
  if (!kontext || (!kontext.system && !kontext.verglasung)) return "";
  const entries: string[] = [];
  if (kontext.system) entries.push(`<strong>System:</strong> ${escapeHtml(kontext.system)}`);
  if (kontext.verglasung) entries.push(`<strong>Verglasung:</strong> ${escapeHtml(kontext.verglasung)}`);
  if (kontext.farbe_innen || kontext.farbe_aussen) {
    entries.push(
      `<strong>Farbe:</strong> ${escapeHtml(kontext.farbe_innen || "weiss")} / ${escapeHtml(kontext.farbe_aussen || "weiss")}`,
    );
  }
  return `
    <div style="background:#faf6ec;border:1px solid #e8dfc0;border-left:3px solid ${BRAND.orange};padding:10px 14px;margin:0 0 16px 0;font-size:12px;color:${BRAND.dunkel};border-radius:0 3px 3px 0;">
      <strong style="color:${BRAND.orange};">Konfiguration</strong>&nbsp;&nbsp;
      ${entries.join(" &nbsp;\u00b7&nbsp; ")}
    </div>`;
}

function renderPositionenTable(positionen: Position[]): string {
  let rows = "";
  for (const pos of positionen) {
    const dimensionen = formatMasse(pos.breite_mm, pos.hoehe_mm);
    const typText = typLabel(pos.typ);
    rows += `
      <tr>
        <td class="c" style="color:${BRAND.hell};font-size:11px;">${pos.pos}</td>
        <td>
          <strong style="color:${BRAND.dunkel};">${escapeHtml(pos.bezeichnung)}</strong><br>
          <span style="color:${BRAND.hell};font-size:11px;">${escapeHtml(pos.raum)} \u00b7 ${escapeHtml(typText)} \u00b7 ${dimensionen}</span>
        </td>
        <td class="c">${pos.menge}</td>
        <td class="c" style="font-size:11px;">Stk.</td>
        <td class="r">${formatEuro(pos.einzel_preis)}</td>
        <td class="r" style="font-weight:500;">${formatEuro(pos.gesamt_preis)}</td>
      </tr>`;
    if (pos.zubehoer && pos.zubehoer.length > 0) {
      for (const z of pos.zubehoer) {
        const zGesamt = z.preis * (pos.menge || 1);
        rows += `
      <tr class="zub">
        <td></td>
        <td style="padding-left:18px;">\u2192 ${escapeHtml(zubehoerLabel(z.typ))}</td>
        <td class="c">${pos.menge}</td>
        <td class="c" style="font-size:11px;">Stk.</td>
        <td class="r">${formatEuro(z.preis)}</td>
        <td class="r">${formatEuro(zGesamt)}</td>
      </tr>`;
      }
    }
  }

  return `
    <table class="pos-table">
      <thead>
        <tr>
          <th class="c" style="width:35px;">Pos.</th>
          <th>Bezeichnung</th>
          <th class="c" style="width:40px;">Menge</th>
          <th class="c" style="width:45px;">Einheit</th>
          <th class="r" style="width:85px;">EP</th>
          <th class="r" style="width:90px;">GP</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function renderSummary(
  zusammenfassung: Zusammenfassung,
  fensterTotal: number,
  zubehoerTotal: number,
  montage: Montage | undefined,
  montageTotal: number,
): string {
  let montageRows = "";
  if (montage) {
    if (montage.montage && montage.montage > 0) {
      montageRows += `<tr><td style="color:${BRAND.mittel};">Montage</td><td class="r">${formatEuro(montage.montage)}</td></tr>`;
    }
    if (montage.demontage && montage.demontage > 0) {
      montageRows += `<tr><td style="color:${BRAND.mittel};">Demontage Altfenster</td><td class="r">${formatEuro(montage.demontage)}</td></tr>`;
    }
    if (montage.entsorgung && montage.entsorgung > 0) {
      montageRows += `<tr><td style="color:${BRAND.mittel};">Entsorgung Altmaterial</td><td class="r">${formatEuro(montage.entsorgung)}</td></tr>`;
    }
  }

  return `
    <div style="border-top:2px solid ${BRAND.orange};padding-top:12px;margin-top:6px;">
      <table class="sum-table">
        <tbody>
          <tr><td style="color:${BRAND.mittel};">Summe Fenster / T\u00fcren</td><td class="r">${formatEuro(fensterTotal)}</td></tr>
          ${zubehoerTotal > 0 ? `<tr><td style="color:${BRAND.mittel};">Summe Zubeh\u00f6r</td><td class="r">${formatEuro(zubehoerTotal)}</td></tr>` : ""}
          ${montageRows}
          ${montageTotal > 0 ? `<tr style="border-top:1px solid #ddd;"><td style="color:${BRAND.mittel};font-style:italic;">Summe Montagearbeiten</td><td class="r" style="font-style:italic;">${formatEuro(montageTotal)}</td></tr>` : ""}
          <tr style="border-top:2px solid #ccc;">
            <td style="padding-top:8px;font-weight:600;">Gesamt netto</td>
            <td class="r" style="padding-top:8px;font-weight:600;">${formatEuro(zusammenfassung.netto)}</td>
          </tr>
          <tr>
            <td style="color:${BRAND.mittel};">zzgl. MwSt. 19 %</td>
            <td class="r">${formatEuro(zusammenfassung.mwst)}</td>
          </tr>
          <tr style="border-top:2px solid ${BRAND.orange};">
            <td style="padding:10px 0;font-weight:700;font-size:14px;color:${BRAND.dunkel};">Gesamtbetrag</td>
            <td class="r" style="padding:10px 0;font-weight:700;font-size:14px;color:${BRAND.dunkel};">${formatEuro(zusammenfassung.brutto)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function renderPriceRange(zusammenfassung: Zusammenfassung): string {
  return `
    <div style="background:#faf6ec;border:1px solid #e8dfc0;border-radius:4px;padding:12px 16px;margin:20px 0;text-align:center;">
      <span style="font-size:12px;color:${BRAND.mittel};">
        Der gesch\u00e4tzte Endpreis liegt zwischen
        <strong style="color:${BRAND.dunkel};">${formatEuro(zusammenfassung.spanne_von)}</strong>
        und
        <strong style="color:${BRAND.dunkel};">${formatEuro(zusammenfassung.spanne_bis)}</strong>
        (brutto, inkl. MwSt.).
      </span>
    </div>`;
}

function renderDisclaimer(): string {
  return `
    <div style="background:#fff8e1;border:1px solid #ffe082;border-left:3px solid #ffa000;border-radius:0 3px 3px 0;padding:10px 14px;margin:16px 0;font-size:11px;">
      <strong style="color:#e65100;">\u26a0 Hinweis:</strong>
      <span style="color:${BRAND.mittel};">
        Dieses Budgetangebot dient als unverbindliche Kostensch\u00e4tzung und stellt kein bindendes Angebot dar.
        Die tats\u00e4chlichen Kosten k\u00f6nnen nach Aufma\u00df und Detailplanung abweichen.
        Gerne erstellen wir Ihnen nach einem pers\u00f6nlichen Beratungsgespr\u00e4ch ein verbindliches Angebot.
      </span>
    </div>`;
}

function renderAnnahmen(annahmen?: string[]): string {
  if (!annahmen || annahmen.length === 0) return "";
  const items = annahmen
    .map((a) => `<li style="margin-bottom:3px;color:${BRAND.mittel};">${escapeHtml(a)}</li>`)
    .join("\n");
  return `
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:600;color:${BRAND.dunkel};margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #eee;">
        Annahmen &amp; Grundlagen
      </div>
      <ul style="margin:0;padding-left:18px;font-size:11px;">
        ${items}
      </ul>
    </div>`;
}

function renderFooter(): string {
  return `
    <!-- Footer -->
    <div style="margin-top:35px;padding-top:12px;border-top:1px solid #e0e0e0;">
      <table style="width:100%;border-collapse:collapse;font-size:9px;color:#999;line-height:1.6;">
        <tr>
          <td style="vertical-align:top;width:34%;">
            GF: ${escapeHtml(FIRMA.gf)}<br>
            AG ${escapeHtml(FIRMA.ag)}
          </td>
          <td style="vertical-align:top;width:33%;">
            ${escapeHtml(FIRMA.bank)}<br>
            IBAN: ${escapeHtml(FIRMA.iban)}
          </td>
          <td style="vertical-align:top;width:33%;text-align:right;">
            BIC: ${escapeHtml(FIRMA.bic)}<br>
            USt-IdNr.: ${escapeHtml(FIRMA.ust)}
          </td>
        </tr>
      </table>
      <!-- Farbbalken am Fuss -->
      <div style="display:flex;height:4px;margin-top:10px;border-radius:2px;overflow:hidden;">
        <div style="flex:1;background:${BRAND.grau};"></div>
        <div style="flex:2;background:${BRAND.orange};"></div>
      </div>
    </div>`;
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
  // Adresse: aus Einzelfeldern zusammenbauen wenn vorhanden
  if (kunde.strasse || kunde.plz || kunde.ort) {
    const parts = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(" ")].filter(Boolean);
    if (!kunde.adresse || typeof kunde.adresse !== "string") {
      kunde.adresse = parts.join(", ");
    }
  } else if (!kunde.adresse || typeof kunde.adresse !== "string") {
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
  // spanne_von/spanne_bis: ±15% vom Brutto, gerundet auf 50 EUR
  const brutto = zf.brutto as number;
  if (typeof zf.spanne_von !== "number") {
    zf.spanne_von = Math.round((brutto * 0.85) / 50) * 50;
  }
  if (typeof zf.spanne_bis !== "number") {
    zf.spanne_bis = Math.round((brutto * 1.15) / 50) * 50;
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
