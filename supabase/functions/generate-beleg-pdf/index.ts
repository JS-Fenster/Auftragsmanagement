// =============================================================================
// Beleg-PDF Generator - HTML Beleg (Angebot, Rechnung, etc.) aus DB-Daten
// Version: 1.0.0 - 2026-03-18
// =============================================================================
// Generiert ein professionelles HTML-Dokument mit Inline-CSS,
// druckfertig fuer A4 / PDF-Export.
//
// POST /functions/v1/generate-beleg-pdf
//   Body: { beleg_id: string }
//   Response: { html, beleg_nummer }
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  getCorsHeaders,
  checkRateLimit,
  sanitizeError,
} from "../_shared/security.ts";

// =============================================================================
// Environment
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// Types
// =============================================================================

interface Beleg {
  id: string;
  projekt_id: string | null;
  beleg_typ: string;
  beleg_nummer: string;
  status: string;
  datum: string;
  gueltig_bis: string | null;
  liefer_datum: string | null;
  leistungs_datum: string | null;
  empfaenger_firma: string | null;
  empfaenger_name: string | null;
  empfaenger_strasse: string | null;
  empfaenger_plz: string | null;
  empfaenger_ort: string | null;
  betreff: string | null;
  einleitungstext: string | null;
  schlusstext: string | null;
  kunden_bestellnummer: string | null;
  netto_summe: number;
  rabatt_prozent: number;
  rabatt_betrag: number;
  netto_nach_rabatt: number;
  mwst_satz: number;
  mwst_betrag: number;
  brutto_summe: number;
  zahlungsbedingungen: string | null;
  zahlungsziel_tage: number | null;
  skonto_prozent: number | null;
  skonto_tage: number | null;
  abschlags_nr: number | null;
  abschlags_prozent: number | null;
  abschlags_betrag: number | null;
  parent_id: string | null;
  pdf_html: string | null;
}

interface BelegPosition {
  id: string;
  pos_nr: number;
  bezeichnung: string;
  beschreibung: string | null;
  einheit: string;
  menge: number;
  einzelpreis: number;
  gesamtpreis: number;
  breite: number | null;
  hoehe: number | null;
  gruppe: string | null;
}

interface ParentBeleg {
  beleg_nummer: string;
  beleg_typ: string;
}

// =============================================================================
// Constants
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const BELEG_TYP_LABELS: Record<string, string> = {
  angebot: "ANGEBOT",
  auftragsbestaetigung: "AUFTRAGS\u00adBEST\u00c4TIGUNG",
  lieferschein: "LIEFERSCHEIN",
  rechnung: "RECHNUNG",
  abschlagsrechnung: "ABSCHLAGSRECHNUNG",
  schlussrechnung: "SCHLUSSRECHNUNG",
  gutschrift: "GUTSCHRIFT",
};

const RECHNUNGS_TYPEN = [
  "rechnung",
  "abschlagsrechnung",
  "schlussrechnung",
];

// =============================================================================
// Helpers
// =============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEuro(value: number): string {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " \u20ac";
}

function formatDatum(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const tag = String(d.getDate()).padStart(2, "0");
  const monat = String(d.getMonth() + 1).padStart(2, "0");
  const jahr = d.getFullYear();
  return `${tag}.${monat}.${jahr}`;
}

function formatMenge(menge: number): string {
  if (menge === Math.floor(menge)) return String(menge);
  return Number(menge).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  });
}

// =============================================================================
// SVG Generators (identical to budget-dokument)
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
// HTML Document Generation
// =============================================================================

function generateHTML(
  beleg: Beleg,
  positionen: BelegPosition[],
  parentBeleg: ParentBeleg | null,
): string {
  const typLabel = BELEG_TYP_LABELS[beleg.beleg_typ] || beleg.beleg_typ.toUpperCase();
  const datum = formatDatum(beleg.datum);
  const istRechnung = RECHNUNGS_TYPEN.includes(beleg.beleg_typ);

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(typLabel)} ${escapeHtml(beleg.beleg_nummer)}</title>
  ${renderStyles()}
