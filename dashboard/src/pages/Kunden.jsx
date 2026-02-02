import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { AUFTRAG_STATUS } from '../lib/constants'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Search, User, MapPin, Phone, Mail, Building2, ChevronDown, ChevronRight, X, FileText, ClipboardList, Receipt, Briefcase, Package, AlertTriangle, Wrench } from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '–'
  try { return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de }) }
  catch { return '–' }
}

function formatEur(val) {
  if (val == null) return '–'
  return Number(val).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function SourceBadge({ source }) {
  const isErp = source === 'erp'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: isErp ? '#EFF6FF' : '#F0FDF4',
        color: isErp ? '#1E40AF' : '#166534',
      }}
    >
      {isErp ? 'ERP' : 'Manuell'}
    </span>
  )
}

function StatusBadge({ status }) {
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

// ─── Expandable Section ────────────────────────────────────

function ExpandableSection({ title, icon: Icon, count, color, defaultOpen, loading: extLoading, data: extData, renderItems }) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <div className="border-t border-gray-100">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-sm text-gray-700">{title}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
          style={{ backgroundColor: (color || '#6B7280') + '18', color: color || '#6B7280' }}
        >
          {extLoading ? '...' : (count ?? extData?.length ?? 0)}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {extLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Laden...</span>
            </div>
          ) : extData && extData.length > 0 ? (
            renderItems(extData)
          ) : (
            <p className="text-sm text-gray-400 py-2">Keine Einträge</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Kunde Detail Modal ────────────────────────────────────

function KundeDetailModal({ kunde, onClose }) {
  if (!kunde) return null

  const isErp = kunde._source === 'erp'
  const displayName = kunde.firma1 || [kunde.name, kunde.vorname].filter(Boolean).join(' ') || '–'

  const [loading, setLoading] = useState(true)
  const [projekte, setProjekte] = useState([])
  const [angebote, setAngebote] = useState([])
  const [rechnungen, setRechnungen] = useState([])
  const [offenePosten, setOffenePosten] = useState([])
  const [bestellungen, setBestellungen] = useState([])
  const [auftraege, setAuftraege] = useState([])

  // Load all related data on mount
  useEffect(() => {
    if (!isErp || !kunde.code) { setLoading(false); return }
    const code = kunde.code

    Promise.all([
      supabase.from('erp_projekte')
        .select('code, nummer, name, datum, projekt_status, notiz')
        .eq('kunden_code', code)
        .order('datum', { ascending: false }).limit(50),
      supabase.from('erp_angebote')
        .select('code, nummer, datum, wert, auftrags_datum, auftrags_nummer, projekt_code, notiz')
        .eq('kunden_code', code)
        .order('datum', { ascending: false }).limit(50),
      supabase.from('erp_rechnungen')
        .select('code, nummer, datum, wert, bruttowert, zahlbar_bis, zahlungsfrist, projekt_code')
        .eq('kunden_code', code)
        .order('datum', { ascending: false }).limit(50),
      supabase.from('erp_bestellungen')
        .select('code, nummer, datum, wert, projekt_code, lieferant_code')
        .eq('projekt_code', code) // will be joined via projekte
        .order('datum', { ascending: false }).limit(50),
      supabase.from('auftraege')
        .select('id, status, prioritaet, beschreibung, erstellt_am, adresse_strasse, adresse_ort, termin_sv1, termin_sv2, auftragstyp')
        .eq('erp_kunde_id', code)
        .order('erstellt_am', { ascending: false }),
    ]).then(async ([projRes, angRes, rechRes, , auftrRes]) => {
      const proj = projRes.data || []
      setProjekte(proj)
      setAngebote(angRes.data || [])

      // Rechnungen + offene Posten
      const rech = rechRes.data || []
      setRechnungen(rech)
      if (rech.length > 0) {
        const rechCodes = rech.map(r => r.code)
        const { data: raData } = await supabase.from('erp_ra')
          .select('code, r_code, r_nummer, r_betrag, bez_summe, mahnstufe, faellig_datum')
          .in('r_code', rechCodes)
        setOffenePosten(raData || [])
      }

      // Bestellungen via Projekt-Codes
      const projCodes = proj.map(p => p.code)
      if (projCodes.length > 0) {
        const { data: bestData } = await supabase.from('erp_bestellungen')
          .select('code, nummer, datum, wert, projekt_code, lieferant_code')
          .in('projekt_code', projCodes)
          .order('datum', { ascending: false }).limit(50)
        setBestellungen(bestData || [])
      }

      setAuftraege(auftrRes.data || [])
      setLoading(false)
    })
  }, [kunde.code, isErp])

  // Build lookup maps
  const projektMap = Object.fromEntries(projekte.map(p => [p.code, p]))
  const raByRechnung = {}
  offenePosten.forEach(ra => {
    raByRechnung[ra.r_code] = ra
  })

  // Summary stats
  const totalAngebotswert = angebote.reduce((s, a) => s + (Number(a.wert) || 0), 0)
  const totalRechnungswert = rechnungen.reduce((s, r) => s + (Number(r.bruttowert || r.wert) || 0), 0)
  const offeneRechnungen = rechnungen.filter(r => {
    const ra = raByRechnung[r.code]
    return ra && (Number(ra.r_betrag) || 0) > (Number(ra.bez_summe) || 0)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between rounded-t-xl z-10">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <SourceBadge source={kunde._source} />
            </div>
            {isErp && kunde.code && (
              <p className="text-sm text-gray-500 mt-0.5">Kundennr. {kunde.code}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Contact Info */}
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {kunde.firma1 && (
            <div className="flex items-center gap-2 text-gray-700">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{kunde.firma1}{kunde.firma2 ? ` / ${kunde.firma2}` : ''}</span>
            </div>
          )}
          {(kunde.name || kunde.vorname) && (
            <div className="flex items-center gap-2 text-gray-700">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{[kunde.vorname, kunde.name].filter(Boolean).join(' ')}</span>
            </div>
          )}
          {(kunde.strasse || kunde.plz || kunde.ort) && (
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{[kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {kunde.telefon && (
            <div className="flex items-center gap-2 text-gray-700">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{kunde.telefon}{kunde.mobil ? ` / ${kunde.mobil}` : ''}</span>
            </div>
          )}
          {kunde.email && (
            <div className="flex items-center gap-2 text-gray-700">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{kunde.email}</span>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {isErp && !loading && (
          <div className="px-6 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-600">Projekte</p>
              <p className="text-lg font-bold text-blue-900">{projekte.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <p className="text-xs text-green-600">Angebotswert</p>
              <p className="text-lg font-bold text-green-900">{formatEur(totalAngebotswert)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg px-3 py-2">
              <p className="text-xs text-purple-600">Rechnungen</p>
              <p className="text-lg font-bold text-purple-900">{formatEur(totalRechnungswert)}</p>
            </div>
            {offeneRechnungen.length > 0 ? (
              <div className="bg-red-50 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600">Offen</p>
                <p className="text-lg font-bold text-red-900">{offeneRechnungen.length} Rechnung{offeneRechnungen.length !== 1 ? 'en' : ''}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Offen</p>
                <p className="text-lg font-bold text-gray-400">Keine</p>
              </div>
            )}
          </div>
        )}

        {/* Related Data */}
        {isErp && kunde.code && (
          <div>
            {/* Reparatur-Aufträge (new system) — always on top */}
            <ExpandableSection
              title="Reparatur-Aufträge (Neu)"
              icon={Wrench}
              color="#2563EB"
              defaultOpen={true}
              loading={loading}
              data={auftraege}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={a.status} />
                        <span className="text-gray-700 font-medium truncate">{a.beschreibung || a.auftragstyp || '–'}</span>
                        {a.adresse_ort && <span className="text-gray-400 text-xs">· {a.adresse_ort}</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                        {a.termin_sv1 && <span className="text-blue-600">SV1: {formatDate(a.termin_sv1)}</span>}
                        {a.termin_sv2 && <span className="text-orange-600">SV2: {formatDate(a.termin_sv2)}</span>}
                        <span className="text-gray-400">{formatDate(a.erstellt_am)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            />

            {/* Projekte */}
            <ExpandableSection
              title="Projekte"
              icon={Briefcase}
              color="#8B5CF6"
              defaultOpen={projekte.length > 0 && projekte.length <= 10}
              loading={loading}
              data={projekte}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(p => (
                    <div key={p.code} className="py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{p.nummer}</span>
                          <span className="font-medium text-gray-700 truncate">{p.name}</span>
                        </div>
                        <span className="text-gray-400 text-xs shrink-0 ml-2">{formatDate(p.datum)}</span>
                      </div>
                      {p.notiz && <p className="text-xs text-gray-500 mt-1 ml-16 truncate">{p.notiz}</p>}
                    </div>
                  ))}
                </div>
              )}
            />

            {/* Angebote / Aufträge */}
            <ExpandableSection
              title="Angebote / Aufträge (ERP)"
              icon={ClipboardList}
              color="#10B981"
              loading={loading}
              data={angebote}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(a => {
                    const projekt = projektMap[a.projekt_code]
                    return (
                      <div key={a.code} className="py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.auftrags_datum ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Auftrag</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Angebot</span>
                            )}
                            {a.nummer && <span className="font-mono text-xs text-gray-500">{a.nummer}</span>}
                            {projekt && <span className="text-gray-500 truncate text-xs">· {projekt.nummer}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                            <span className="text-gray-700 font-medium">{formatEur(a.wert)}</span>
                            {a.auftrags_datum && <span className="text-green-600">Beauftragt {formatDate(a.auftrags_datum)}</span>}
                            <span className="text-gray-400">{formatDate(a.datum)}</span>
                          </div>
                        </div>
                        {projekt && <p className="text-xs text-gray-400 mt-0.5 ml-16 truncate">{projekt.name}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            />

            {/* Rechnungen + Offene Posten */}
            <ExpandableSection
              title="Rechnungen"
              icon={Receipt}
              color="#F59E0B"
              count={`${rechnungen.length}${offeneRechnungen.length > 0 ? ` (${offeneRechnungen.length} offen)` : ''}`}
              loading={loading}
              data={rechnungen}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(r => {
                    const ra = raByRechnung[r.code]
                    const istOffen = ra && (Number(ra.r_betrag) || 0) > (Number(ra.bez_summe) || 0)
                    const offenerBetrag = ra ? (Number(ra.r_betrag) || 0) - (Number(ra.bez_summe) || 0) : 0
                    const projekt = projektMap[r.projekt_code]
                    return (
                      <div key={r.code} className={`py-2 px-3 rounded-lg hover:bg-gray-50 text-sm ${istOffen ? 'bg-red-50/50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-gray-500">{r.nummer}</span>
                            {istOffen && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                <AlertTriangle className="w-3 h-3" />
                                Offen {formatEur(offenerBetrag)}
                                {ra.mahnstufe > 0 && ` · Mahnstufe ${ra.mahnstufe}`}
                              </span>
                            )}
                            {projekt && <span className="text-gray-400 text-xs truncate">· {projekt.nummer}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                            <span className="text-gray-700 font-medium">{formatEur(r.bruttowert || r.wert)}</span>
                            {r.zahlbar_bis && <span className={istOffen && new Date(r.zahlbar_bis) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'}>Fällig {formatDate(r.zahlbar_bis)}</span>}
                            <span className="text-gray-400">{formatDate(r.datum)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            />

            {/* Bestellungen */}
            <ExpandableSection
              title="Bestellungen (an Lieferanten)"
              icon={Package}
              color="#6366F1"
              loading={loading}
              data={bestellungen}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(b => {
                    const projekt = projektMap[b.projekt_code]
                    return (
                      <div key={b.code} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-gray-500">{b.nummer}</span>
                          {projekt && <span className="text-gray-500 text-xs truncate">· {projekt.nummer} – {projekt.name}</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                          <span className="text-gray-700 font-medium">{formatEur(b.wert)}</span>
                          <span className="text-gray-400">{formatDate(b.datum)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────

export default function Kunden() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedKunde, setSelectedKunde] = useState(null)
  const timerRef = useRef(null)

  // Debounce search input
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedTerm(searchTerm), 400)
    return () => clearTimeout(timerRef.current)
  }, [searchTerm])

  // Fetch on debounced term change
  useEffect(() => {
    if (!debouncedTerm || debouncedTerm.length < 2) {
      setResults([])
      return
    }
    let cancelled = false

    const search = async () => {
      setLoading(true)
      const term = `%${debouncedTerm}%`

      const [erpRes, manRes] = await Promise.all([
        supabase
          .from('erp_kunden')
          .select('code, firma1, firma2, name, strasse, plz, ort, telefon, mobil, email')
          .or(`firma1.ilike.${term},firma2.ilike.${term},name.ilike.${term},ort.ilike.${term},plz.ilike.${term},telefon.ilike.${term}`)
          .limit(100),
        supabase
          .from('manuelle_kunden')
          .select('id, firma1, name, vorname, strasse, plz, ort, telefon, mobil, email')
          .or(`firma1.ilike.${term},name.ilike.${term},vorname.ilike.${term},ort.ilike.${term},plz.ilike.${term},telefon.ilike.${term}`)
          .limit(100),
      ])

      if (cancelled) return

      const erp = (erpRes.data || []).map(k => ({ ...k, _source: 'erp', _id: `erp-${k.code}` }))
      const man = (manRes.data || []).map(k => ({ ...k, _source: 'manuell', _id: `man-${k.id}` }))

      setResults([...erp, ...man])
      setLoading(false)
    }

    search()
    return () => { cancelled = true }
  }, [debouncedTerm])

  // Close modal on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedKunde(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
        <p className="text-gray-500 mt-1">ERP- und manuelle Kunden durchsuchen</p>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-10 bg-white pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Firma, Name, Ort, PLZ oder Telefon suchen... (min. 2 Zeichen)"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Suche...</span>
        </div>
      ) : debouncedTerm.length < 2 ? (
        <div className="text-center py-20 text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Suchbegriff eingeben um Kunden zu finden</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Kunden gefunden für &ldquo;{debouncedTerm}&rdquo;</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">{results.length} Ergebnis{results.length !== 1 ? 'se' : ''}</p>
          <div className="grid gap-3">
            {results.map(k => {
              const displayName = k.firma1 || [k.vorname, k.name].filter(Boolean).join(' ') || '–'
              const adresse = [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')

              return (
                <div
                  key={k._id}
                  onClick={() => setSelectedKunde(k)}
                  className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 truncate">{displayName}</span>
                        <SourceBadge source={k._source} />
                      </div>
                      {k.firma2 && <p className="text-sm text-gray-500 truncate">{k.firma2}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                        {adresse && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {adresse}
                          </span>
                        )}
                        {k.telefon && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {k.telefon}
                          </span>
                        )}
                        {k.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {k.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedKunde && (
        <KundeDetailModal kunde={selectedKunde} onClose={() => setSelectedKunde(null)} />
      )}
    </div>
  )
}
