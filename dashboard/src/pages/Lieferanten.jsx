/**
 * Lieferanten — Uebersicht der ERP-Lieferanten mit Bestellungs-Zuordnung
 *
 * Datenquelle: erp_lieferanten (synced aus W4A)
 * Pattern: KPI-Cards + Suche + Tabelle (wie Bestellungen.jsx)
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Truck, Search, X, RefreshCw, Package, Users, MapPin, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

// -- Helpers -------------------------------------------------------------------

function formatCurrency(val) {
  if (val == null) return '-'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val)
}

// -- Sub-Components -----------------------------------------------------------

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

// -- Main Component -----------------------------------------------------------

export default function Lieferanten() {
  const [lieferanten, setLieferanten] = useState([])
  const [bestellungen, setBestellungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [liefRes, bestRes] = await Promise.all([
        supabase.from('erp_lieferanten').select('*').order('firma1', { ascending: true }),
        supabase.from('projekt_bestellungen').select('lieferant, status, bestell_wert').not('status', 'eq', 'storniert'),
      ])
      if (liefRes.data) setLieferanten(liefRes.data)
      if (bestRes.data) setBestellungen(bestRes.data)
    } catch (err) {
      console.error('Lieferanten loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Bestellungen pro Lieferant (Code-basiert)
  const bestMap = useMemo(() => {
    const map = {}
    bestellungen.forEach(b => {
      const key = b.lieferant || ''
      if (!map[key]) map[key] = { count: 0, wert: 0, aktiv: 0 }
      map[key].count++
      map[key].wert += (b.bestell_wert || 0)
      if (!['geliefert', 'storniert'].includes(b.status)) map[key].aktiv++
    })
    return map
  }, [bestellungen])

  // KPIs
  const kpis = useMemo(() => {
    const aktiveBestellungen = bestellungen.filter(b => !['geliefert', 'storniert'].includes(b.status)).length
    const gesamtVolumen = bestellungen.reduce((sum, b) => sum + (b.bestell_wert || 0), 0)
    return {
      anzahl: lieferanten.length,
      aktiveBestellungen,
      gesamtVolumen,
    }
  }, [lieferanten, bestellungen])

  // Filter
  const filtered = useMemo(() => {
    if (!searchTerm) return lieferanten
    const term = searchTerm.toLowerCase()
    return lieferanten.filter(l =>
      (l.firma1 || '').toLowerCase().includes(term) ||
      (l.ort || '').toLowerCase().includes(term) ||
      (l.code || '').toLowerCase().includes(term) ||
      (l.plz || '').includes(term)
    )
  }, [lieferanten, searchTerm])

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-text-muted">
        <RefreshCw size={20} className="animate-spin" />
        <span>Lieferanten werden geladen...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-main">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Truck size={24} /> Lieferanten
          </h1>
          <button onClick={loadData} className="p-2 text-text-muted hover:text-text-secondary rounded-lg hover:bg-surface-card">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <KpiCard
            label="Lieferanten"
            value={kpis.anzahl}
            subtitle="Gesamt im System"
            icon={Users}
            color="#3B82F6"
          />
          <KpiCard
            label="Aktive Bestellungen"
            value={kpis.aktiveBestellungen}
            subtitle="Offen / in Bearbeitung"
            icon={Package}
            color="#8B5CF6"
          />
          <KpiCard
            label="Bestellvolumen"
            value={formatCurrency(kpis.gesamtVolumen)}
            subtitle="Gesamt (nicht storniert)"
            icon={Truck}
            color="#10B981"
          />
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Suche nach Firma, Ort, Code..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X size={14} /> Zurücksetzen
            </button>
          )}
          <span className="text-sm text-text-muted self-center">{filtered.length} Ergebnis{filtered.length !== 1 ? 'se' : ''}</span>
        </div>

        {/* Table */}
        <div className="bg-surface-card rounded-lg shadow-sm border overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-main">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Firma</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Ort</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Email</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Bestellungen</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(l => {
                const best = bestMap[l.code] || { count: 0, wert: 0, aktiv: 0 }
                const isExpanded = expandedId === l.code
                return (
                  <tr key={l.code} className="group">
                    <td colSpan={7} className="p-0">
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : l.code)}
                        className="flex items-center cursor-pointer hover:bg-surface-main transition-colors"
                      >
                        <div className="px-4 py-3 text-sm font-mono text-text-secondary w-24 shrink-0">{l.code}</div>
                        <div className="px-4 py-3 text-sm text-text-primary font-medium truncate flex-1 min-w-[200px]">{l.firma1 || '-'}</div>
                        <div className="px-4 py-3 text-sm text-text-secondary w-32 shrink-0">{l.ort || '-'}</div>
                        <div className="px-4 py-3 text-sm text-text-secondary w-36 shrink-0">{l.telefon || '-'}</div>
                        <div className="px-4 py-3 text-sm text-text-secondary truncate w-48 shrink-0">{l.email || '-'}</div>
                        <div className="px-4 py-3 text-sm text-right w-28 shrink-0">
                          {best.count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {best.count}
                            </span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </div>
                        <div className="px-4 py-3 w-10 shrink-0">
                          {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                        </div>
                      </div>
                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="px-6 pb-4 bg-surface-main/50 border-t border-border-default">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3">
                            <div>
                              <span className="text-xs text-text-muted">Firma</span>
                              <p className="text-sm font-medium">{l.firma1}</p>
                              {l.firma2 && <p className="text-sm text-text-secondary">{l.firma2}</p>}
                            </div>
                            <div>
                              <span className="text-xs text-text-muted">Adresse</span>
                              <p className="text-sm">{l.strasse || '-'}</p>
                              <p className="text-sm">{l.plz} {l.ort}</p>
                            </div>
                            <div>
                              <span className="text-xs text-text-muted">Kontakt</span>
                              <p className="text-sm flex items-center gap-1"><Phone size={12} /> {l.telefon || '-'}</p>
                              {l.fax && <p className="text-sm text-text-muted">Fax: {l.fax}</p>}
                              <p className="text-sm flex items-center gap-1"><Mail size={12} /> {l.email || '-'}</p>
                            </div>
                            <div>
                              <span className="text-xs text-text-muted">Bestellungen</span>
                              <p className="text-sm">{best.count} gesamt</p>
                              {best.aktiv > 0 && <p className="text-sm text-purple-600">{best.aktiv} aktiv</p>}
                              <p className="text-sm font-medium">{formatCurrency(best.wert)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-text-muted text-sm">Keine Lieferanten gefunden</div>
          )}
        </div>

      </div>
    </div>
  )
}