</head>
<body>
  <div class="page-container">
    ${renderWatermark()}
    <div style="position:relative;z-index:1;">
      ${renderHeader()}
      ${renderAddressBlock(beleg)}
      ${renderDocTitle(beleg, typLabel, datum)}
      ${renderParentRef(parentBeleg)}
      ${renderEinleitung(beleg)}
      ${renderPositionenTable(positionen)}
      ${renderSummary(beleg)}
      ${renderZahlungsbedingungen(beleg, istRechnung)}
      ${renderSchlusstext(beleg)}
      ${renderClosing()}
      ${renderFooter()}
    </div>
  </div>
</body>
</html>`;
}

// =============================================================================
// Template Sub-Functions
// =============================================================================

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
    .pos-table tr.group-header td {
      padding: 10px 6px 4px 6px; border-bottom: 1px solid #ddd;
      font-weight: 600; font-size: 11px; color: ${BRAND.orange};
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .sum-table { width: 100%; border-collapse: collapse; max-width: 380px; margin-left: auto; }
    .sum-table td { padding: 5px 0; font-size: 12px; }
    .sum-table td.r { text-align: right; }
  </style>`;
}

function renderHeader(): string {
  return `
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

function renderAddressBlock(beleg: Beleg): string {
  const absenderZeile = `${FIRMA.name} \u00b7 ${FIRMA.strasse} \u00b7 ${FIRMA.plz_ort}`;

  const empfName = beleg.empfaenger_firma || beleg.empfaenger_name || "";
  const empfNameExtra = beleg.empfaenger_firma && beleg.empfaenger_name
    ? beleg.empfaenger_name
    : "";

  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          <div style="font-size:8px;color:#999;border-bottom:1px solid #ccc;padding-bottom:2px;margin-bottom:5px;">
            ${escapeHtml(absenderZeile)}
          </div>
          <div style="min-height:65px;font-size:13px;">
            <strong style="color:${BRAND.dunkel};">${escapeHtml(empfName)}</strong>
            ${empfNameExtra ? `<br><span style="color:${BRAND.dunkel};">${escapeHtml(empfNameExtra)}</span>` : ""}
            ${beleg.empfaenger_strasse ? `<br><span style="color:${BRAND.mittel};">${escapeHtml(beleg.empfaenger_strasse)}</span>` : ""}
            ${beleg.empfaenger_plz || beleg.empfaenger_ort ? `<br><span style="color:${BRAND.mittel};">${escapeHtml([beleg.empfaenger_plz, beleg.empfaenger_ort].filter(Boolean).join(" "))}</span>` : ""}
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

function renderDocTitle(beleg: Beleg, typLabel: string, datum: string): string {
  const infoRows: string[] = [];

  if (beleg.kunden_bestellnummer) {
    infoRows.push(`<strong style="color:${BRAND.dunkel};">Ihre Bestellung:</strong> ${escapeHtml(beleg.kunden_bestellnummer)}`);
  }

  if (beleg.gueltig_bis && beleg.beleg_typ === "angebot") {
    infoRows.push(`<strong style="color:${BRAND.dunkel};">G\u00fcltig bis:</strong> ${formatDatum(beleg.gueltig_bis)}`);
  }

  if (beleg.liefer_datum) {
    infoRows.push(`<strong style="color:${BRAND.dunkel};">Lieferdatum:</strong> ${formatDatum(beleg.liefer_datum)}`);
  }

  if (beleg.leistungs_datum) {
    infoRows.push(`<strong style="color:${BRAND.dunkel};">Leistungsdatum:</strong> ${formatDatum(beleg.leistungs_datum)}`);
  }

  if (beleg.abschlags_nr) {
    infoRows.push(`<strong style="color:${BRAND.dunkel};">Abschlag Nr.:</strong> ${beleg.abschlags_nr}`);
  }

  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="vertical-align:bottom;">
          <div style="font-size:16px;font-weight:700;color:${BRAND.dunkel};">
            ${escapeHtml(typLabel)} <span style="color:${BRAND.orange};">${escapeHtml(beleg.beleg_nummer)}</span>
          </div>
          ${beleg.betreff ? `<div style="font-size:12px;color:${BRAND.mittel};margin-top:2px;">${escapeHtml(beleg.betreff)}</div>` : ""}
        </td>
        <td style="text-align:right;vertical-align:bottom;font-size:11px;color:${BRAND.hell};">
          Seite 1
        </td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-top:1px solid #eee;border-bottom:1px solid #eee;">
      <tr style="font-size:11px;color:${BRAND.hell};">
        <td style="padding:6px 0;">
          <strong style="color:${BRAND.dunkel};">Datum:</strong> ${datum}
        </td>
        <td style="padding:6px 0;">
          <strong style="color:${BRAND.dunkel};">Beleg-Nr.:</strong> ${escapeHtml(beleg.beleg_nummer)}
        </td>
        ${infoRows.map((r) => `<td style="padding:6px 0;">${r}</td>`).join("")}
      </tr>
    </table>`;
}

