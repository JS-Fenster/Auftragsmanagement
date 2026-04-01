import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Truck, Clock, AlertTriangle, Search, X, RefreshCw,
  CheckCircle, ArrowRight, Calendar
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// -- Helpers ---------------------------------------------------------------

function formatCurrency(val) {
  if (val == null) return '-'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val)
}

function formatDate(d) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '-' }
}

function formatKW(d) {
  if (!d) return ''
  const date = new Date(d)
  const onejan = new Date(date.getFullYear(), 0, 1)
  const week = Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  return `KW ${week}`
}

const DAY_MS = 86400000

// -- Sub-Components --------------------------------------------------------

function KpiCard({ label, value, subtitle, icon: Icon, color }) {
  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
    </div>
  )
}

function BestellStatusBadge({ status }) {
  const styles = {
    bestellt: { bg: '#EFF6FF', text: '#1E40AF', label: 'Bestellt' },
    ab_erhalten: { bg: '#F0FDFA', text: '#115E59', label: 'AB erhalten' },
    in_lieferung: { bg: '#FFFBEB', text: '#92400E', label: 'In Lieferung' },
    geliefert: { bg: '#DCFCE7', text: '#14532D', label: 'Geliefert' },
    storniert: { bg: '#F3F4F6', text: '#374151', label: 'Storniert' },
  }
  const s = styles[status] || styles.bestellt
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

// -- Main Component --------------------------------------------------------

export default function Bestellungen() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('projekt')
  const [projektBest, setProjektBest] = useState([])
  const [erpBest, setErpBest] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pbRes, projRes, ebRes, liefRes] = await Promise.all([
        // Projekt-Bestellungen
        supabase
          .from('projekt_bestellungen')
          .select('*')
          .order('bestell_datum', { ascending: false }),
        // Projekte fuer Lookup
        supabase
          .from('projekte')
          .select('id, titel, projekt_nummer, kontakte!projekte_kontakt_id_fkey(firma1)'),
        // ERP-Bestellungen
        supabase
          .from('erp_bestellungen')
          .select('*')
          .order('datum', { ascending: false })
          .limit(500),
        // Lieferanten fuer Lookup
        supabase
          .from('erp_lieferanten')
          .select('code, firma1, name, ort'),
      ])

      // JS-Joins
      const projMap = Object.fromEntries((projRes.data || []).map(p => [p.id, p]))
      const liefMap = Object.fromEntries((liefRes.data || []).map(l => [l.code, l]))

      const pbEnriched = (pbRes.data || []).map(b => ({
        ...b,
        projekte: projMap[b.projekt_id] || null,
      }))
      const ebEnriched = (ebRes.data || []).map(b => ({
        ...b,
        _lieferant: liefMap[b.lieferant_code] || null,
      }))

      setProjektBest(pbEnriched)
      setErpBest(ebEnriched)
    } catch (err) {
      console.error('Bestellungen loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // -- KPIs
  const kpis = useMemo(() => {
    const now = Date.now()

    // Projekt-Bestellungen KPIs
    const aktiv = projektBest.filter(b => !['geliefert', 'storniert'].includes(b.status))
    const wartendAB = projektBest.filter(b => b.status === 'bestellt' && !b.ab_datum)
    const ueberfaellig = projektBest.filter(b => {
      if (['geliefert', 'storniert'].includes(b.status)) return false
      if (!b.liefertermin_geplant) return false
      return (now - new Date(b.liefertermin_geplant).getTime()) > 0
    })
    const gesamtwert = aktiv.reduce((sum, b) => sum + (b.bestell_wert || 0), 0)

    // ERP-Bestellungen (this year)
    const thisYear = new Date().getFullYear()
    const erpJahr = erpBest
      .filter(b => b.datum && new Date(b.datum).getFullYear() === thisYear)
      .reduce((sum, b) => sum + (b.wert || 0), 0)

    return { aktiv: aktiv.length, wartendAB: wartendAB.length, ueberfaellig: ueberfaellig.length, gesamtwert, erpJahr }
  }, [projektBest, erpBest])

  // -- Filter
  const filteredProjekt = useMemo(() => {
    let data = projektBest
    if (filterStatus) data = data.filter(b => b.status === filterStatus)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      data = data.filter(b =>
        (b.bestell_nummer || '').toLowerCase().includes(term) ||
        (b.lieferant_name || '').toLowerCase().includes(term) ||
        (b.projekte?.titel || '').toLowerCase().includes(term) ||
        (b.projekte?.projekt_nummer || '').toLowerCase().includes(term) ||
        (b.notizen || '').toLowerCase().includes(term)
      )
    }
    return data
  }, [projektBest, filterStatus, searchTerm])

  const filteredErp = useMemo(() => {
    if (!searchTerm) return erpBest
    const term = searchTerm.toLowerCase()
    return erpBest.filter(b =>
      String(b.nummer).includes(term) ||
      (b._lieferant?.firma1 || '').toLowerCase().includes(term) ||
      (b._lieferant?.name || '').toLowerCase().includes(term)
    )
  }, [erpBest, searchTerm])

  // -- Render
  const tabs = [
    { key: 'projekt', label: 'Projekt-Bestellungen', icon: Package, count: projektBest.length },
    { key: 'erp', label: 'ERP-Bestellungen', icon: Truck, count: erpBest.length },
  ]

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-text-muted">
        <RefreshCw size={20} className="animate-spin" />
        <span>Bestellungen werden geladen...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-main">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Bestellungen</h1>
          <button onClick={loadData} className="p-2 text-text-muted hover:text-text-secondary rounded-lg hover:bg-surface-card">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Aktive Bestellungen"
            value={kpis.aktiv}
            subtitle={formatCurrency(kpis.gesamtwert) + ' Gesamtwert'}
            icon={Package}
            color="#3B82F6"
          />
          <KpiCard
            label="Wartend auf AB"
            value={kpis.wartendAB}
            subtitle={kpis.wartendAB > 0 ? 'AB nachfassen!' : 'Alles bestätigt'}
            icon={Clock}
            color="#F59E0B"
          />
          <KpiCard
            label="Überfällig"
            value={kpis.ueberfaellig}
            subtitle={kpis.ueberfaellig > 0 ? 'Lieferant kontaktieren!' : 'Im Zeitplan'}
            icon={AlertTriangle}
            color="#DC2626"
          />
          <KpiCard
            label="ERP-Bestellungen Jahr"
            value={formatCurrency(kpis.erpJahr)}
            subtitle={`${erpBest.filter(b => b.datum && new Date(b.datum).getFullYear() === new Date().getFullYear()).length} Bestellungen`}
            icon={Truck}
            color="#10B981"
          />
        </div>

        {/* Alerts */}
        {kpis.ueberfaellig > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">{kpis.ueberfaellig} Bestellungen überfällig!</p>
              <p className="text-xs text-red-600">Liefertermine überschritten — bitte Lieferanten kontaktieren.</p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Suche nach Bestellnr., Lieferant, Projekt..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {tab === 'projekt' && (
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-surface-card"
            >
              <option value="">Alle Status</option>
              <option value="bestellt">Bestellt</option>
              <option value="ab_erhalten">AB erhalten</option>
              <option value="in_lieferung">In Lieferung</option>
              <option value="geliefert">Geliefert</option>
              <option value="storniert">Storniert</option>
            </select>
          )}
          {(searchTerm || filterStatus) && (
            <button onClick={() => { setSearchTerm(''); setFilterStatus('') }} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X size={14} /> Zurücksetzen
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-surface-card rounded-lg p-1 border border-border-default w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-brand-light text-brand shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <t.icon size={16} />
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-brand text-white' : 'bg-surface-hover text-text-muted'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table: Projekt-Bestellungen */}
        {tab === 'projekt' && (
          <div className="bg-surface-card rounded-lg shadow-sm border overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-main">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Best-Nr.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Projekt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Lieferant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Bestellt am</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">AB</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Liefertermin</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Wert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjekt.map(b => {
                  const now = Date.now()
                  const istUeberfaellig = b.liefertermin_geplant && !['geliefert', 'storniert'].includes(b.status) &&
                    (now - new Date(b.liefertermin_geplant).getTime()) > 0

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-surface-main transition-colors cursor-pointer ${istUeberfaellig ? 'bg-red-50/30' : ''}`}
                      onClick={() => b.projekte?.id && navigate(`/projekte/${b.projekte.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-text-secondary">{b.bestell_nummer || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-text-primary truncate max-w-[200px]">{b.projekte?.titel || '-'}</div>
                        <div className="text-xs text-text-muted">{b.projekte?.projekt_nummer}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{b.lieferant_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(b.bestell_datum)}</td>
                      <td className="px-4 py-3 text-sm">
                        {b.ab_datum ? (
                          <div>
                            <span className="text-text-secondary">{formatDate(b.ab_datum)}</span>
                            {b.ab_nummer && <span className="text-xs text-text-muted ml-1">({b.ab_nummer})</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Ausstehend</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {b.geliefert_am ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle size={14} className="text-green-500" />
                            <span className="text-green-700">{formatDate(b.geliefert_am)}</span>
                          </div>
                        ) : (
                          <div>
                            <span className={istUeberfaellig ? 'text-red-600 font-medium' : 'text-text-secondary'}>
                              {formatDate(b.liefertermin_geplant)}
                            </span>
                            {b.liefertermin_kw && <span className="text-xs text-text-muted ml-1">KW {b.liefertermin_kw}</span>}
                            {istUeberfaellig && (
                              <span className="text-xs text-red-500 ml-1">
                                (+{Math.floor((Date.now() - new Date(b.liefertermin_geplant).getTime()) / DAY_MS)}d)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-text-primary">{formatCurrency(b.bestell_wert)}</td>
                      <td className="px-4 py-3"><BestellStatusBadge status={b.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredProjekt.length === 0 && (
              <div className="text-center py-10 text-text-muted text-sm">Keine Projekt-Bestellungen gefunden</div>
            )}
          </div>
        )}

        {/* Table: ERP-Bestellungen */}
        {tab === 'erp' && (
          <div className="bg-surface-card rounded-lg shadow-sm border overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-main">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Best-Nr.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Lieferant</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Wert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">KW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredErp.map(b => (
                  <tr key={b.code} className="hover:bg-surface-main transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-text-secondary">{b.nummer}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(b.datum)}</td>
                    <td className="px-4 py-3 text-sm text-text-primary font-medium truncate max-w-[300px]">
                      {b._lieferant?.firma1 || b._lieferant?.name || `Lieferant ${b.lieferant_code}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary font-medium text-right">{formatCurrency(b.wert)}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{formatKW(b.datum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredErp.length === 0 && (
              <div className="text-center py-10 text-text-muted text-sm">Keine ERP-Bestellungen gefunden</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
