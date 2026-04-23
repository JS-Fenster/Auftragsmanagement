import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchKontakteIds } from '../lib/search'
import { Search, X, Plus } from 'lucide-react'
import KundenListe from './kunden/KundenListe'
import KontaktDetailModal from './kunden/KontaktDetailModal'
import NeuerKontaktModal from './kunden/NeuerKontaktModal'

// ─── Main Page ─────────────────────────────────────────────

export default function Kunden() {
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedKontaktId, setSelectedKontaktId] = useState(null)
  const [showNeuerKontakt, setShowNeuerKontakt] = useState(false)
  const timerRef = useRef(null)

  // Deep-link: auto-load contact from ?id= parameter
  useEffect(() => {
    const deepLinkId = searchParams.get('id')
    if (!deepLinkId) return

    const loadContact = async () => {
      setLoading(true)
      const { data } = await supabase.from('kontakte')
        .select('id, firma1, firma2, strasse, plz, ort, erp_kunden_code, ist_kunde, ist_lieferant, typ, kontakt_personen!kontakt_id(id, anrede, vorname, nachname, rolle, ist_hauptkontakt, kontakt_details(id, typ, label, wert, ist_primaer))')
        .eq('id', deepLinkId)
        .single()
      if (data) {
        setResults([data])
        setSelectedKontaktId(data.id)
        setSearchTerm(data.firma1 || '')
      }
      setLoading(false)
    }
    loadContact()
  }, [searchParams])

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

      // Zentrale Suche: matchende kontakt_ids holen, dann Full-Select als Batch
      const matchingIds = await searchKontakteIds(debouncedTerm)
      if (cancelled) return

      if (matchingIds.size === 0) {
        setResults([])
        setLoading(false)
        return
      }

      const { data: kontakte } = await supabase.from('kontakte')
        .select('id, firma1, firma2, strasse, plz, ort, erp_kunden_code, ist_kunde, ist_lieferant, typ, kontakt_personen!kontakt_id(id, anrede, vorname, nachname, rolle, ist_hauptkontakt, kontakt_details(id, typ, label, wert, ist_primaer))')
        .in('id', Array.from(matchingIds))
        .limit(200)

      if (cancelled) return
      setResults(kontakte || [])
      setLoading(false)
    }

    search()
    return () => { cancelled = true }
  }, [debouncedTerm])

  // Close modal on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setSelectedKontaktId(null)
        setShowNeuerKontakt(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Kontakte</h1>
          <p className="text-text-secondary mt-1">Kunden und Kontakte durchsuchen</p>
        </div>
        <button onClick={() => setShowNeuerKontakt(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> Neuer Kontakt
        </button>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-10 bg-surface-card pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Firma, Name, Ort, PLZ, Telefon oder E-Mail suchen... (min. 2 Zeichen)"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-default bg-surface-card text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-hover"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <KundenListe
        results={results}
        loading={loading}
        debouncedTerm={debouncedTerm}
        onSelectKontakt={setSelectedKontaktId}
      />

      {/* Detail Modal */}
      {selectedKontaktId && (
        <KontaktDetailModal kontaktId={selectedKontaktId} onClose={() => setSelectedKontaktId(null)} />
      )}

      {/* New Kontakt Modal */}
      {showNeuerKontakt && (
        <NeuerKontaktModal
          onClose={() => setShowNeuerKontakt(false)}
          onCreated={(kontakt) => {
            setShowNeuerKontakt(false)
            setSelectedKontaktId(kontakt.id)
          }}
        />
      )}
    </div>
  )
}