function renderParentRef(parentBeleg: ParentBeleg | null): string {
  if (!parentBeleg) return "";
  const parentLabel = BELEG_TYP_LABELS[parentBeleg.beleg_typ] || parentBeleg.beleg_typ;
  return `
    <div style="background:#faf6ec;border:1px solid #e8dfc0;border-left:3px solid ${BRAND.orange};padding:8px 14px;margin:0 0 12px 0;font-size:12px;color:${BRAND.mittel};border-radius:0 3px 3px 0;">
      Bezug: ${escapeHtml(parentLabel)} <strong style="color:${BRAND.dunkel};">${escapeHtml(parentBeleg.beleg_nummer)}</strong>
    </div>`;
}

function renderEinleitung(beleg: Beleg): string {
  if (!beleg.einleitungstext) return "";
  return `<p style="color:${BRAND.mittel};margin:0 0 16px 0;font-size:13px;">${escapeHtml(beleg.einleitungstext)}</p>`;
}

function renderPositionenTable(positionen: BelegPosition[]): string {
  let rows = "";
  let currentGroup = "";

  for (const pos of positionen) {
    // Group header
    if (pos.gruppe && pos.gruppe !== currentGroup) {
      currentGroup = pos.gruppe;
      rows += `
      <tr class="group-header">
        <td colspan="6">${escapeHtml(currentGroup)}</td>
      </tr>`;
    }

    const beschreibung = pos.beschreibung
      ? `<br><span style="color:${BRAND.hell};font-size:11px;">${escapeHtml(pos.beschreibung)}</span>`
      : "";

    const masse = pos.breite && pos.hoehe
      ? `<br><span style="color:${BRAND.hell};font-size:11px;">${Number(pos.breite).toFixed(0)} \u00d7 ${Number(pos.hoehe).toFixed(0)} mm</span>`
      : "";

    rows += `
      <tr>
        <td class="c" style="color:${BRAND.hell};font-size:11px;">${pos.pos_nr}</td>
        <td>
          <strong style="color:${BRAND.dunkel};">${escapeHtml(pos.bezeichnung)}</strong>${beschreibung}${masse}
        </td>
        <td class="c">${escapeHtml(pos.einheit)}</td>
        <td class="r">${formatMenge(pos.menge)}</td>
        <td class="r">${formatEuro(pos.einzelpreis)}</td>
        <td class="r" style="font-weight:500;">${formatEuro(pos.gesamtpreis)}</td>
      </tr>`;
  }

  return `
    <table class="pos-table">
      <thead>
        <tr>
          <th class="c" style="width:35px;">Pos.</th>
          <th>Bezeichnung</th>
          <th class="c" style="width:50px;">Einheit</th>
          <th class="r" style="width:50px;">Menge</th>
          <th class="r" style="width:85px;">EP</th>
          <th class="r" style="width:90px;">GP</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function renderSummary(beleg: Beleg): string {
  const hasRabatt = Number(beleg.rabatt_betrag) > 0;

  let rabattRows = "";
  if (hasRabatt) {
    rabattRows = `
      <tr>
        <td style="color:${BRAND.mittel};">Zwischensumme netto</td>
        <td class="r">${formatEuro(beleg.netto_summe)}</td>
      </tr>
      <tr>
        <td style="color:${BRAND.mittel};">Rabatt ${Number(beleg.rabatt_prozent) > 0 ? `(${Number(beleg.rabatt_prozent).toLocaleString("de-DE")} %)` : ""}</td>
        <td class="r" style="color:#c62828;">- ${formatEuro(beleg.rabatt_betrag)}</td>
      </tr>`;
  }

  let abschlagRows = "";
  if (beleg.beleg_typ === "abschlagsrechnung" && beleg.abschlags_betrag) {
    abschlagRows = `
      <tr>
        <td style="color:${BRAND.mittel};">Abschlag ${beleg.abschlags_nr ? `Nr. ${beleg.abschlags_nr}` : ""} ${beleg.abschlags_prozent ? `(${Number(beleg.abschlags_prozent).toLocaleString("de-DE")} %)` : ""}</td>
        <td class="r">${formatEuro(beleg.abschlags_betrag)}</td>
      </tr>`;
  }

  return `
    <div style="border-top:2px solid ${BRAND.orange};padding-top:12px;margin-top:6px;">
      <table class="sum-table">
        <tbody>
          ${rabattRows}
          <tr style="${hasRabatt ? "border-top:1px solid #ddd;" : ""}">
            <td style="padding-top:8px;font-weight:600;">Nettobetrag</td>
            <td class="r" style="padding-top:8px;font-weight:600;">${formatEuro(beleg.netto_nach_rabatt)}</td>
          </tr>
          ${abschlagRows}
          <tr>
            <td style="color:${BRAND.mittel};">zzgl. MwSt. ${Number(beleg.mwst_satz).toLocaleString("de-DE")} %</td>
            <td class="r">${formatEuro(beleg.mwst_betrag)}</td>
          </tr>
          <tr style="border-top:2px solid ${BRAND.orange};">
            <td style="padding:10px 0;font-weight:700;font-size:14px;color:${BRAND.dunkel};">Gesamtbetrag</td>
            <td class="r" style="padding:10px 0;font-weight:700;font-size:14px;color:${BRAND.dunkel};">${formatEuro(beleg.brutto_summe)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function renderZahlungsbedingungen(beleg: Beleg, istRechnung: boolean): string {
  if (!istRechnung) return "";

  const lines: string[] = [];

  if (beleg.zahlungsbedingungen) {
    lines.push(escapeHtml(beleg.zahlungsbedingungen));
  } else {
    if (beleg.zahlungsziel_tage) {
      lines.push(`Zahlbar innerhalb von ${beleg.zahlungsziel_tage} Tagen nach Rechnungsdatum.`);
    }
    if (beleg.skonto_prozent && beleg.skonto_prozent > 0 && beleg.skonto_tage) {
      const skontoBetrag = Number(beleg.brutto_summe) * (Number(beleg.skonto_prozent) / 100);
      lines.push(
        `Bei Zahlung innerhalb von ${beleg.skonto_tage} Tagen gew\u00e4hren wir ${Number(beleg.skonto_prozent).toLocaleString("de-DE")} % Skonto (${formatEuro(skontoBetrag)}).`
      );
    }
  }

  if (lines.length === 0) return "";

  return `
    <div style="background:#faf6ec;border:1px solid #e8dfc0;border-left:3px solid ${BRAND.orange};padding:10px 14px;margin:16px 0;font-size:12px;color:${BRAND.dunkel};border-radius:0 3px 3px 0;">
      <strong style="color:${BRAND.orange};">Zahlungsbedingungen</strong><br>
      ${lines.join("<br>")}
    </div>`;
}

function renderSchlusstext(beleg: Beleg): string {
  if (!beleg.schlusstext) return "";
  return `<p style="color:${BRAND.mittel};margin:16px 0 0 0;font-size:12px;">${escapeHtml(beleg.schlusstext)}</p>`;
}

function renderClosing(): string {
  return `
    <div style="margin-top:30px;font-size:13px;color:${BRAND.mittel};">
      <p style="margin:0 0 4px 0;">F\u00fcr Fragen stehen wir Ihnen gerne zur Verf\u00fcgung.</p>
      <p style="margin:0 0 0 0;">Mit freundlichen Gr\u00fc\u00dfen</p>
      <p style="margin:6px 0 0 0;font-weight:600;color:${BRAND.dunkel};">${escapeHtml(FIRMA.name)}</p>
    </div>`;
}

function renderFooter(): string {
  return `
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
      <div style="display:flex;height:4px;margin-top:10px;border-radius:2px;overflow:hidden;">
        <div style="flex:1;background:${BRAND.grau};"></div>
        <div style="flex:2;background:${BRAND.orange};"></div>
      </div>
    </div>`;
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Nur POST-Anfragen sind erlaubt" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Rate limiting
  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Parse body
    let body: { beleg_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Ungueltiges JSON im Request-Body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate beleg_id
    const belegId = body.beleg_id;
    if (!belegId || typeof belegId !== "string" || !UUID_REGEX.test(belegId)) {
      return new Response(
        JSON.stringify({ error: "beleg_id muss eine gueltige UUID sein" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch beleg
    const { data: beleg, error: belegError } = await supabase
      .from("belege")
      .select("*")
      .eq("id", belegId)
      .single();

    if (belegError || !beleg) {
      console.error(`[generate-beleg-pdf] Beleg not found: ${belegId}`, belegError);
      return new Response(
        JSON.stringify({ error: "Beleg nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch positionen
    const { data: positionen, error: posError } = await supabase
      .from("beleg_positionen")
      .select("*")
      .eq("beleg_id", belegId)
      .order("sort_order", { ascending: true })
      .order("pos_nr", { ascending: true });

    if (posError) {
      console.error(`[generate-beleg-pdf] Positionen error:`, posError);
      return new Response(
        JSON.stringify({ error: sanitizeError(posError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch parent beleg if exists
    let parentBeleg: ParentBeleg | null = null;
    if (beleg.parent_id) {
      const { data: parent } = await supabase
        .from("belege")
        .select("beleg_nummer, beleg_typ")
        .eq("id", beleg.parent_id)
        .single();
      if (parent) {
        parentBeleg = parent as ParentBeleg;
      }
    }

    console.log(
      `[generate-beleg-pdf] Generating ${beleg.beleg_typ} ${beleg.beleg_nummer} with ${(positionen || []).length} positions`,
    );

    // Generate HTML
    const html = generateHTML(
      beleg as Beleg,
      (positionen || []) as BelegPosition[],
      parentBeleg,
    );

    // Cache HTML in belege.pdf_html
    const { error: updateError } = await supabase
      .from("belege")
      .update({ pdf_html: html })
      .eq("id", belegId);

    if (updateError) {
      console.error(`[generate-beleg-pdf] Cache update failed:`, updateError);
      // Non-fatal: continue even if cache fails
    }

    console.log(
      `[generate-beleg-pdf] Document generated: ${beleg.beleg_nummer}, ${html.length} bytes`,
    );

    return new Response(
      JSON.stringify({
        html,
        beleg_nummer: beleg.beleg_nummer,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(`[generate-beleg-pdf] ERROR:`, error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
