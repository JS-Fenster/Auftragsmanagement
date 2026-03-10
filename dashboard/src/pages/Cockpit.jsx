import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, Mail, AlertTriangle, ArrowRight, FileText, Package,
  CheckCircle, Clock, TrendingUp, Users, Calendar
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PROJEKT_STATUS, MONTAGE_TEAMS } from '../lib/constants'

// -- Helpers ---------------------------------------------------------------

const DAY = 86400000

const dateStr = new Date().toLocaleDateString('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
})

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std`
  const days = Math.floor(hours / 24)
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
}

const formatEuro = v =>
  v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-'

function kundeName(projekt) {
  const k = projekt.kontakte
  if (!k) return 'Unbekannt'
  const hp = k.kontakt_personen?.find(p => p.ist_hauptkontakt) || k.kontakt_personen?.[0]
  return k.firma1 || (hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt')
}

function kundeOrt(projekt) {
  return projekt.kontakte?.ort || ''
}

const TEAMS_MAP = Object.fromEntries(MONTAGE_TEAMS.map(t => [t.value, t.label]))

const DISPLAY_PHASES = ['anfrage', 'angebot', 'auftrag', 'bestellt', 'ab_erhalten', 'lieferung_geplant', 'montagebereit', 'abnahme', 'rechnung']

const HISTORIE_ICONS = {
  status_change: ArrowRight,
  notiz: FileText,
  bestellung: Package,
  erstellt: CheckCircle,
}

// -- Sub-Components --------------------------------------------------------

function AlertCard({ alert, onClick }) {
  const borderColor = alert.severity === 'danger' ? '#DC2626' : '#F59E0B'
  const bgColor = alert.severity === 'danger' ? '#FEF2F2' : '#FFFBEB'
  const ActionIcon = alert.action.icon

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      style={{ backgroundColor: bgColor, borderLeft: `4px solid ${borderColor}`, padding: '8px 12px' }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{alert.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{alert.subtitle}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation() }}
        className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white shrink-0"
        style={{ backgroundColor: borderColor }}
      >
        <ActionIcon size={14} />
        {alert.action.label}
      </button>
    </div>
  )
}

function MontageTeamCard({ team, montagen, onNavigate }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users size={16} style={{ color: '#10B981' }} />
        <h4 className="font-semibold text-sm text-gray-900">{TEAMS_MAP[team] || team}</h4>
        <span className="text-xs text-gray-400 ml-auto">{montagen.length} Montage{montagen.length !== 1 ? 'n' : ''}</span>
      </div>
      <div className="space-y-2">
        {montagen.map(p => (
          <div
            key={p.id}
            onClick={() => onNavigate(p.id)}
            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5 -mx-2"
          >
            <span className="font-medium text-gray-700 truncate">{kundeName(p)}</span>
            {kundeOrt(p) && <span className="text-xs text-gray-400 shrink-0">{kundeOrt(p)}</span>}
            <span className="text-xs text-gray-300 ml-auto shrink-0">{p.projekt_nummer}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineBar({ phase, data, maxWert }) {
  const status = PROJEKT_STATUS[phase]
  if (!status) return null
  const width = maxWert > 0 ? Math.max((data.wert / maxWert) * 100, 2) : 2

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 text-right text-xs font-medium text-gray-600 shrink-0">{status.label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden relative">
        <div
          className="h-full rounded-md flex items-center transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: status.color }}
        >
          {data.count > 0 && width > 15 && (
            <span className="text-xs font-semibold text-white px-2">{data.count}</span>
          )}
        </div>
        {data.count > 0 && width <= 15 && (
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: status.color, marginLeft: `${width}%` }}>
            {data.count}
          </span>
        )}
      </div>
      <span className="w-24 text-xs text-gray-500 shrink-0 text-right">{formatEuro(data.wert)}</span>
    </div>
  )
}

function HistorieItem({ entry, onNavigate }) {
  const Icon = HISTORIE_ICONS[entry.aktion] || Clock
  const projektNr = entry.projekte?.projekt_nummer || '???'
  const titel = entry.projekte?.titel || ''

  let text = `${projektNr}: ${entry.aktion}`
  if (entry.aktion === 'status_change' && entry.neuer_wert) {
    const label = PROJEKT_STATUS[entry.neuer_wert]?.label || entry.neuer_wert
    text = `${projektNr}: Status -> ${label}`
  } else if (entry.feld) {
    text = `${projektNr}: ${entry.feld} geaendert`
  }

  return (
    <div
      onClick={() => entry.projekt_id && onNavigate(entry.projekt_id)}
      className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-3"
    >
      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <Icon size={14} style={{ color: '#6B7280' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-800 truncate">{text}</p>
        {titel && <p className="text-xs text-gray-400 truncate">{titel}</p>}
      </div>
      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(entry.erstellt_am)}</span>
    </div>
  )
}

// -- Main Component --------------------------------------------------------

export default function Cockpit() {
  const navigate = useNavigate()
  const [projekte, setProjekte] = useState([])
  const [montagen, setMontagen] = useState([])
  const [historie, setHistorie] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const [projekteRes, montagenRes, historieRes] = await Promise.all([
        supabase
          .from('projekte')
          .select('*, kontakte!projekte_kontakt_id_fkey(id, firma1, firma2, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))')
          .not('status', 'in', '("erledigt","bezahlt","storniert")')
          .order('updated_at', { ascending: false }),
        supabase
          .from('projekte')
          .select('*, kontakte!projekte_kontakt_id_fkey(id, firma1, firma2, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))')
          .eq('montage_datum', today),
        supabase
          .from('projekt_historie')
          .select('*, projekte(projekt_nummer, titel)')
          .order('erstellt_am', { ascending: false })
          .limit(10),
      ])

      if (projekteRes.data) setProjekte(projekteRes.data)
      if (montagenRes.data) setMontagen(montagenRes.data)
      if (historieRes.data) setHistorie(historieRes.data)
    } catch (err) {
      console.error('Cockpit loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // -- Computed: Alerts
  const alerts = useMemo(() => {
    const result = []
    const now = Date.now()

    projekte.forEach(p => {
      // Angebot offen > 7 Tage
      if (p.status === 'angebot' && p.angebots_datum) {
        const days = Math.floor((now - new Date(p.angebots_datum).getTime()) / DAY)
        if (days > 7) result.push({
          id: p.id, type: 'angebot_offen',
          severity: days > 14 ? 'danger' : 'warning',
          title: `Angebot nachfassen: ${kundeName(p)}`,
          subtitle: `${p.projekt_nummer || '–'} – seit ${days} Tagen`,
          action: { label: 'Anrufen', icon: Phone },
          projekt: p,
        })
      }
      // AB fehlt > 5 Tage
      if (p.status === 'bestellt' && p.bestell_datum && !p.ab_datum) {
        const days = Math.floor((now - new Date(p.bestell_datum).getTime()) / DAY)
        if (days > 5) result.push({
          id: p.id, type: 'ab_fehlt',
          severity: days > 10 ? 'danger' : 'warning',
          title: `AB fehlt: ${kundeName(p)}`,
          subtitle: `${p.projekt_nummer || '–'} – seit ${days} Tagen`,
          action: { label: 'AB anfordern', icon: Mail },
          projekt: p,
        })
      }
      // Liefertermin ueberschritten
      if (p.liefertermin_geplant && ['bestellt', 'ab_erhalten', 'lieferung_geplant'].includes(p.status)) {
        const days = Math.floor((now - new Date(p.liefertermin_geplant).getTime()) / DAY)
        if (days > 0) result.push({
          id: p.id, type: 'liefertermin',
          severity: 'danger',
          title: `Liefertermin ueberschritten: ${kundeName(p)}`,
          subtitle: `${p.projekt_nummer || '–'} – ${days} Tage ueberfaellig`,
          action: { label: 'Pruefen', icon: AlertTriangle },
          projekt: p,
        })
      }
    })

    // Sort: danger first, then by days descending (implicit from text)
    result.sort((a, b) => (a.severity === 'danger' ? 0 : 1) - (b.severity === 'danger' ? 0 : 1))
    return result
  }, [projekte])

  // -- Computed: Pipeline
  const { pipeline, totalWert, maxWert } = useMemo(() => {
    const pl = {}
    DISPLAY_PHASES.forEach(phase => {
      const filtered = projekte.filter(p => p.status === phase)
      pl[phase] = {
        count: filtered.length,
        wert: filtered.reduce((sum, p) => sum + (p.auftrags_wert || p.angebots_wert || 0), 0),
      }
    })
    const total = Object.values(pl).reduce((s, p) => s + p.wert, 0)
    const max = Math.max(...Object.values(pl).map(p => p.wert), 1)
    return { pipeline: pl, totalWert: total, maxWert: max }
  }, [projekte])

  // -- Computed: Montagen gruppiert nach Team
  const montageTeams = useMemo(() => {
    const groups = {}
    montagen.forEach(m => {
      const team = m.montage_team || 'unbekannt'
      if (!groups[team]) groups[team] = []
      groups[team].push(m)
    })
    return groups
  }, [montagen])

  const goToProjekt = useCallback(id => navigate(`/projekte/${id}`), [navigate])

  // -- Render
  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-gray-400">
        <Clock size={20} className="animate-spin" />
        <span>Cockpit wird geladen...</span>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cockpit</h1>
        <span className="text-sm text-gray-500">{dateStr}</span>
      </div>

      {/* Sektion 1: Jetzt handeln */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertTriangle size={14} />
          Jetzt handeln
        </h2>
        {alerts.length === 0 ? (
          <div
            className="flex items-center gap-3 rounded-lg p-3 shadow-sm"
            style={{ backgroundColor: '#ECFDF5', borderLeft: '4px solid #10B981' }}
          >
            <CheckCircle size={20} style={{ color: '#10B981' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#065F46' }}>Alles im Griff</p>
              <p className="text-xs" style={{ color: '#047857' }}>Keine offenen Aktionen</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(a => (
              <AlertCard key={`${a.type}-${a.id}`} alert={a} onClick={() => goToProjekt(a.projekt.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Sektion 2+3: Montagen + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heute Montagen */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Calendar size={14} />
            Heute Montagen
          </h2>
          {montagen.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center text-sm text-gray-400">
              Keine Montagen geplant
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(montageTeams).map(([team, items]) => (
                <MontageTeamCard key={team} team={team} montagen={items} onNavigate={goToProjekt} />
              ))}
            </div>
          )}
        </section>

        {/* Pipeline */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={14} />
              Pipeline
            </h2>
            <span className="text-sm font-bold text-gray-700">{formatEuro(totalWert)}</span>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-1">
            {DISPLAY_PHASES.map(phase => (
              <PipelineBar key={phase} phase={phase} data={pipeline[phase]} maxWert={maxWert} />
            ))}
          </div>
        </section>
      </div>

      {/* Sektion 4: Letzte Aktivitaet */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Clock size={14} />
          Letzte Aktivitaet
        </h2>
        {historie.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center text-sm text-gray-400">
            Noch keine Aktivitaeten
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="divide-y divide-gray-100">
              {historie.map(entry => (
                <HistorieItem key={entry.id} entry={entry} onNavigate={goToProjekt} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
