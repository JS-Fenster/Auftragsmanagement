/**
 * Budgetangebot - Konstanten & Helper
 *
 * Wann lesen: Wenn du Preisberechnung, Formatierung, MwSt oder Firmendaten aendern musst.
 * Referenziert von: Allen Step-Komponenten + Hauptkomponente
 */
import { CheckCircle, AlertTriangle } from 'lucide-react'

// ── Constants ────────────────────────────────────────────

export const SYSTEME = [
  { value: '', label: 'Automatisch (KI entscheidet)' },
  { value: 'CASTELLO', label: 'CASTELLO' },
  { value: 'CALIDO', label: 'CALIDO' },
  { value: 'IMPREO', label: 'IMPREO' },
  { value: 'AFINO', label: 'AFINO' },
]

export const MWST_SATZ = 0.19

export const FIRMA_INFO = {
  firma: 'J.S. Fenster & Tueren GmbH',
  strasse: 'Regensburger Strasse 59',
  plz_ort: '92224 Amberg',
  telefon: '09621 / 76 35 33',
  fax: '09621 / 78 32 59',
  email: 'info@js-fenster.de',
  web: 'www.js-fenster.de',
}

export const CONFIDENCE_CONFIG = {
  high: { label: 'Hoch', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
  medium: { label: 'Mittel', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  low: { label: 'Niedrig', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
}

// ── Helpers ──────────────────────────────────────────────

export function formatEuro(value) {
  if (value == null || isNaN(value)) return '0,00 \u20AC'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function formatPreis(betrag, showNetto, opts = {}) {
  const { decimals = 0, suffix = ' EUR', isNetto = false } = opts
  if (betrag == null || isNaN(betrag)) return '-'
  let wert
  if (isNetto) {
    wert = showNetto ? betrag : betrag * (1 + MWST_SATZ)
  } else {
    wert = showNetto ? betrag / (1 + MWST_SATZ) : betrag
  }
  return wert.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + suffix
}

export function toDisplayValue(betrag, showNetto, isNetto = false) {
  if (betrag == null || isNaN(betrag)) return 0
  if (isNetto) return showNetto ? betrag : betrag * (1 + MWST_SATZ)
  return showNetto ? betrag / (1 + MWST_SATZ) : betrag
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
