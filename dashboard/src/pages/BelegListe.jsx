/**
 * BelegListe — Uebersichtsseite fuer alle Belege
 *
 * Route: /belege
 * Features: KPI-Cards, Filter, Tabelle, Schnellaktionen
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, Search, Filter, Euro, Clock, TrendingUp,
  ChevronRight, ArrowUpRight, ArrowDownRight, Loader2, ArrowRightLeft
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BelegStatusBadge, BelegTypBadge } from './belege/BelegStatusBadge'
import { BELEG_TYPEN, BELEG_STATUS, BELEG_KONVERSIONEN, formatEuro } from './belege/constants'

const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-'

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

function KonvertierenButton({ beleg, navigate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const erlaubte = BELEG_KONVERSIONEN[beleg.beleg_typ] || []

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (erlaubte.length === 0) return <ChevronRight className="w-4 h-4 text-text-muted" />

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        className="p-1 rounded hover:bg-surface-hover transition-colors"
        title="Konvertieren"
      >
        <ArrowRightLeft className="w-4 h-4 text-text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-surface-card rounded-lg shadow-lg border border-border-default py-1 z-50">
          {erlaubte.map(targetTyp => (
            <button
              key={targetTyp}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                navigate(`/belege/neu?from=${beleg.id}`)
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-main transition-colors flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: BELEG_TYPEN[targetTyp]?.color }}
              />
              {BELEG_TYPEN[targetTyp]?.label || targetTyp}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BelegListe() {
  const navigate = useNavigate()
  const [belege, setBelege] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTyp, setFilterTyp] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const loadBelege = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('belege')
      .select('*, projekte!projekt_id(id, projekt_name, projekt_nummer)')
      .order('created_at', { ascending: false })
      .limit(500)

    if (!error) setBelege(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadBelege() }, [loadBelege])

  // ── KPIs ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const offeneAngebote = belege.filter(b => b.beleg_typ === 'angebot' && !['abgelehnt', 'storniert'].includes(b.status))
    const offeneAngeboteSumme = offeneAngebote.reduce((s, b) => s + (parseFloat(b.brutto_summe) || 0), 0)

    const unbezahlteRechnungen = belege.filter(b =>
      ['rechnung', 'abschlagsrechnung', 'schlussrechnung'].includes(b.beleg_typ) &&
      !['bezahlt', 'storniert'].includes(b.status)
    )
    const unbezahlteSumme = unbezahlteRechnungen.reduce((s, b) => s + (parseFloat(b.brutto_summe) || 0), 0)

    const now = new Date()
    const monatStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const umsatzMonat = belege
      .filter(b =>
        ['rechnung', 'abschlagsrechnung', 'schlussrechnung'].includes(b.beleg_typ) &&
        b.status === 'bezahlt' &&
        b.datum >= monatStart
      )
      .reduce((s, b) => s + (parseFloat(b.brutto_summe) || 0), 0)

    return { offeneAngebote, offeneAngeboteSumme, unbezahlteRechnungen, unbezahlteSumme, umsatzMonat }
  }, [belege])

  // ── Filter ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return belege.filter(b => {
      if (filterTyp && b.beleg_typ !== filterTyp) return false
      if (filterStatus && b.status !== filterStatus) return false
      if (search) {
        const s = search.toLowerCase()
        const haystack = [
          b.beleg_nummer, b.empfaenger_firma, b.empfaenger_name,
          b.betreff, b.projekte?.projekt_name, b.projekte?.projekt_nummer
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(s)) return false
      }
      return true
    })
  }, [belege, filterTyp, filterStatus, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-brand" />
          <h1 className="text-xl font-bold text-text-primary">Belege</h1>
          <span className="text-sm text-text-muted">({belege.length})</span>
        </div>
        <button
          onClick={() => navigate('/belege/neu')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-btn-primary text-white text-sm font-medium rounded-lg hover:bg-btn-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Neuer Beleg
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Offene Angebote"
          value={kpis.offeneAngebote.length}
          subtitle={formatEuro(kpis.offeneAngeboteSumme)}
          icon={FileText}
          color="#8B5CF6"
        />
        <KpiCard
          label="Unbezahlte Rechnungen"
          value={kpis.unbezahlteRechnungen.length}
          subtitle={formatEuro(kpis.unbezahlteSumme)}
          icon={Clock}
          color="#F59E0B"
        />
        <KpiCard
          label="Umsatz diesen Monat"
          value={formatEuro(kpis.umsatzMonat)}
          subtitle="Bezahlte Rechnungen"
          icon={TrendingUp}
          color="#10B981"
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche (Nummer, Kunde, Betreff...)"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          value={filterTyp}
          onChange={e => setFilterTyp(e.target.value)}
          className="rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Alle Typen</option>
          {Object.entries(BELEG_TYPEN).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Alle Status</option>
          {Object.entries(BELEG_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabelle */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide bg-surface-main">
                <th className="px-4 py-3">Beleg-Nr.</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Projekt</th>
                <th className="px-4 py-3 text-right">Betrag</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                    {search || filterTyp || filterStatus
                      ? 'Keine Belege gefunden.'
                      : 'Noch keine Belege vorhanden. Erstelle deinen ersten Beleg.'}
                  </td>
                </tr>
              ) : (
                filtered.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/belege/${b.id}`)}
                    className="border-b border-gray-50 hover:bg-surface-main cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-brand">{b.beleg_nummer}</td>
                    <td className="px-4 py-3"><BelegTypBadge typ={b.beleg_typ} /></td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(b.datum)}</td>
                    <td className="px-4 py-3">
                      <div>
                        {b.empfaenger_firma && <span className="font-medium">{b.empfaenger_firma}</span>}
                        {b.empfaenger_name && <span className="text-text-muted ml-1">({b.empfaenger_name})</span>}
                        {!b.empfaenger_firma && !b.empfaenger_name && <span className="text-text-muted">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {b.projekte?.projekt_nummer || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatEuro(b.brutto_summe)}
                    </td>
                    <td className="px-4 py-3"><BelegStatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <KonvertierenButton beleg={b} navigate={navigate} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
