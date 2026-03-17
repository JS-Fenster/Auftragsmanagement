import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Euro, TrendingUp, TrendingDown, AlertTriangle, Search, Filter, X,
  RefreshCw, FileText, Download, ArrowUpRight, ArrowDownLeft, Clock
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

function daysOverdue(dateStr) {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

// -- Sub-Components --------------------------------------------------------

function KpiCard({ label, value, subtitle, icon: Icon, color, trend }) {
  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle && (
        <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={12} className="text-success" />}
          {trend === 'down' && <TrendingDown size={12} className="text-red-500" />}
          {subtitle}
        </p>
      )}
    </div>
  )
}

function MahnstufeLabel({ stufe }) {
  if (!stufe || stufe === 0) return null
  const colors = { 1: '#F59E0B', 2: '#F97316', 3: '#DC2626' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: colors[stufe] || '#DC2626' }}
    >
      Mahnung {stufe}
    </span>
  )
}

// -- Main Component --------------------------------------------------------

export default function Finanzen() {
  const [tab, setTab] = useState('ausgang')
  const [rechnungenAR, setRechnungenAR] = useState([])
  const [offeneAR, setOffeneAR] = useState([])
  const [offeneER, setOffeneER] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [arRes, kundenRes, raRes, offArRes, offErRes] = await Promise.all([
        // Ausgangsrechnungen
        supabase
          .from('erp_rechnungen')
          .select('*')
          .order('datum', { ascending: false })
          .limit(500),
        // Kunden fuer Lookup
        supabase
          .from('erp_kunden')
          .select('code, firma1, name, ort'),
        // Rechnungsausgang (Zahlungsstatus)
        supabase
          .from('erp_ra')
          .select('r_code, r_betrag, bez_summe, mahnstufe, faellig_datum'),
        // Offene Ausgangsrechnungen (View)
        supabase
          .from('v_offene_ausgangsrechnungen')
          .select('*')
          .order('faellig_am', { ascending: true }),
        // Offene Eingangsrechnungen (View)
        supabase
          .from('v_offene_eingangsrechnungen')
          .select('*')
          .order('faellig_am', { ascending: true }),
      ])

      // JS-Join: Kunden + RA auf Rechnungen mappen
      const kundenMap = Object.fromEntries((kundenRes.data || []).map(k => [k.code, k]))
      const raMap = {}
      ;(raRes.data || []).forEach(ra => { raMap[ra.r_code] = ra })

      const enriched = (arRes.data || []).map(r => ({
        ...r,
        _kunde: kundenMap[r.kunden_code] || null,
        _ra: raMap[r.code] || null,
      }))

      setRechnungenAR(enriched)
      if (offArRes.data) setOffeneAR(offArRes.data)
      if (offErRes.data) setOffeneER(offErRes.data)
    } catch (err) {
      console.error('Finanzen loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // -- KPIs
  const kpis = useMemo(() => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth()

    // Umsatz dieses Jahr
    const umsatzJahr = rechnungenAR
      .filter(r => r.datum && new Date(r.datum).getFullYear() === thisYear)
      .reduce((sum, r) => sum + (r.bruttowert || r.wert || 0), 0)

    // Umsatz diesen Monat
    const umsatzMonat = rechnungenAR
      .filter(r => {
        if (!r.datum) return false
        const d = new Date(r.datum)
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth
      })
      .reduce((sum, r) => sum + (r.bruttowert || r.wert || 0), 0)

    // Offene Posten AR
    const offenePostenAR = offeneAR.reduce((sum, r) => sum + (r.offener_betrag || 0), 0)
    const ueberfaelligAR = offeneAR.filter(r => r.ueberfaellig_tage > 0).length

    // Offene Posten ER
    const offenePostenER = offeneER.reduce((sum, r) => sum + (r.offener_betrag || 0), 0)
    const skontoMoeglich = offeneER.reduce((sum, r) => sum + (r.skonto_moeglich || 0), 0)

    return { umsatzJahr, umsatzMonat, offenePostenAR, ueberfaelligAR, offenePostenER, skontoMoeglich }
  }, [rechnungenAR, offeneAR, offeneER])

  // -- Filter
  const filteredAR = useMemo(() => {
    if (!searchTerm) return rechnungenAR
    const term = searchTerm.toLowerCase()
    return rechnungenAR.filter(r =>
      String(r.nummer).includes(term) ||
      (r._kunde?.firma1 || '').toLowerCase().includes(term) ||
      (r._kunde?.name || '').toLowerCase().includes(term) ||
      (r.notiz || '').toLowerCase().includes(term)
    )
  }, [rechnungenAR, searchTerm])

  const filteredOffeneAR = useMemo(() => {
    if (!searchTerm) return offeneAR
    const term = searchTerm.toLowerCase()
    return offeneAR.filter(r =>
      (r.rechnung_nr || '').toLowerCase().includes(term) ||
      (r.kunde_firma || '').toLowerCase().includes(term) ||
      (r.kunde_name || '').toLowerCase().includes(term)
    )
  }, [offeneAR, searchTerm])

  const filteredOffeneER = useMemo(() => {
    if (!searchTerm) return offeneER
    const term = searchTerm.toLowerCase()
    return offeneER.filter(r =>
      (r.rechnung_nr || '').toLowerCase().includes(term) ||
      (r.lieferant || '').toLowerCase().includes(term)
    )
  }, [offeneER, searchTerm])

  // -- DATEV CSV Export
  const exportDATEV = useCallback(() => {
    const rows = rechnungenAR
      .filter(r => r.datum && new Date(r.datum).getFullYear() === new Date().getFullYear())
      .map(r => {
        const ra = r._ra
        return [
          r.nummer,
          r.datum,
          (r.bruttowert || r.wert || 0).toFixed(2).replace('.', ','),
          (r._kunde?.firma1 || r._kunde?.name || '').replace(/;/g, ','),
          r.kunden_code,
          ra?.bez_summe != null ? ra.bez_summe.toFixed(2).replace('.', ',') : '',
          ra?.mahnstufe || 0,
          r.zahlbar_bis || '',
        ].join(';')
      })

    const header = 'Rechnungsnummer;Datum;Brutto;Kunde;Kundennummer;Bezahlt;Mahnstufe;Faellig'
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DATEV_Rechnungen_${new Date().getFullYear()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [rechnungenAR])

  // -- Render
  const tabs = [
    { key: 'ausgang', label: 'Ausgangsrechnungen', icon: ArrowUpRight, count: rechnungenAR.length },
    { key: 'offenAR', label: 'Offene Posten AR', icon: Clock, count: offeneAR.length },
    { key: 'offenER', label: 'Offene Posten ER', icon: ArrowDownLeft, count: offeneER.length },
  ]

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-text-muted">
        <RefreshCw size={20} className="animate-spin" />
        <span>Finanzdaten werden geladen...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-main">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Finanzen</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportDATEV}
              className="flex items-center gap-2 px-4 py-2 border border-border-default rounded-lg hover:bg-surface-hover text-sm text-text-secondary"
            >
              <Download size={16} /> DATEV Export
            </button>
            <button onClick={loadData} className="p-2 text-text-muted hover:text-text-secondary rounded-lg hover:bg-surface-card">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Umsatz Jahr"
            value={formatCurrency(kpis.umsatzJahr)}
            subtitle={`${formatCurrency(kpis.umsatzMonat)} diesen Monat`}
            icon={TrendingUp}
            color="#10B981"
          />
          <KpiCard
            label="Offene Posten AR"
            value={formatCurrency(kpis.offenePostenAR)}
            subtitle={kpis.ueberfaelligAR > 0 ? `${kpis.ueberfaelligAR} ueberfaellig` : 'Alles im Zeitplan'}
            icon={ArrowUpRight}
            color="#3B82F6"
            trend={kpis.ueberfaelligAR > 0 ? 'down' : undefined}
          />
          <KpiCard
            label="Offene Posten ER"
            value={formatCurrency(kpis.offenePostenER)}
            subtitle={kpis.skontoMoeglich > 0 ? `${formatCurrency(kpis.skontoMoeglich)} Skonto moeglich` : 'Kein Skonto offen'}
            icon={ArrowDownLeft}
            color="#F59E0B"
          />
          <KpiCard
            label="Rechnungen gesamt"
            value={rechnungenAR.length}
            subtitle={`${offeneAR.length} AR + ${offeneER.length} ER offen`}
            icon={FileText}
            color="#8B5CF6"
          />
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Suche nach Rechnungsnr., Kunde, Lieferant..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X size={14} /> Zuruecksetzen
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

        {/* Table: Ausgangsrechnungen */}
        {tab === 'ausgang' && (
          <div className="bg-surface-card rounded-lg shadow-sm border overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-main">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Re-Nr.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Kunde</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Netto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Brutto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Faellig</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Bezahlt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAR.map(r => {
                  const ra = r._ra
                  const bezahlt = ra?.bez_summe || 0
                  const betrag = ra?.r_betrag || r.bruttowert || r.wert || 0
                  const offen = betrag - bezahlt
                  const istBezahlt = offen <= 0.01
                  const istUeberfaellig = !istBezahlt && ra?.faellig_datum && daysOverdue(ra.faellig_datum) > 0

                  return (
                    <tr key={r.code} className="hover:bg-surface-main transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-text-secondary">{r.nummer}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(r.datum)}</td>
                      <td className="px-4 py-3 text-sm text-text-primary font-medium truncate max-w-[250px]">
                        {r._kunde?.firma1 || r._kunde?.name || `Kunde ${r.kunden_code}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary text-right">{formatCurrency(r.wert)}</td>
                      <td className="px-4 py-3 text-sm text-text-primary font-medium text-right">{formatCurrency(r.bruttowert)}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(ra?.faellig_datum || r.zahlbar_bis)}
                        {istUeberfaellig && (
                          <span className="ml-2 text-xs text-red-500 font-medium">
                            +{daysOverdue(ra.faellig_datum)}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(bezahlt)}</td>
                      <td className="px-4 py-3">
                        {istBezahlt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Bezahlt
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              istUeberfaellig ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {formatCurrency(offen)} offen
                            </span>
                            <MahnstufeLabel stufe={ra?.mahnstufe} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredAR.length === 0 && (
              <div className="text-center py-10 text-text-muted text-sm">Keine Rechnungen gefunden</div>
            )}
          </div>
        )}

        {/* Table: Offene Posten AR */}
        {tab === 'offenAR' && (
          <div className="bg-surface-card rounded-lg shadow-sm border overflow-x-auto">
            {filteredOffeneAR.length > 0 && (
              <div className="px-4 py-3 border-b bg-red-50 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm font-medium text-red-700">
                  {filteredOffeneAR.filter(r => r.ueberfaellig_tage > 0).length} ueberfaellige Rechnungen,
                  Summe: {formatCurrency(filteredOffeneAR.filter(r => r.ueberfaellig_tage > 0).reduce((s, r) => s + (r.offener_betrag || 0), 0))}
                </span>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-main">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Re-Nr.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Kunde</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Brutto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Offen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Faellig</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Ueberfaellig</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOffeneAR.map(r => (
                  <tr key={r.id} className={`hover:bg-surface-main transition-colors ${r.ueberfaellig_tage > 0 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-sm font-mono text-text-secondary">{r.rechnung_nr || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(r.rechnung_datum)}</td>
                    <td className="px-4 py-3 text-sm text-text-primary font-medium truncate max-w-[250px]">
                      {r.kunde_firma || r.kunde_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right">{formatCurrency(r.summe_brutto)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-right" style={{ color: r.ueberfaellig_tage > 0 ? '#DC2626' : '#F59E0B' }}>
                      {formatCurrency(r.offener_betrag)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(r.faellig_am)}</td>
                    <td className="px-4 py-3">
                      {r.ueberfaellig_tage > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          {r.ueberfaellig_tage} Tage
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Im Zeitplan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOffeneAR.length === 0 && (
              <div className="text-center py-10 text-text-muted text-sm">Keine offenen Ausgangsrechnungen</div>
            )}
          </div>
        )}

        {/* Table: Offene Posten ER */}
        {tab === 'offenER' && (
          <div className="bg-surface-card rounded-lg shadow-sm border overflow-x-auto">
            {offeneER.some(r => r.skonto_moeglich > 0) && (
              <div className="px-4 py-3 border-b bg-green-50 flex items-center gap-2">
                <Euro size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  {formatCurrency(offeneER.reduce((s, r) => s + (r.skonto_moeglich || 0), 0))} Skonto moeglich — jetzt zahlen und sparen!
                </span>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-main">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Re-Nr.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Lieferant</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Brutto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Offen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Faellig</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Skonto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOffeneER.map(r => (
                  <tr key={r.id} className="hover:bg-surface-main transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-text-secondary">{r.rechnung_nr || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(r.rechnung_datum)}</td>
                    <td className="px-4 py-3 text-sm text-text-primary font-medium truncate max-w-[250px]">
                      {r.lieferant || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right">{formatCurrency(r.summe_brutto)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-amber-600">
                      {formatCurrency(r.offener_betrag)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(r.faellig_am)}</td>
                    <td className="px-4 py-3">
                      {r.skonto_moeglich > 0 ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {formatCurrency(r.skonto_moeglich)} ({r.skonto_prozent}%)
                          </span>
                          <span className="text-xs text-text-muted ml-1">bis {formatDate(r.skonto_bis)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOffeneER.length === 0 && (
              <div className="text-center py-10 text-text-muted text-sm">Keine offenen Eingangsrechnungen</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
