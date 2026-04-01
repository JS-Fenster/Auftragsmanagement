import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Plus } from 'lucide-react'
import { useDebounce, kundeName } from './auftraege/auftragHelpers'
import AuftraegeListe from './auftraege/AuftraegeListe'
import AuftragDetailModal from './auftraege/AuftragDetailModal'
import NeuAuftragModal from './auftraege/NeuAuftragModal'

export default function Auftraege() {
  const [auftraege, setAuftraege] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [activeStatuses, setActiveStatuses] = useState([])
  const [priorityFilter, setPriorityFilter] = useState('')

  // Modals
  const [selectedAuftrag, setSelectedAuftrag] = useState(null)
  const [showNeu, setShowNeu] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('v_auftraege')
      .select('*')
      .order('erstellt_am', { ascending: false })
      .then(({ data, error: err }) => {
        if (!cancelled) {
          if (err) { setError(err.message) } else { setAuftraege(data || []); setError(null) }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    setSelectedAuftrag(null)
  }, [])

  const debouncedSearch = useDebounce(search, 200)

  const filtered = useMemo(() => {
    let list = [...auftraege]

    // Search - inkl. Auftragsnummer
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(a =>
        (a.auftragsnummer || '').toLowerCase().includes(q) ||
        (a.beschreibung || '').toLowerCase().includes(q) ||
        (a.adresse_strasse || '').toLowerCase().includes(q) ||
        (a.adresse_ort || '').toLowerCase().includes(q) ||
        (a.neukunde_name || '').toLowerCase().includes(q) ||
        (a.kunde_firma || '').toLowerCase().includes(q) ||
        kundeName(a).toLowerCase().includes(q)
      )
    }

    // Status filter
    if (activeStatuses.length > 0) {
      list = list.filter(a => activeStatuses.includes(a.status))
    }

    // Priority filter
    if (priorityFilter) {
      list = list.filter(a => a.prioritaet === priorityFilter)
    }

    // Sort: priority DESC, ist_zu_lange_offen DESC, created_at ASC
    const prioOrder = { HOCH: 0, MITTEL: 1, NORMAL: 2 }
    list.sort((a, b) => {
      const pa = prioOrder[a.prioritaet] ?? 2
      const pb = prioOrder[b.prioritaet] ?? 2
      if (pa !== pb) return pa - pb
      const oa = a.ist_zu_lange_offen ? 0 : 1
      const ob = b.ist_zu_lange_offen ? 0 : 1
      if (oa !== ob) return oa - ob
      return new Date(a.erstellt_am) - new Date(b.erstellt_am)
    })

    return list
  }, [auftraege, debouncedSearch, activeStatuses, priorityFilter])

  const toggleStatus = (s) => {
    setActiveStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{`Auftr\u00e4ge`}</h1>
          <p className="text-sm text-text-secondary mt-0.5">{filtered.length} von {auftraege.length} {`Auftr\u00e4gen`}</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-btn-primary text-white text-sm font-medium rounded-lg hover:bg-btn-primary-hover"
          onClick={() => setShowNeu(true)}
        >
          <Plus className="w-4 h-4" /> Neuer Auftrag
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <p className="text-sm text-text-secondary py-8 text-center">{`Lade Auftr\u00e4ge...`}</p>}
      {error && <p className="text-sm text-red-600 py-4 text-center">{error}</p>}

      {/* List with filters and table */}
      {!loading && !error && (
        <AuftraegeListe
          filtered={filtered}
          total={auftraege.length}
          search={search}
          setSearch={setSearch}
          activeStatuses={activeStatuses}
          toggleStatus={toggleStatus}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          onSelectAuftrag={setSelectedAuftrag}
        />
      )}

      {/* Modals */}
      {selectedAuftrag && (
        <AuftragDetailModal
          auftrag={selectedAuftrag}
          onClose={() => setSelectedAuftrag(null)}
          onRefresh={refresh}
        />
      )}
      {showNeu && (
        <NeuAuftragModal
          onClose={() => setShowNeu(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
