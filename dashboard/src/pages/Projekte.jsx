import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List, Search, Filter, X, RefreshCw, Rows3, Layers } from 'lucide-react'
import { supabase } from '../lib/supabase'
import KanbanBoard from '../components/KanbanBoard'
import PipelineView from '../components/PipelineView'
import GroupedTableView from '../components/GroupedTableView'
import ProaktiveAlerts from '../components/ProaktiveAlerts'
import StatusBadge, { PROJEKT_PHASEN } from '../components/StatusBadge'
import { PrioritaetBadge } from '../components/StatusBadge'
import { PROJEKT_TYPEN } from '../lib/constants'

// ── Helpers ──────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '–'
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '–' }
}

function formatCurrency(val) {
  if (val == null) return '–'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val)
}

function kontaktName(k) {
  if (!k) return '–'
  if (k.firma1) return k.firma1
  const hp = k.kontakt_personen?.find(p => p.ist_hauptkontakt) || k.kontakt_personen?.[0]
  if (hp) return [hp.vorname, hp.nachname].filter(Boolean).join(' ')
  return '–'
}

const DAY_MS = 86400000

// ── Stats Card ───────────────────────────────────────────

function StatCard({ label, count, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center px-4 py-3 rounded-lg shadow-sm border transition-all cursor-pointer ${
        active ? 'ring-2 ring-offset-1' : ''
      }`}
      style={{
        backgroundColor: active ? color + '18' : 'white',
        borderColor: active ? color : '#e5e7eb',
        ringColor: active ? color : undefined,
      }}
    >
      <span className="text-2xl font-bold" style={{ color }}>{count}</span>
      <span className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">{label}</span>
    </button>
  )
}

// ── Main Component ───────────────────────────────────────

export default function Projekte() {
  const navigate = useNavigate()

  const [projekte, setProjekte] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPrio, setFilterPrio] = useState('')
  const [filterTyp, setFilterTyp] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)

  // ── Data Loading ─────────────────────────────────────

  const loadProjekte = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('projekte')
        .select('*, kontakte!projekte_kontakt_id_fkey(id, firma1, firma2, strasse, plz, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))')
        .order('updated_at', { ascending: false })

      if (filterStatus) query = query.eq('status', filterStatus)
      if (filterPrio) query = query.eq('prioritaet', filterPrio)
      if (filterTyp) query = query.eq('typ', filterTyp)
      if (searchTerm) {
        query = query.or(`titel.ilike.%${searchTerm}%,projekt_nummer.ilike.%${searchTerm}%,notizen.ilike.%${searchTerm}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setProjekte(data || [])
    } catch (err) {
      console.error('Fehler beim Laden:', err)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterPrio, filterTyp, searchTerm])

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('projekte')
      .select('*, kontakte!projekte_kontakt_id_fkey(firma1, firma2)')
      .not('status', 'in', '("erledigt","bezahlt","storniert")')

    if (!data) return
    const now = Date.now()
    const newAlerts = []

    data.forEach(p => {
      if (p.status === 'angebot' && p.angebots_datum) {
        const days = Math.floor((now - new Date(p.angebots_datum).getTime()) / DAY_MS)
        if (days > 7) newAlerts.push({
          id: p.id + '_angebot', projekt: p, alertType: 'angebot_offen',
          message: `Angebot seit ${days} Tagen ohne Rückmeldung`,
          severity: days > 14 ? 'danger' : 'warning',
        })
      }
      if (p.status === 'bestellt' && p.bestell_datum && !p.ab_datum) {
        const days = Math.floor((now - new Date(p.bestell_datum).getTime()) / DAY_MS)
        if (days > 5) newAlerts.push({
          id: p.id + '_ab', projekt: p, alertType: 'ab_fehlt',
          message: `AB fehlt seit ${days} Tagen`,
          severity: days > 10 ? 'danger' : 'warning',
        })
      }
      if (p.liefertermin_geplant && ['bestellt', 'ab_erhalten', 'lieferung_geplant'].includes(p.status)) {
        const days = Math.floor((now - new Date(p.liefertermin_geplant).getTime()) / DAY_MS)
        if (days > 0) newAlerts.push({
          id: p.id + '_liefer', projekt: p, alertType: 'liefertermin_ueberschritten',
          message: `Liefertermin ${days} Tage überschritten`,
          severity: 'danger',
        })
      }
    })
    setAlerts(newAlerts)
  }, [])

  // Stats derived from projekte
  useEffect(() => {
    const byStatus = {}
    Object.keys(PROJEKT_PHASEN).forEach(s => { byStatus[s] = 0 })
    projekte.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1 })
    setStats({ byStatus, total: projekte.length })
  }, [projekte])

  useEffect(() => { loadProjekte(); loadAlerts() }, [loadProjekte, loadAlerts])

  // ── Status Change (Drag & Drop) ─────────────────────

  const handleStatusChange = async (projektId, neuerStatus) => {
    const projekt = projekte.find(p => p.id === projektId)
    if (!projekt) return
    const alterStatus = projekt.status

    const today = new Date().toISOString().split('T')[0]
    const DATE_MAP = {
      angebot: 'angebots_datum', auftrag: 'auftrags_datum', bestellt: 'bestell_datum',
      ab_erhalten: 'ab_datum', montagebereit: 'montage_datum', abnahme: 'abnahme_datum',
      rechnung: 'rechnung_datum', bezahlt: 'bezahlt_datum', erledigt: 'erledigt_datum',
      reklamation: 'reklamation_datum', storniert: 'storniert_datum', pausiert: 'pausiert_datum',
    }
    const dateUpdates = {}
    const dateField = DATE_MAP[neuerStatus]
    if (dateField && !projekt[dateField]) dateUpdates[dateField] = today

    const { error } = await supabase
      .from('projekte')
      .update({ status: neuerStatus, ...dateUpdates })
      .eq('id', projektId)
    if (error) { console.error(error); return }

    await supabase.from('projekt_historie').insert({
      projekt_id: projektId,
      aktion: 'status_change',
      feld: 'status',
      alter_wert: alterStatus,
      neuer_wert: neuerStatus,
      erstellt_von: 'Dashboard',
    })

    loadProjekte()
    loadAlerts()
  }

  // ── Filter helpers ───────────────────────────────────

  const hasFilters = filterStatus || filterPrio || filterTyp || searchTerm
  const clearFilters = () => { setFilterStatus(''); setFilterPrio(''); setFilterTyp(''); setSearchTerm('') }

  const statsCards = [
    { key: 'anfrage', label: 'Anfragen', color: '#3b82f6' },
    { key: 'angebot', label: 'Angebote offen', color: '#8b5cf6' },
    { key: 'bestellt', label: 'Wartend auf AB', color: '#f59e0b' },
    { key: 'montagebereit', label: 'Montagebereit', color: '#10b981' },
  ]

  const aktivCount = projekte.filter(p => !['erledigt', 'bezahlt', 'storniert'].includes(p.status)).length

  // ── Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Projekte</h1>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-white border rounded-lg overflow-hidden">
              <button
                onClick={() => setView('kanban')}
                className={`p-2 ${view === 'kanban' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kanban-Ansicht"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setView('pipeline')}
                className={`p-2 ${view === 'pipeline' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Pipeline-Ansicht"
              >
                <Rows3 size={18} />
              </button>
              <button
                onClick={() => setView('grouped')}
                className={`p-2 ${view === 'grouped' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Gruppierte Ansicht"
              >
                <Layers size={18} />
              </button>
              <button
                onClick={() => setView('tabelle')}
                className={`p-2 ${view === 'tabelle' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Tabellen-Ansicht"
              >
                <List size={18} />
              </button>
            </div>

            <button onClick={() => { loadProjekte(); loadAlerts() }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white" title="Aktualisieren">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={16} /> Neues Projekt
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Titel, Projekt-Nr..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Filter size={16} className="text-gray-400" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Alle Status</option>
              {Object.entries(PROJEKT_PHASEN).map(([key, phase]) => (
                <option key={key} value={key}>{phase.label}</option>
              ))}
            </select>
            <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Alle Typen</option>
              {Object.entries(PROJEKT_TYPEN).map(([key, typ]) => (
                <option key={key} value={key}>{typ.label}</option>
              ))}
            </select>
            <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Alle Prioritäten</option>
              <option value="dringend">Dringend</option>
              <option value="hoch">Hoch</option>
              <option value="normal">Normal</option>
              <option value="niedrig">Niedrig</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <X size={14} /> Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
          {statsCards.map(sc => (
            <StatCard
              key={sc.key}
              label={sc.label}
              count={stats.byStatus?.[sc.key] || 0}
              color={sc.color}
              active={filterStatus === sc.key}
              onClick={() => setFilterStatus(filterStatus === sc.key ? '' : sc.key)}
            />
          ))}
          <StatCard label="Gesamt aktiv" count={aktivCount} color="#6b7280" active={false} onClick={() => {}} />
        </div>

        {/* Proaktive Alerts */}
        {alerts.length > 0 && (
          <div className="mb-4">
            <ProaktiveAlerts
              alerts={alerts}
              onClickAlert={(alert) => navigate(`/projekte/${alert.projekt?.id}`)}
            />
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw size={24} className="animate-spin mr-3" /> Projekte werden geladen...
          </div>
        ) : projekte.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">Keine Projekte gefunden</p>
            {hasFilters && <button onClick={clearFilters} className="text-blue-500 hover:underline text-sm">Filter zurücksetzen</button>}
          </div>
        ) : view === 'kanban' ? (
          <KanbanBoard
            projekte={projekte}
            onStatusChange={handleStatusChange}
            onProjektClick={id => navigate(`/projekte/${id}`)}
            alerts={alerts}
          />
        ) : view === 'pipeline' ? (
          <PipelineView
            projekte={projekte}
            alerts={alerts}
            onProjektClick={id => navigate(`/projekte/${id}`)}
          />
        ) : view === 'grouped' ? (
          <GroupedTableView
            projekte={projekte}
            alerts={alerts}
            onProjektClick={id => navigate(`/projekte/${id}`)}
          />
        ) : (
          <TableView projekte={projekte} onRowClick={id => navigate(`/projekte/${id}`)} />
        )}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onCreated={id => { setShowNewModal(false); navigate(`/projekte/${id}`) }}
        />
      )}
    </div>
  )
}

