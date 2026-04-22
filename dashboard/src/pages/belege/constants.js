/**
 * Belege-System — Konstanten & Helpers
 *
 * Belegtypen, Status, Konversionen, Einheiten und Berechnungslogik.
 * Referenziert von: BelegFormular, BelegListe, BelegPositionenEditor
 */
import { supabase } from '../../lib/supabase'

// ── Firma-Info (wiederverwendet aus budgetangebot) ──────────

export const FIRMA_INFO = {
  firma: 'J.S. Fenster & Türen GmbH',
  strasse: 'Regensburger Straße 59',
  plz_ort: '92224 Amberg',
  telefon: '09621 / 76 35 33',
  fax: '09621 / 78 32 59',
  email: 'info@js-fenster.de',
  web: 'www.js-fenster.de',
}

// ── Beleg-Typen ─────────────────────────────────────────────

export const BELEG_TYPEN = {
  angebot:               { label: 'Angebot',               prefix: 'A',  color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  auftragsbestaetigung:  { label: 'Auftragsbestätigung',   prefix: 'AB', color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  lieferschein:          { label: 'Lieferschein',          prefix: 'LS', color: '#14B8A6', bg: '#F0FDFA', text: '#115E59' },
  rechnung:              { label: 'Rechnung',              prefix: 'R',  color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  abschlagsrechnung:     { label: 'Abschlagsrechnung',     prefix: 'AR', color: '#F97316', bg: '#FFF7ED', text: '#9A3412' },
  schlussrechnung:       { label: 'Schlussrechnung',       prefix: 'SR', color: '#059669', bg: '#D1FAE5', text: '#064E3B' },
  gutschrift:            { label: 'Gutschrift',            prefix: 'GS', color: '#DC2626', bg: '#FEE2E2', text: '#991B1B' },
}

// ── Beleg-Status ────────────────────────────────────────────

export const BELEG_STATUS = {
  entwurf:      { label: 'Entwurf',      color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
  freigegeben:  { label: 'Freigegeben',  color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  versendet:    { label: 'Versendet',    color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  angenommen:   { label: 'Angenommen',   color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  abgelehnt:    { label: 'Abgelehnt',    color: '#DC2626', bg: '#FEE2E2', text: '#991B1B' },
  bezahlt:      { label: 'Bezahlt',      color: '#059669', bg: '#D1FAE5', text: '#064E3B' },
  teilbezahlt:  { label: 'Teilbezahlt',  color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  storniert:    { label: 'Storniert',    color: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280' },
}

// ── Erlaubte Konversionen ───────────────────────────────────

export const BELEG_KONVERSIONEN = {
  angebot:              ['auftragsbestaetigung', 'rechnung'],
  auftragsbestaetigung: ['lieferschein', 'rechnung', 'abschlagsrechnung'],
  lieferschein:         ['rechnung'],
  abschlagsrechnung:    ['schlussrechnung'],
  rechnung:             ['gutschrift'],
  schlussrechnung:      ['gutschrift'],
  gutschrift:           [],
}

// ── Einheiten ───────────────────────────────────────────────

export const BELEG_EINHEITEN = [
  { value: 'Stk',      label: 'Stück' },
  { value: 'lfm',      label: 'Laufmeter' },
  { value: 'm2',       label: 'Quadratmeter' },
  { value: 'pauschal', label: 'Pauschal' },
  { value: 'Std',      label: 'Stunden' },
  { value: 'kg',       label: 'Kilogramm' },
]

// ── Default-Texte pro Typ ───────────────────────────────────

export const DEFAULT_TEXTE = {
  angebot: {
    einleitung: 'Vielen Dank für Ihre Anfrage. Wir erlauben uns, Ihnen folgendes Angebot zu unterbreiten:',
    schluss: 'Wir würden uns freuen, den Auftrag ausführen zu dürfen, und stehen für Rückfragen jederzeit zur Verfügung.',
  },
  auftragsbestaetigung: {
    einleitung: 'Vielen Dank für Ihren Auftrag. Wir bestätigen hiermit die Ausführung folgender Leistungen:',
    schluss: '',
  },
  lieferschein: {
    einleitung: 'Wir liefern Ihnen die folgenden Positionen:',
    schluss: '',
  },
  rechnung: {
    einleitung: 'Für die erbrachten Leistungen erlauben wir uns, wie folgt abzurechnen:',
    schluss: 'Bitte überweisen Sie den Gesamtbetrag innerhalb der angegebenen Zahlungsfrist auf unser Konto.',
  },
  abschlagsrechnung: {
    einleitung: 'Gemäß Vereinbarung erlauben wir uns, folgende Abschlagsrechnung zu stellen:',
    schluss: '',
  },
  schlussrechnung: {
    einleitung: 'Wir erlauben uns, Ihnen die Schlussrechnung für die erbrachten Leistungen zu stellen:',
    schluss: 'Bereits geleistete Abschlagszahlungen wurden berücksichtigt.',
  },
  gutschrift: {
    einleitung: 'Wir erteilen Ihnen folgende Gutschrift:',
    schluss: '',
  },
}

// ── Zahlungsarten ─────────────────────────────────────────────

export const ZAHLUNGSARTEN = [
  { value: 'ueberweisung', label: 'Überweisung' },
  { value: 'bar', label: 'Barzahlung' },
  { value: 'scheck', label: 'Scheck' },
  { value: 'lastschrift', label: 'Lastschrift' },
]

// ── MwSt ────────────────────────────────────────────────────

export const MWST_STANDARD = 19.00
export const MWST_OPTIONEN = [
  { value: 19.00, label: '19% (Standard)' },
  { value: 7.00, label: '7% (Ermäßigt)' },
  { value: 0.00, label: '0% (Reverse Charge / Steuerfrei)' },
]

// ── Helpers ─────────────────────────────────────────────────

export function formatEuro(value) {
  if (value == null || isNaN(value)) return '0,00 \u20AC'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function parseNumber(str) {
  if (str == null) return 0
  const cleaned = String(str).replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function generateTempId() {
  return 'pos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

/**
 * Berechnet Beleg-Summen aus Positionen
 */
export function calculateBelegSummen(positionen, rabattProzent = 0, mwstSatz = 19) {
  const netto = positionen.reduce((sum, p) => {
    const gp = (parseFloat(p.menge) || 0) * (parseFloat(p.einzelpreis) || 0)
    return sum + gp
  }, 0)

  const rabattBetrag = netto * (rabattProzent / 100)
  const nettoNachRabatt = netto - rabattBetrag
  const mwstBetrag = nettoNachRabatt * (mwstSatz / 100)
  const brutto = nettoNachRabatt + mwstBetrag

  return {
    netto_summe: Math.round(netto * 100) / 100,
    rabatt_betrag: Math.round(rabattBetrag * 100) / 100,
    netto_nach_rabatt: Math.round(nettoNachRabatt * 100) / 100,
    mwst_betrag: Math.round(mwstBetrag * 100) / 100,
    brutto_summe: Math.round(brutto * 100) / 100,
  }
}

/**
 * Naechste Belegnummer via RPC generieren
 */
export async function generateBelegNummer(typ) {
  const { data, error } = await supabase.rpc('next_nummer', { p_typ: typ })
  if (error) {
    console.error('Fehler bei Belegnummer-Generierung:', error)
    // Fallback: Timestamp-basiert
    const prefix = BELEG_TYPEN[typ]?.prefix || 'X'
    const year = new Date().getFullYear()
    return `${prefix}-${year}-TEMP${Date.now().toString().slice(-4)}`
  }
  return data
}

/**
 * Beleg speichern (Insert oder Update) inkl. Positionen
 */
export async function saveBeleg(beleg, positionen) {
  const isNew = !beleg.id

  // Save-Time-Heilung: Wenn beleg_nummer eine TEMP-Nummer ist (Fallback bei RPC-Fehler
  // in generateBelegNummer), versuche sie durch eine echte Nummer zu ersetzen.
  // Funktioniert sobald Netz/DB wieder da ist. Safety-Net: pg_cron heal_temp_beleg_nummern
  // läuft zusätzlich alle 15 min falls Beleg nie wieder geöffnet wird.
  if (beleg.beleg_nummer && beleg.beleg_nummer.includes('-TEMP')) {
    const { data: echteNr, error: heilErr } = await supabase.rpc('next_nummer', { p_typ: beleg.beleg_typ })
    if (!heilErr && echteNr) {
      beleg.beleg_nummer = echteNr
    }
    // Bei Fehler: TEMP-Nummer bleibt bestehen, pg_cron heilt später
  }

  // Summen berechnen
  const summen = calculateBelegSummen(positionen, beleg.rabatt_prozent, beleg.mwst_satz)

  const belegData = {
    projekt_id: beleg.projekt_id || null,
    beleg_typ: beleg.beleg_typ,
    beleg_nummer: beleg.beleg_nummer,
    status: beleg.status || 'entwurf',
    datum: beleg.datum,
    gueltig_bis: beleg.gueltig_bis || null,
    liefer_datum: beleg.liefer_datum || null,
    leistungs_datum: beleg.leistungs_datum || null,
    empfaenger_kontakt_id: beleg.empfaenger_kontakt_id || null,
    empfaenger_firma: beleg.empfaenger_firma || null,
    empfaenger_name: beleg.empfaenger_name || null,
    empfaenger_strasse: beleg.empfaenger_strasse || null,
    empfaenger_plz: beleg.empfaenger_plz || null,
    empfaenger_ort: beleg.empfaenger_ort || null,
    betreff: beleg.betreff || null,
    einleitungstext: beleg.einleitungstext || null,
    schlusstext: beleg.schlusstext || null,
    kunden_bestellnummer: beleg.kunden_bestellnummer || null,
    rabatt_prozent: beleg.rabatt_prozent || 0,
    mwst_satz: beleg.mwst_satz ?? 19,
    zahlungsbedingungen: beleg.zahlungsbedingungen || null,
    zahlungsziel_tage: beleg.zahlungsziel_tage || 14,
    skonto_prozent: beleg.skonto_prozent || 0,
    skonto_tage: beleg.skonto_tage || 0,
    abschlags_nr: beleg.abschlags_nr || null,
    abschlags_prozent: beleg.abschlags_prozent || null,
    abschlags_betrag: beleg.abschlags_betrag || null,
    parent_id: beleg.parent_id || null,
    ...summen,
  }

  let belegResult
  if (isNew) {
    belegResult = await supabase.from('belege').insert(belegData).select().single()
  } else {
    belegResult = await supabase.from('belege').update(belegData).eq('id', beleg.id).select().single()
  }

  if (belegResult.error) {
    return { error: belegResult.error }
  }

  const belegId = belegResult.data.id

  // Positionen: Delete + Re-Insert (einfacher als Diff)
  if (!isNew) {
    await supabase.from('beleg_positionen').delete().eq('beleg_id', belegId)
  }

  if (positionen.length > 0) {
    const posData = positionen.map((p, idx) => ({
      beleg_id: belegId,
      pos_nr: idx + 1,
      bezeichnung: p.bezeichnung || '',
      beschreibung: p.beschreibung || null,
      einheit: p.einheit || 'Stk',
      menge: parseFloat(p.menge) || 1,
      einzelpreis: parseFloat(p.einzelpreis) || 0,
      breite: p.breite ? parseFloat(p.breite) : null,
      hoehe: p.hoehe ? parseFloat(p.hoehe) : null,
      gruppe: p.gruppe || null,
      sort_order: idx,
    }))

    const posResult = await supabase.from('beleg_positionen').insert(posData)
    if (posResult.error) {
      return { error: posResult.error }
    }
  }

  return { data: belegResult.data }
}
