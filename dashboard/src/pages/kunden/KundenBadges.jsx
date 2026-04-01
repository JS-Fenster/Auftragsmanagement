import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { AUFTRAG_STATUS } from '../../lib/constants'
import { Phone, Globe, Mail, Truck } from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────

export function formatDate(dateStr) {
  if (!dateStr) return '–'
  try { return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de }) }
  catch { return '–' }
}

export function formatEur(val) {
  if (val == null) return '–'
  return Number(val).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function getDisplayName(kontakt) {
  if (kontakt.firma1) return kontakt.firma1
  const hauptperson = (kontakt.kontakt_personen || []).find(p => p.ist_hauptkontakt) || (kontakt.kontakt_personen || [])[0]
  if (hauptperson) {
    const parts = [hauptperson.vorname, hauptperson.nachname].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  return '–'
}

export function getHauptperson(kontakt) {
  const personen = kontakt.kontakt_personen || []
  return personen.find(p => p.ist_hauptkontakt) || personen[0] || null
}

export function getPrimaerDetail(person, typ) {
  if (!person) return null
  const details = person.kontakt_details || []
  return details.find(d => d.typ === typ && d.ist_primaer) || details.find(d => d.typ === typ) || null
}

export const DETAIL_TYPE_ICON = {
  telefon: Phone,
  email: Mail,
  fax: Phone,
  website: Globe,
}

// ─── Badges ────────────────────────────────────────────────

export function SourceBadge({ hasErp }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: hasErp ? '#EFF6FF' : '#F0FDF4',
        color: hasErp ? '#1E40AF' : '#166534',
      }}
    >
      {hasErp ? 'ERP' : 'Manuell'}
    </span>
  )
}

export function RoleBadge({ rolle }) {
  if (!rolle) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-hover text-text-secondary">
      {rolle}
    </span>
  )
}

export function TypBadge({ typ }) {
  if (!typ) return null
  const map = {
    privat: { bg: '#F0FDF4', color: '#166534', label: 'Privat' },
    gewerbe: { bg: '#FEF3C7', color: '#92400E', label: 'Gewerbe' },
    oeffentlich: { bg: '#EFF6FF', color: '#1E40AF', label: 'Öffentlich' },
  }
  const cfg = map[typ] || { bg: '#F3F4F6', color: '#374151', label: typ }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

export function KundeLieferantBadge({ istKunde, istLieferant }) {
  return (
    <>
      {istKunde && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-light text-brand-dark">
          Kunde
        </span>
      )}
      {istLieferant && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
          <Truck className="w-3 h-3 mr-1" />Lieferant
        </span>
      )}
    </>
  )
}

export function StatusBadge({ status }) {
  const cfg = AUFTRAG_STATUS[status] || { label: status || '–', bg: '#F3F4F6', text: '#374151' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}
