/**
 * Budgetangebot - Kundensuche + Suchmodal
 *
 * Wann lesen: Wenn du die Kundensuche/Autocomplete oder das Suchmodal aendern musst.
 * Enthaelt: searchKontakte() (Supabase-Query), KundenSuchModal (Overlay)
 */
import { useState, useRef, useEffect } from 'react'
import { Search, Users, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── Kunden-Suche Helper ─────────────────────────────────

export async function searchKontakte(term) {
  if (!term || term.trim().length < 2) return []

  // Multi-Term: "Andreas Kropfersricht" → ['andreas', 'kropfersricht']
  const terms = term.trim().split(/\s+/).filter(t => t.length >= 2)
  if (terms.length === 0) return []

  const KONTAKTE_SELECT = 'id, firma1, firma2, strasse, plz, ort, erp_kunden_code, kontakt_personen!kontakt_id(id, vorname, nachname, ist_hauptkontakt, kontakt_details(typ, wert, ist_primaer))'

  // Build OR filters covering ALL terms across all fields
  const kontakteOr = terms.flatMap(t => {
    const p = `%${t}%`
    return [`firma1.ilike.${p}`, `firma2.ilike.${p}`, `ort.ilike.${p}`, `plz.ilike.${p}`, `strasse.ilike.${p}`]
  }).join(',')

  const personenOr = terms.flatMap(t => {
    const p = `%${t}%`
    return [`vorname.ilike.${p}`, `nachname.ilike.${p}`]
  }).join(',')

  // For details, search each term
  const detailsOr = terms.map(t => `%${t}%`)

  const queries = [
    supabase.from('kontakte').select(KONTAKTE_SELECT).or(kontakteOr).limit(80),
    supabase.from('kontakt_personen').select('kontakt_id, vorname, nachname').or(personenOr).limit(50),
  ]
  // kontakt_details: ilike only accepts one pattern, so search with first term
  // (multi-term filtering happens client-side)
  queries.push(
    supabase.from('kontakt_details')
      .select('kontakt_person_id, wert, kontakt_personen!inner(kontakt_id)')
      .ilike('wert', detailsOr[0])
      .limit(50)
  )

  const [kontakteRes, personenRes, detailsRes] = await Promise.all(queries)

  const kontaktMap = new Map()
  for (const k of (kontakteRes.data || [])) kontaktMap.set(k.id, k)

  const missingIds = new Set()
  for (const p of (personenRes.data || [])) {
    if (!kontaktMap.has(p.kontakt_id)) missingIds.add(p.kontakt_id)
  }
  for (const d of (detailsRes.data || [])) {
    const kid = d.kontakt_personen?.kontakt_id
    if (kid && !kontaktMap.has(kid)) missingIds.add(kid)
  }

  if (missingIds.size > 0) {
    const { data: extra } = await supabase.from('kontakte')
      .select(KONTAKTE_SELECT)
      .in('id', Array.from(missingIds))
    for (const k of (extra || [])) kontaktMap.set(k.id, k)
  }

  // Transform to display format
  const results = Array.from(kontaktMap.values()).map(k => {
    const personen = k.kontakt_personen || []
    const haupt = personen.find(p => p.ist_hauptkontakt) || personen[0]
    const allDetails = personen.flatMap(p => p.kontakt_details || [])
    const telefon = allDetails.find(d => d.typ === 'telefon' && d.ist_primaer)?.wert
      || allDetails.find(d => d.typ === 'telefon')?.wert || ''
    const email = allDetails.find(d => d.typ === 'email' && d.ist_primaer)?.wert
      || allDetails.find(d => d.typ === 'email')?.wert || ''
    const displayName = haupt
      ? `${haupt.nachname || ''}${haupt.vorname ? ', ' + haupt.vorname : ''}`.trim()
      : k.firma1 || ''

    return {
      kontakt_id: k.id,
      display_name: displayName,
      firma: k.firma1 || '',
      firma2: k.firma2 || '',
      strasse: k.strasse || '',
      ort: k.ort || '',
      plz: k.plz || '',
      telefon,
      email,
      personen: personen.map(p => ({ vorname: p.vorname || '', nachname: p.nachname || '' })),
    }
  })

  // Client-side AND-Filter: JEDES Suchwort muss irgendwo im Kontakt vorkommen
  if (terms.length > 1) {
    return results.filter(r => {
      const haystack = [
        r.display_name, r.firma, r.firma2, r.strasse, r.ort, r.plz,
        r.telefon, r.email,
        ...r.personen.map(p => `${p.vorname} ${p.nachname}`),
      ].join(' ').toLowerCase()
      return terms.every(t => haystack.includes(t.toLowerCase()))
    }).slice(0, 50)
  }

  return results.slice(0, 50)
}

// ── Kunden-Suchmodal ────────────────────────────────────

export function KundenSuchModal({ onSelect, onClose }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!term || term.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchKontakte(term)
        setResults(res)
      } catch (err) {
        console.error('Kundensuche Fehler:', err)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timerRef.current)
  }, [term])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Kunde suchen
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name, Firma, Telefon oder E-Mail suchen..."
              value={term}
              onChange={e => setTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Suche...</span>
            </div>
          )}
          {!loading && results.length === 0 && term.length >= 2 && (
            <div className="text-center py-8 text-sm text-gray-500">Keine Kunden gefunden</div>
          )}
          {!loading && results.length === 0 && term.length < 2 && (
            <div className="text-center py-8 text-sm text-gray-400">Mindestens 2 Zeichen eingeben</div>
          )}
          {!loading && results.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Firma</th>
                  <th className="px-4 py-2">Ort</th>
                  <th className="px-4 py-2">Telefon</th>
                  <th className="px-4 py-2">E-Mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map(r => (
                  <tr
                    key={r.kontakt_id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => onSelect(r)}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900">{r.display_name || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.firma || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.ort || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.telefon || '-'}</td>
                    <td className="px-4 py-2 text-gray-600 truncate max-w-[180px]">{r.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
