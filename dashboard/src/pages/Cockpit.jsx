import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, Mail, AlertTriangle, ArrowRight, FileText, Package,
  CheckCircle, Clock, TrendingUp, Users, Calendar, Euro,
  ArrowUpRight, ArrowDownLeft, FileCheck
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
  const borderColor = alert.severity === 'danger' ? '#DC2626' : '#FAB20B'
  const ActionIcon = alert.action.icon

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between bg-surface-card border border-border-default rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${borderColor}`, padding: '8px 12px' }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text-primary text-sm truncate">{alert.title}</p>
        <p className="text-xs text-text-secondary mt-0.5">{alert.subtitle}</p>
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
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users size={16} className="text-success" />
        <h4 className="font-semibold text-sm text-text-primary">{TEAMS_MAP[team] || team}</h4>
        <span className="text-xs text-text-muted ml-auto">{montagen.length} Montage{montagen.length !== 1 ? 'n' : ''}</span>
      </div>
      <div className="space-y-2">
        {montagen.map(p => (
          <div
            key={p.id}
            onClick={() => onNavigate(p.id)}
            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-main rounded px-2 py-1.5 -mx-2"
          >
            <span className="font-medium text-text-primary truncate">{kundeName(p)}</span>
            {kundeOrt(p) && <span className="text-xs text-text-muted shrink-0">{kundeOrt(p)}</span>}
            <span className="text-xs text-text-muted ml-auto shrink-0">{p.projekt_nummer}</span>
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
      <span className="w-24 text-right text-xs font-medium text-text-secondary shrink-0">{status.label}</span>
      <div className="flex-1 h-5 bg-surface-hover rounded-md overflow-hidden relative">
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
      <span className="w-24 text-xs text-text-secondary shrink-0 text-right">{formatEuro(data.wert)}</span>
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
    text = `${projektNr}: ${entry.feld} geändert`
  }

  return (
    <div
      onClick={() => entry.projekt_id && onNavigate(entry.projekt_id)}
      className="flex items-start gap-3 cursor-pointer hover:bg-surface-main rounded-lg px-2 py-1.5 -mx-3"
    >
      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-surface-hover">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary truncate">{text}</p>
        {titel && <p className="text-xs text-text-muted truncate">{titel}</p>}
      </div>
      <span className="text-xs text-text-muted shrink-0 whitespace-nowrap">{timeAgo(entry.erstellt_am)}</span>
    </div>
  )
}

// -- Main Component --------------------------------------------------------

export default function Cockpit() {
  const navigate = useNavigate()
  const [projekte, setProjekte] = useState([])
  const [montagen, setMontagen] = useState([])
  const [historie, setHistorie] = useState([])
  const [finanzKpis, setFinanzKpis] = useState(null)
  const [belegeKpis, setBelegeKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const [projekteRes, montagenRes, historieRes, offArRes, offErRes, bestRes, belegeRes] = await Promise.all([
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
        supabase.from('v_offene_ausgangsrechnungen').select('offener_betrag, ueberfaellig_tage'),
        supabase.from('v_offene_eingangsrechnungen').select('offener_betrag, skonto_moeglich'),
        supabase.from('projekt_bestellungen').select('status, liefertermin_geplant, bestell_wert').not('status', 'in', '("geliefert","storniert")'),
        supabase.from('belege').select('beleg_typ, status, brutto_summe'),
      ])

      if (projekteRes.data) setProjekte(projekteRes.data)
      if (montagenRes.data) setMontagen(montagenRes.data)
      if (historieRes.data) setHistorie(historieRes.data)

      // Finanz-KPIs berechnen
      const offAR = offArRes.data || []
      const offER = offErRes.data || []
      const best = bestRes.data || []
      setFinanzKpis({
        offeneAR: offAR.reduce((s, r) => s + (r.offener_betrag || 0), 0),
        ueberfaelligAR: offAR.filter(r => r.ueberfaellig_tage > 0).length,
        offeneER: offER.reduce((s, r) => s + (r.offener_betrag || 0), 0),
        skontoMoeglich: offER.reduce((s, r) => s + (r.skonto_moeglich || 0), 0),
        aktiveBest: best.length,
        bestWert: best.reduce((s, b) => s + (b.bestell_wert || 0), 0),
        ueberfaelligBest: best.filter(b => b.liefertermin_geplant && new Date(b.liefertermin_geplant) < new Date()).length,
      })

      // Belege-KPIs berechnen
      const allBelege = belegeRes.data || []
      const entwuerfe = allBelege.filter(b => b.status === 'entwurf').length
      const offeneAngebote = allBelege.filter(b => b.beleg_typ === 'angebot' && ['freigegeben', 'versendet'].includes(b.status))
      const rechnungsTypen = ['rechnung', 'abschlagsrechnung', 'schlussrechnung']
      const unbezahlteRechnungen = allBelege.filter(b => rechnungsTypen.includes(b.beleg_typ) && !['bezahlt', 'storniert', 'entwurf'].includes(b.status))
      setBelegeKpis({
        entwuerfe,
        offeneAngeboteCount: offeneAngebote.length,
        offeneAngeboteWert: offeneAngebote.reduce((s, b) => s + (b.brutto_summe || 0), 0),
        unbezahltCount: unbezahlteRechnungen.length,
        unbezahltWert: unbezahlteRechnungen.reduce((s, b) => s + (b.brutto_summe || 0), 0),
      })
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
      <div className="p-6 flex items-center gap-3 text-text-muted">
        <Clock size={20} className="animate-spin" />
        <span>Cockpit wird geladen...</span>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Cockpit</h1>
        <span className="text-sm text-text-secondary">{dateStr}</span>
      </div>

      {/* Sektion 1: Jetzt handeln */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertTriangle size={14} />
          Jetzt handeln
        </h2>
        {alerts.length === 0 ? (
          <div
            className="flex items-center gap-3 rounded-lg p-3 shadow-sm bg-success-light"
            style={{ borderLeft: '4px solid var(--success)' }}
          >
            <CheckCircle size={20} className="text-success" />
            <div>
              <p className="font-semibold text-sm text-success-dark">Alles im Griff</p>
              <p className="text-xs text-success-dark/80">Keine offenen Aktionen</p>
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
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
            <Calendar size={14} />
            Heute Montagen
          </h2>
          {montagen.length === 0 ? (
            <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-4 text-center text-sm text-text-muted">
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
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={14} />
              Pipeline
            </h2>
            <span className="text-sm font-bold text-text-primary">{formatEuro(totalWert)}</span>
          </div>
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3 space-y-1">
            {DISPLAY_PHASES.map(phase => (
              <PipelineBar key={phase} phase={phase} data={pipeline[phase]} maxWert={maxWert} />
            ))}
          </div>
        </section>
      </div>

      {/* Sektion 4: Finanz-Ueberblick */}
      {finanzKpis && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
            <Euro size={14} />
            Finanzen & Bestellungen
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              onClick={() => navigate('/finanzen')}
              className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight size={14} className="text-blue-500" />
                <span className="text-xs text-text-secondary">Offene AR</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{formatEuro(finanzKpis.offeneAR)}</p>
              {finanzKpis.ueberfaelligAR > 0 && (
                <p className="text-xs text-red-500 mt-0.5">{finanzKpis.ueberfaelligAR} überfällig</p>
              )}
            </div>
            <div
              onClick={() => navigate('/finanzen')}
              className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft size={14} className="text-amber-500" />
                <span className="text-xs text-text-secondary">Offene ER</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{formatEuro(finanzKpis.offeneER)}</p>
              {finanzKpis.skontoMoeglich > 0 && (
                <p className="text-xs text-green-600 mt-0.5">{formatEuro(finanzKpis.skontoMoeglich)} Skonto möglich</p>
              )}
            </div>
            <div
              onClick={() => navigate('/bestellungen')}
              className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-1">
                <Package size={14} className="text-purple-500" />
                <span className="text-xs text-text-secondary">Bestellungen aktiv</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{finanzKpis.aktiveBest}</p>
              <p className="text-xs text-text-muted mt-0.5">{formatEuro(finanzKpis.bestWert)}</p>
            </div>
            {finanzKpis.ueberfaelligBest > 0 && (
              <div
                onClick={() => navigate('/bestellungen')}
                className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-xs text-red-700">Lieferung überfällig</span>
                </div>
                <p className="text-lg font-bold text-red-700">{finanzKpis.ueberfaelligBest}</p>
                <p className="text-xs text-red-500 mt-0.5">Lieferanten kontaktieren!</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Sektion 5: Belege */}
      {belegeKpis && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileCheck size={14} />
            Belege
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              onClick={() => navigate('/belege')}
              className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText size={14} className="text-gray-400" />
                <span className="text-xs text-text-secondary">Entwürfe</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{belegeKpis.entwuerfe}</p>
              <p className="text-xs text-text-muted mt-0.5">Noch nicht freigegeben</p>
            </div>
            <div
              onClick={() => navigate('/belege')}
              className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText size={14} className="text-purple-500" />
                <span className="text-xs text-text-secondary">Offene Angebote</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{belegeKpis.offeneAngeboteCount}</p>
              <p className="text-xs text-text-muted mt-0.5">{formatEuro(belegeKpis.offeneAngeboteWert)}</p>
            </div>
            <div
              onClick={() => navigate('/belege')}
              className={`rounded-lg shadow-sm border p-3 cursor-pointer hover:shadow-md transition-shadow ${
                belegeKpis.unbezahltCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-surface-card border-border-default'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Euro size={14} className="text-amber-500" />
                <span className="text-xs text-text-secondary">Unbezahlte Rechnungen</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{belegeKpis.unbezahltCount}</p>
              <p className="text-xs text-text-muted mt-0.5">{formatEuro(belegeKpis.unbezahltWert)}</p>
            </div>
          </div>
        </section>
      )}

      {/* Sektion 6: Letzte Aktivitaet */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
          <Clock size={14} />
          Letzte Aktivitaet
        </h2>
        {historie.length === 0 ? (
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-4 text-center text-sm text-text-muted">
            Noch keine Aktivitaeten
          </div>
        ) : (
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-3">
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
