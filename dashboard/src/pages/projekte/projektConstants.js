/**
 * Shared constants and helpers for ProjektDetail sub-components
 */
import { ChevronRight, Edit2, FileText, Package } from 'lucide-react'

export const STATUS_FLOW = ['anfrage', 'angebot', 'auftrag', 'bestellt', 'ab_erhalten', 'lieferung_geplant', 'montagebereit', 'abnahme', 'rechnung', 'bezahlt', 'erledigt']
export const SONDER_STATUS = ['reklamation', 'storniert', 'pausiert']
export const STATUS_DATE_MAP = {
  angebot: 'angebots_datum',
  auftrag: 'auftrags_datum',
  bestellt: 'bestell_datum',
  ab_erhalten: 'ab_datum',
  lieferung_geplant: 'liefertermin_geplant',
  montagebereit: 'montage_datum',
  abnahme: 'abnahme_datum',
  rechnung: 'rechnung_datum',
  bezahlt: 'bezahlt_datum',
  erledigt: 'erledigt_datum',
  reklamation: 'reklamation_datum',
  storniert: 'storniert_datum',
  pausiert: 'pausiert_datum',
}

export const formatEuro = (v) => v != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-'
export const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-'
export const formatRelativeTime = (dateStr) => {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `vor ${days} Tagen`
  return new Date(dateStr).toLocaleDateString('de-DE')
}

export const HISTORIE_STYLES = {
  status_change: { dot: '#3B82F6', icon: ChevronRight },
  field_update: { dot: '#9CA3AF', icon: Edit2 },
  notiz: { dot: '#10B981', icon: FileText },
  bestellung: { dot: '#F97316', icon: Package },
}

export const BELEG_TYPEN_MAP = {
  angebot:               { label: 'Angebot',             bg: '#F5F3FF', text: '#5B21B6' },
  auftragsbestaetigung:  { label: 'AB',                  bg: '#EFF6FF', text: '#1E40AF' },
  lieferschein:          { label: 'Lieferschein',        bg: '#F0FDFA', text: '#115E59' },
  rechnung:              { label: 'Rechnung',            bg: '#FFFBEB', text: '#92400E' },
  abschlagsrechnung:     { label: 'Abschlagsrechnung',   bg: '#FFF7ED', text: '#9A3412' },
  schlussrechnung:       { label: 'Schlussrechnung',     bg: '#D1FAE5', text: '#064E3B' },
  gutschrift:            { label: 'Gutschrift',          bg: '#FEE2E2', text: '#991B1B' },
}

export const BELEG_STATUS_MAP = {
  entwurf:      { label: 'Entwurf',      bg: '#F3F4F6', text: '#374151' },
  freigegeben:  { label: 'Freigegeben',  bg: '#EFF6FF', text: '#1E40AF' },
  versendet:    { label: 'Versendet',    bg: '#F5F3FF', text: '#5B21B6' },
  angenommen:   { label: 'Angenommen',   bg: '#ECFDF5', text: '#065F46' },
  abgelehnt:    { label: 'Abgelehnt',    bg: '#FEE2E2', text: '#991B1B' },
  bezahlt:      { label: 'Bezahlt',      bg: '#D1FAE5', text: '#064E3B' },
  teilbezahlt:  { label: 'Teilbezahlt',  bg: '#FFFBEB', text: '#92400E' },
  storniert:    { label: 'Storniert',    bg: '#F3F4F6', text: '#6B7280' },
}

export const BESTELL_STATUS = {
  entwurf: { label: 'Entwurf', color: '#6B7280', bg: '#F3F4F6' },
  bestellt: { label: 'Bestellt', color: '#F59E0B', bg: '#FFFBEB' },
  ab_erhalten: { label: 'AB erhalten', color: '#14B8A6', bg: '#F0FDFA' },
  teilgeliefert: { label: 'Teilgeliefert', color: '#06B6D4', bg: '#ECFEFF' },
  geliefert: { label: 'Geliefert', color: '#10B981', bg: '#ECFDF5' },
  storniert: { label: 'Storniert', color: '#DC2626', bg: '#FEF2F2' },
}

export const DATE_FIELDS = [
  { key: 'angebots_datum', label: 'Angebots-Datum' },
  { key: 'auftrags_datum', label: 'Auftrags-Datum' },
  { key: 'bestell_datum', label: 'Bestell-Datum' },
  { key: 'ab_datum', label: 'AB-Datum' },
  { key: 'liefertermin_geplant', label: 'Liefertermin' },
  { key: 'montage_datum', label: 'Montage-Datum' },
  { key: 'abnahme_datum', label: 'Abnahme-Datum' },
  { key: 'rechnung_datum', label: 'Rechnung-Datum' },
  { key: 'bezahlt_datum', label: 'Bezahlt-Datum' },
  { key: 'erledigt_datum', label: 'Erledigt-Datum' },
]

export const VALUE_FIELDS = [
  { key: 'angebots_wert', label: 'Angebots-Wert', format: formatEuro },
  { key: 'auftrags_wert', label: 'Auftrags-Wert', format: formatEuro },
  { key: 'rechnungs_betrag', label: 'Rechnungs-Betrag', format: formatEuro },
]
