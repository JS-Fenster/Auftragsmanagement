import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Search,
  FileText,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Filter,
  Calendar,
  Euro,
  FolderKanban,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────

const STATUS_CONFIG = {
  entwurf: { label: 'Entwurf', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  versendet: { label: 'Versendet', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  angenommen: { label: 'Angenommen', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  abgelehnt: { label: 'Abgelehnt', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
}

const PAGE_SIZE = 20

// ── Helpers ──────────────────────────────────────────────

function formatEuro(value) {
  if (value == null || isNaN(value)) return '0,00 \u20AC'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.entwurf
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Main Component ───────────────────────────────────────

export default function BudgetangebotVerlauf() {
  const navigate = useNavigate()

  const [angebote, setAngebote] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Pagination
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Convert to Projekt
  const [convertId, setConvertId] = useState(null)
  const [converting, setConverting] = useState(false)

  // ── Load Data ─────────────────────────────────────────
  const loadAngebote = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('budgetangebote')
        .select('*', { count: 'exact' })
        .order('erstellt_am', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      if (searchTerm.trim()) {
        query = query.or(`kontakt_name.ilike.%${searchTerm.trim()}%,projekt_bezeichnung.ilike.%${searchTerm.trim()}%`)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setAngebote(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Fehler beim Laden der Angebote:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchTerm])

  useEffect(() => {
    loadAngebote()
  }, [loadAngebote])

  // Reset page when filter changes
  useEffect(() => {
    setPage(0)
  }, [searchTerm, statusFilter])

  // ── Delete ────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      const { error: delError } = await supabase
        .from('budgetangebote')
        .delete()
        .eq('id', id)

      if (delError) throw delError

      setDeleteId(null)
      loadAngebote()
    } catch (err) {
      console.error('Fehler beim Loeschen:', err)
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Status Update ─────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error: updError } = await supabase
        .from('budgetangebote')
        .update({ status: newStatus, aktualisiert_am: new Date().toISOString() })
        .eq('id', id)

      if (updError) throw updError

      loadAngebote()
    } catch (err) {
      console.error('Status-Aenderung Fehler:', err)
      setError(err.message)
    }
  }

  // ── Convert to Projekt ───────────────────────────────
  const handleConvert = async (budgetangebotId) => {
    setConverting(true)
    try {
      // 1. Lade Budgetangebot + Positionen
      const [{ data: ba, error: baErr }, { data: positionen, error: posErr }] = await Promise.all([
        supabase.from('budgetangebote').select('*').eq('id', budgetangebotId).single(),
        supabase.from('budgetangebot_positionen').select('*').eq('budgetangebot_id', budgetangebotId).order('pos_nr'),
      ])
      if (baErr) throw baErr
      if (posErr) throw posErr

      // 2. Erstelle Projekt
      const { data: projekt, error: projErr } = await supabase
        .from('projekte')
        .insert({
          titel: ba.projekt_bezeichnung || 'Aus Budgetangebot',
          kontakt_id: ba.kontakt_id || null,
          status: 'angebot',
          angebots_datum: new Date().toISOString().split('T')[0],
          angebots_wert: ba.brutto_summe || null,
          budgetangebot_id: budgetangebotId,
          verantwortlich: 'Andreas',
          notizen: `Erstellt aus Budgetangebot vom ${formatDate(ba.erstellt_am)}.\nKunde: ${ba.kontakt_name || '-'}\nNetto: ${formatEuro(ba.netto_summe)} / Brutto: ${formatEuro(ba.brutto_summe)}`,
        })
        .select('id')
        .single()
      if (projErr) throw projErr

      // 3. Kopiere Positionen
      if (positionen && positionen.length > 0) {
        const projektPositionen = positionen.map(p => ({
          projekt_id: projekt.id,
          pos_nr: p.pos_nr,
          bezeichnung: [p.typ, p.bezeichnung, p.raum ? `(${p.raum})` : ''].filter(Boolean).join(' - ') || p.typ || 'Position',
          typ: (p.typ || '').toLowerCase().includes('tuer') ? 'tuer' : (p.typ || '').toLowerCase().includes('haus') ? 'haustuer' : 'fenster',
          breite_mm: p.breite_mm ? Math.round(p.breite_mm) : null,
          hoehe_mm: p.hoehe_mm ? Math.round(p.hoehe_mm) : null,
          menge: p.menge || 1,
          einzelpreis: p.einzelpreis,
          gesamtpreis: p.gesamtpreis,
          budgetangebot_position_id: p.id,
          details: p.details || null,
        }))
        const { error: posInsErr } = await supabase.from('projekt_positionen').insert(projektPositionen)
        if (posInsErr) throw posInsErr
      }

      // 4. Historie-Eintrag
      await supabase.from('projekt_historie').insert({
        projekt_id: projekt.id,
        aktion: 'erstellt',
        neuer_wert: `Aus Budgetangebot konvertiert (${ba.kontakt_name || 'unbekannt'})`,
        erstellt_von: 'Dashboard',
      })

      // 5. Budgetangebot verlinken + Status
      await supabase.from('budgetangebote').update({
        projekt_id: projekt.id,
        status: 'angenommen',
        aktualisiert_am: new Date().toISOString(),
      }).eq('id', budgetangebotId)

      setConvertId(null)
      navigate(`/projekte/${projekt.id}`)
    } catch (err) {
      console.error('Konvertierung fehlgeschlagen:', err)
      setError(err.message)
    } finally {
      setConverting(false)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgetangebote</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} Angebot{totalCount !== 1 ? 'e' : ''} gesamt
          </p>
        </div>
        <button
          onClick={() => navigate('/budgetangebot')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Neues Budgetangebot
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nach Kunde oder Projekt suchen..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Alle Status</option>
              <option value="entwurf">Entwurf</option>
              <option value="versendet">Versendet</option>
              <option value="angenommen">Angenommen</option>
              <option value="abgelehnt">Abgelehnt</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-gray-500">Lade Angebote...</span>
          </div>
        ) : angebote.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">
              {searchTerm || statusFilter ? 'Keine Angebote gefunden' : 'Noch keine Budgetangebote erstellt'}
            </p>
            {!searchTerm && !statusFilter && (
              <button
                onClick={() => navigate('/budgetangebot')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Erstes Budgetangebot erstellen
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Kunde</th>
                    <th className="px-4 py-3">Projekt</th>
                    <th className="px-4 py-3">Brutto</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {angebote.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatDate(a.erstellt_am)}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 pl-5.5">
                          {formatDateTime(a.aktualisiert_am) !== formatDateTime(a.erstellt_am) && (
                            <span>Aktualisiert: {formatDateTime(a.aktualisiert_am)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{a.kontakt_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                        {a.projekt_bezeichnung || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Euro className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-semibold text-gray-900">{formatEuro(a.brutto_summe)}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Netto: {formatEuro(a.netto_summe)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                        {/* Quick status change dropdown on hover */}
                        <div className="mt-1">
                          <select
                            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            value={a.status}
                            onChange={e => handleStatusChange(a.id, e.target.value)}
                          >
                            <option value="entwurf">Entwurf</option>
                            <option value="versendet">Versendet</option>
                            <option value="angenommen">Angenommen</option>
                            <option value="abgelehnt">Abgelehnt</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-center">
                        v{a.version || 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/budgetangebot?id=${a.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Angebot oeffnen/bearbeiten"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!a.projekt_id ? (
                            <button
                              onClick={() => setConvertId(a.id)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Als Projekt anlegen"
                            >
                              <FolderKanban className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/projekte/${a.projekt_id}`)}
                              className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Zum Projekt"
                            >
                              <FolderKanban className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteId(a.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Angebot loeschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Seite {page + 1} von {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm m-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Angebot loeschen?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Dieses Budgetangebot wird unwiderruflich geloescht. Moechten Sie fortfahren?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {deleting ? 'Loesche...' : 'Loeschen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Convert Confirmation Modal */}
      {convertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConvertId(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Als Projekt anlegen?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Aus diesem Budgetangebot wird ein neues Projekt erstellt.
            </p>
            <ul className="text-xs text-gray-500 mb-6 space-y-1 ml-4 list-disc">
              <li>Positionen werden uebernommen (kopiert)</li>
              <li>Projekt startet im Status &quot;Angebot&quot;</li>
              <li>Budgetangebot wird als &quot;Angenommen&quot; markiert</li>
            </ul>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConvertId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleConvert(convertId)}
                disabled={converting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {converting ? 'Wird erstellt...' : 'Projekt erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