// ── Table View ─────────────────────────────────────────────

function TableView({ projekte, onRowClick }) {
  const [sortField, setSortField] = useState('updated_at')
  const [sortAsc, setSortAsc] = useState(false)

  const handleSort = field => {
    if (sortField === field) { setSortAsc(!sortAsc) }
    else { setSortField(field); setSortAsc(true) }
  }

  const sorted = [...projekte].sort((a, b) => {
    const va = a[sortField] ?? ''
    const vb = b[sortField] ?? ''
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortAsc ? cmp : -cmp
  })

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none'
  const arrow = field => sortField === field ? (sortAsc ? ' ▲' : ' ▼') : ''

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className={thClass} onClick={() => handleSort('projekt_nummer')}>Projekt-Nr{arrow('projekt_nummer')}</th>
            <th className={thClass} onClick={() => handleSort('titel')}>Titel{arrow('titel')}</th>
            <th className={thClass}>Kunde</th>
            <th className={thClass} onClick={() => handleSort('status')}>Status{arrow('status')}</th>
            <th className={thClass} onClick={() => handleSort('prioritaet')}>Prio{arrow('prioritaet')}</th>
            <th className={thClass} onClick={() => handleSort('angebots_wert')}>Wert{arrow('angebots_wert')}</th>
            <th className={thClass} onClick={() => handleSort('updated_at')}>Aktualisiert{arrow('updated_at')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(p => (
            <tr
              key={p.id}
              onClick={() => onRowClick(p.id)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.projekt_nummer || '–'}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[300px] truncate">{p.titel || '–'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{kontaktName(p.kontakte)}</td>
              <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              <td className="px-4 py-3"><PrioritaetBadge prioritaet={p.prioritaet} /></td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(p.angebots_wert)}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{formatDate(p.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── New Project Modal ──────────────────────────────────────

function NewProjectModal({ onClose, onCreated }) {
  const [titel, setTitel] = useState('')
  const [status, setStatus] = useState('anfrage')
  const [prioritaet, setPrioritaet] = useState('normal')
  const [angebots_wert, setAngebotswert] = useState('')
  const [notizen, setNotizen] = useState('')
  const [saving, setSaving] = useState(false)

  // Kontakt search
  const [kontaktSuche, setKontaktSuche] = useState('')
  const [kontaktResults, setKontaktResults] = useState([])
  const [selectedKontakt, setSelectedKontakt] = useState(null)

  useEffect(() => {
    if (kontaktSuche.length < 2) { setKontaktResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('kontakte')
        .select('id, firma1, firma2, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt)')
        .or(`firma1.ilike.%${kontaktSuche}%,firma2.ilike.%${kontaktSuche}%`)
        .limit(10)
      setKontaktResults(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [kontaktSuche])

  const handleSave = async () => {
    if (!titel.trim()) return
    setSaving(true)
    try {
      const payload = {
        titel: titel.trim(),
        status,
        prioritaet,
        notizen: notizen.trim() || null,
        angebots_wert: angebots_wert ? parseFloat(angebots_wert) : null,
        kontakt_id: selectedKontakt?.id || null,
      }
      if (status === 'angebot') payload.angebots_datum = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase.from('projekte').insert(payload).select('id').single()
      if (error) throw error
      onCreated(data.id)
    } catch (err) {
      console.error('Fehler beim Erstellen:', err)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Neues Projekt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Titel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              type="text" value={titel} onChange={e => setTitel(e.target.value)} autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="z.B. Fenster EFH Meier, Köln"
            />
          </div>

          {/* Kontakt */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
            {selectedKontakt ? (
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-blue-50">
                <span className="text-sm flex-1">{kontaktName(selectedKontakt)}{selectedKontakt.ort ? ` (${selectedKontakt.ort})` : ''}</span>
                <button onClick={() => { setSelectedKontakt(null); setKontaktSuche('') }} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
              </div>
            ) : (
              <input
                type="text" value={kontaktSuche} onChange={e => setKontaktSuche(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Firma oder Name eingeben..."
              />
            )}
            {kontaktResults.length > 0 && !selectedKontakt && (
              <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {kontaktResults.map(k => (
                  <li key={k.id}
                    onClick={() => { setSelectedKontakt(k); setKontaktResults([]); setKontaktSuche('') }}
                    className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                  >
                    <span className="font-medium">{kontaktName(k)}</span>
                    {k.ort && <span className="text-gray-400 ml-2">{k.ort}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Status + Prio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                {Object.entries(PROJEKT_PHASEN).map(([key, phase]) => (
                  <option key={key} value={key}>{phase.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
              <select value={prioritaet} onChange={e => setPrioritaet(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="niedrig">Niedrig</option>
                <option value="normal">Normal</option>
                <option value="hoch">Hoch</option>
                <option value="dringend">Dringend</option>
              </select>
            </div>
          </div>

          {/* Angebotswert */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Angebotswert (EUR)</label>
            <input
              type="number" value={angebots_wert} onChange={e => setAngebotswert(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00" min="0" step="0.01"
            />
          </div>

          {/* Notizen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea
              value={notizen} onChange={e => setNotizen(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optionale Notizen..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={!titel.trim() || saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Wird erstellt...' : 'Projekt erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
