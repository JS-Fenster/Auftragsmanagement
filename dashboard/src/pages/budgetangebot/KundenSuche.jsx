/**
 * Budgetangebot - Kundensuche + Suchmodal
 *
 * Wann lesen: Wenn du das Suchmodal aendern musst oder die searchKontakte-
 * Such-Logik anpassen musst.
 *
 * Die Such-Logik selbst ist in `lib/search.js` zentralisiert. Diese Datei
 * haelt den Transform auf das "display format" (display_name, telefon,
 * email etc.) und das Modal. searchKontakte() bleibt als duenner Wrapper
 * exportiert — die beiden Consumer (TerminForm, Budgetangebot) brauchen
 * das display-Format.
 */
import { useState, useRef, useEffect } from 'react'
import { Search, Users, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { searchKontakteIds } from '../../lib/search'

// ── Kunden-Suche Helper ─────────────────────────────────

const KONTAKTE_SELECT = 'id, firma1, firma2, strasse, plz, ort, erp_kunden_code, kontakt_personen!kontakt_id(id, vorname, nachname, ist_hauptkontakt, kontakt_details(typ, wert, ist_primaer))'

/**
 * Sucht Kontakte und transformiert sie ins Display-Format fuer Autocomplete /
 * Budget-Angebot / Termin-Form. Such-Logik (Tokenisierung, Multi-Feld-OR,
 * AND-Schnittmenge) liegt in `lib/search.js`.
 */
export async function searchKontakte(term) {
  const ids = await searchKontakteIds(term)
  if (ids.size === 0) return []

  const { data: kontakte } = await supabase.from('kontakte')
    .select(KONTAKTE_SELECT)
    .in('id', Array.from(ids))
    .limit(80)

  return (kontakte || []).map(k => {
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
  }).slice(0, 50)
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
      <div className="bg-surface-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Users className="w-5 h-5 text-brand" />
            Kunde suchen
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border-light">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              className="w-full border border-border-default rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
              <Loader2 className="w-5 h-5 animate-spin text-brand" />
              <span className="ml-2 text-sm text-text-secondary">Suche...</span>
            </div>
          )}
          {!loading && results.length === 0 && term.length >= 2 && (
            <div className="text-center py-8 text-sm text-text-secondary">Keine Kunden gefunden</div>
          )}
          {!loading && results.length === 0 && term.length < 2 && (
            <div className="text-center py-8 text-sm text-text-muted">Mindestens 2 Zeichen eingeben</div>
          )}
          {!loading && results.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-main text-left text-xs font-medium text-text-secondary uppercase tracking-wider border-b">
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
                    className="hover:bg-brand-light cursor-pointer transition-colors"
                    onClick={() => onSelect(r)}
                  >
                    <td className="px-4 py-2 font-medium text-text-primary">{r.display_name || '-'}</td>
                    <td className="px-4 py-2 text-text-secondary">{r.firma || '-'}</td>
                    <td className="px-4 py-2 text-text-secondary">{r.ort || '-'}</td>
                    <td className="px-4 py-2 text-text-secondary">{r.telefon || '-'}</td>
                    <td className="px-4 py-2 text-text-secondary truncate max-w-[180px]">{r.email || '-'}</td>
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
