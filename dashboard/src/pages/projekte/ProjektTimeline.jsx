/**
 * ProjektTimeline — Chronologische Timeline aller Projekt-Interaktionen
 *
 * Aggregiert: Historie, Belege, Bestellungen, Dokumente
 */
import { useState, useEffect, useCallback } from 'react'
import { FileText, Package, ChevronRight, Edit2, File, Loader2, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TYPE_STYLES = {
  historie:   { color: '#3B82F6', icon: ChevronRight },
  beleg:      { color: '#8B5CF6', icon: FileText },
  bestellung: { color: '#F97316', icon: Package },
  dokument:   { color: '#14B8A6', icon: File },
}

const formatEuro = v => v != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : ''

function relativeDate(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `vor ${days} Tagen`
  return new Date(dateStr).toLocaleDateString('de-DE')
}

function getTitle(item) {
  switch (item._type) {
    case 'historie':
      if (item.aktion === 'status_change' && item.neuer_wert)
        return `Status → ${item.neuer_wert}`
      if (item.aktion === 'notiz')
        return item.neuer_wert || 'Notiz'
      if (item.feld)
        return `${item.feld} geaendert`
      return item.aktion || 'Aenderung'
    case 'beleg':
      return `${(item.beleg_typ || '').replace(/_/g, ' ')} ${item.beleg_nummer || ''} — ${formatEuro(item.brutto_summe)}`
    case 'bestellung':
      return `Bestellung ${item.bestell_nummer || ''} bei ${item.lieferant_name || '?'}`
    case 'dokument':
      return `${item.documents?.dateiname || 'Dokument'} (${item.documents?.kategorie || '?'})`
    default:
      return '?'
  }
}

function getSubtitle(item) {
  switch (item._type) {
    case 'historie':
      if (item.aktion === 'status_change' && item.alter_wert)
        return `von ${item.alter_wert}`
      if (item.aktion === 'field_update')
        return `${item.alter_wert || '-'} → ${item.neuer_wert || '-'}`
      return null
    case 'beleg':
      return item.status ? item.status : null
    case 'bestellung':
      return item.status ? `Status: ${item.status}` : null
    default:
      return null
  }
}

export default function ProjektTimeline({ projektId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    if (!projektId) return
    setLoading(true)

    const [histRes, belegRes, bestRes, dokRes] = await Promise.all([
      supabase.from('projekt_historie').select('*').eq('projekt_id', projektId),
      supabase.from('belege').select('id, beleg_typ, beleg_nummer, brutto_summe, status, datum, created_at').eq('projekt_id', projektId),
      supabase.from('projekt_bestellungen').select('id, bestell_nummer, lieferant_name, status, bestell_datum, created_at').eq('projekt_id', projektId),
      supabase.from('projekt_dokumente').select('id, created_at, documents(id, dateiname, kategorie, created_at)').eq('projekt_id', projektId),
    ])

    const all = [
      ...(histRes.data || []).map(h => ({ ...h, _type: 'historie', _date: h.erstellt_am })),
      ...(belegRes.data || []).map(b => ({ ...b, _type: 'beleg', _date: b.created_at })),
      ...(bestRes.data || []).map(b => ({ ...b, _type: 'bestellung', _date: b.created_at })),
      ...(dokRes.data || []).map(d => ({ ...d, _type: 'dokument', _date: d.created_at })),
    ]

    all.sort((a, b) => new Date(b._date) - new Date(a._date))
    setItems(all)
    setLoading(false)
  }, [projektId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-text-muted py-2"><Loader2 size={16} className="animate-spin" /> Timeline laden...</div>
  }

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Noch keine Aktivitaeten.</p>
  }

  const visible = showAll ? items : items.slice(0, 20)

  return (
    <div className="space-y-1">
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border-default" />

        {visible.map((item, idx) => {
          const style = TYPE_STYLES[item._type] || TYPE_STYLES.historie
          const Icon = style.icon
          const title = getTitle(item)
          const subtitle = getSubtitle(item)

          return (
            <div key={`${item._type}-${item.id}-${idx}`} className="relative flex gap-3 pb-3">
              {/* Dot */}
              <div
                className="absolute left-[-14px] w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: style.color }}
              >
                <Icon size={10} className="text-white" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{title}</p>
                {subtitle && <p className="text-xs text-text-muted truncate">{subtitle}</p>}
              </div>
              <span className="text-xs text-text-muted shrink-0 whitespace-nowrap">{relativeDate(item._date)}</span>
            </div>
          )
        })}
      </div>

      {items.length > 20 && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark ml-6"
        >
          <ChevronDown size={14} className={showAll ? 'rotate-180' : ''} />
          {showAll ? 'Weniger anzeigen' : `Alle ${items.length} Eintraege anzeigen`}
        </button>
      )}
    </div>
  )
}
