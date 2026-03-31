import { useState, useEffect, useCallback } from 'react'
import { X, MapPin, Clock, Car, Users, FileText, ExternalLink, CheckCircle, XCircle, Edit2, Briefcase, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const STATUS_MAP = {
  geplant:       { label: 'Geplant',       bg: '#EFF6FF', text: '#1E40AF', border: '#3B82F6' },
  bestaetigt:    { label: 'Bestaetigt',    bg: '#ECFDF5', text: '#065F46', border: '#10B981' },
  abgeschlossen: { label: 'Abgeschlossen', bg: '#F3F4F6', text: '#374151', border: '#6B7280' },
  abgesagt:      { label: 'Abgesagt',      bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' },
}

const formatDateTime = (start, end, ganztaegig) => {
  if (!start) return '-'
  const opts = { day: '2-digit', month: '2-digit', year: 'numeric' }
  const timeOpts = { hour: '2-digit', minute: '2-digit' }
  const s = new Date(start)
  if (ganztaegig) return s.toLocaleDateString('de-DE', opts) + ' (ganztaegig)'
  const dateStr = s.toLocaleDateString('de-DE', opts)
  const startTime = s.toLocaleTimeString('de-DE', timeOpts)
  const endTime = end ? new Date(end).toLocaleTimeString('de-DE', timeOpts) : ''
  return `${dateStr}, ${startTime}${endTime ? ` - ${endTime}` : ''}`
}

const getKundeName = (kontakt) => {
  if (!kontakt) return null
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find(p => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : kontakt.firma1 || 'Unbekannt'
}

const getAdresse = (kontakt) => {
  if (!kontakt) return null
  const parts = [kontakt.strasse, [kontakt.plz, kontakt.ort].filter(Boolean).join(' ')].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

const AKTION_LABELS = {
  erstellt: 'Erstellt',
  bearbeitet: 'Bearbeitet',
  verschoben: 'Verschoben',
  storniert: 'Storniert',
  bestaetigt: 'Bestaetigt',
  abgeschlossen: 'Abgeschlossen',
  ressourcen_geaendert: 'Ressourcen geändert',
}

const AKTION_COLORS = {
  erstellt: '#3B82F6',
  bearbeitet: '#F59E0B',
  verschoben: '#8B5CF6',
  storniert: '#EF4444',
  bestaetigt: '#10B981',
  abgeschlossen: '#6B7280',
}

export default function TerminDetail() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [termin, setTermin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [stornoGrund, setStornoGrund] = useState('')
  const [historie, setHistorie] = useState([])

  const loadTermin = useCallback(async (terminId) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('termine')
      .select(`
        *,
        termin_arten ( id, name, slug, farbe, icon ),
        kontakte!kontakt_id ( id, firma1, firma2, strasse, plz, ort, kontakt_personen!kontakt_id ( vorname, nachname, ist_hauptkontakt ) ),
        projekte!projekt_id ( id, projekt_nummer, status ),
        termin_ressourcen ( rolle, ressource_id, ressourcen ( id, typ, name, kuerzel, farbe ) )
      `)
      .eq('id', terminId)
      .single()

    if (error) {
      console.error('Termin laden fehlgeschlagen:', error)
      setLoading(false)
      return
    }
    setTermin(data)
    setLoading(false)

    // Load historie
    const { data: hist } = await supabase
      .from('termin_historie')
      .select('*')
      .eq('termin_id', terminId)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorie(hist || [])
  }, [])

  useEffect(() => {
    const handleOpen = (e) => {
      // Support both { terminId } and full termin object as detail
      const detail = e.detail || {}
      const id = detail.terminId || detail.id
      if (!id) return
      setOpen(true)
      setConfirmAction(null)
      loadTermin(id)
    }
    const handleClose = () => setOpen(false)

    window.addEventListener('termin-detail-open', handleOpen)
    window.addEventListener('termin-detail-close', handleClose)
    return () => {
      window.removeEventListener('termin-detail-open', handleOpen)
      window.removeEventListener('termin-detail-close', handleClose)
    }
  }, [loadTermin])

  const handleEdit = () => {
    window.dispatchEvent(new CustomEvent('termin-edit-open', { detail: { termin } }))
  }

  const handleStatusChange = async (newStatus) => {
    if (!termin) return
    const updateData = { status: newStatus, bearbeitet_von: 'Dashboard' }
    if (newStatus === 'abgesagt' && stornoGrund) {
      updateData.storno_grund = stornoGrund
    }
    const { error } = await supabase
      .from('termine')
      .update(updateData)
      .eq('id', termin.id)

    if (error) {
      console.error('Status-Update fehlgeschlagen:', error)
      return
    }
    setTermin(prev => ({ ...prev, ...updateData }))
    setConfirmAction(null)
    setStornoGrund('')
    window.dispatchEvent(new CustomEvent('termin-saved'))
    // Reload historie
    const { data: hist } = await supabase
      .from('termin_historie').select('*').eq('termin_id', termin.id).order('created_at', { ascending: false }).limit(20)
    setHistorie(hist || [])
  }

  if (!open) return null

  const fahrzeug = termin?.termin_ressourcen?.find(r => r.ressourcen?.typ === 'fahrzeug')
  const monteure = termin?.termin_ressourcen?.filter(r => r.ressourcen?.typ === 'monteur') || []
  const art = termin?.termin_arten
  const status = STATUS_MAP[termin?.status] || STATUS_MAP.geplant
  const kundeName = getKundeName(termin?.kontakte)
  const adresse = getAdresse(termin?.kontakte)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 z-50 h-full w-96 bg-surface-card shadow-2xl border-l border-border-default flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border-default">
          <div className="flex-1 min-w-0">
            {art && (
              <span
                className="inline-flex items-center rounded-full text-xs font-medium px-2.5 py-0.5 mb-2"
                style={{
                  backgroundColor: art.farbe + '20',
                  color: art.farbe,
                  border: `1px solid ${art.farbe}40`,
                }}
              >
                {art.name}
              </span>
            )}
            <h2 className="text-lg font-semibold text-text-primary truncate">
              {loading ? 'Laden...' : termin?.titel || 'Termin'}
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
            Lade Termin-Details...
          </div>
        ) : termin ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full text-xs font-medium px-2.5 py-0.5"
                style={{
                  backgroundColor: status.bg,
                  color: status.text,
                  border: `1px solid ${status.border}30`,
                }}
              >
                {status.label}
              </span>
            </div>

            {/* Kunde */}
            {kundeName && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <Briefcase className="w-3.5 h-3.5" />
                  Kunde
                </div>
                <p className="text-sm text-text-primary">
                  {termin.projekte ? (
                    <button
                      onClick={() => { setOpen(false); navigate(`/projekte/${termin.projekte.id}`) }}
                      className="hover:text-[var(--brand)] transition-colors text-left"
                    >
                      {kundeName}
                    </button>
                  ) : kundeName}
                </p>
              </div>
            )}

            {/* Adresse */}
            {adresse && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5" />
                  Adresse
                </div>
                <p className="text-sm text-text-primary">{adresse}</p>
              </div>
            )}

            {/* Datum/Uhrzeit */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                Datum / Uhrzeit
              </div>
              <p className="text-sm text-text-primary">
                {formatDateTime(termin.start_zeit, termin.end_zeit, termin.ganztaegig)}
              </p>
            </div>

            {/* Fahrzeug */}
            {fahrzeug && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <Car className="w-3.5 h-3.5" />
                  Fahrzeug
                </div>
                <p className="text-sm text-text-primary">{fahrzeug.ressourcen.name}</p>
              </div>
            )}

            {/* Monteure */}
            {monteure.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" />
                  Monteure
                </div>
                <div className="flex flex-wrap gap-2">
                  {monteure.map((m) => (
                    <div key={m.ressourcen.id} className="flex items-center gap-1.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: m.ressourcen.farbe || '#6B7280' }}
                      >
                        {m.ressourcen.kuerzel || m.ressourcen.name?.charAt(0)}
                      </span>
                      <span className="text-sm text-text-primary">{m.ressourcen.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projekt */}
            {termin.projekte && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Projekt
                </div>
                <button
                  onClick={() => { setOpen(false); navigate(`/projekte/${termin.projekte.id}`) }}
                  className="text-sm text-[var(--brand)] hover:underline"
                >
                  {termin.projekte.projekt_nummer}
                </button>
              </div>
            )}

            {/* Notizen */}
            {termin.notizen && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5" />
                  Notizen
                </div>
                <p className="text-sm text-text-primary whitespace-pre-wrap bg-surface-main rounded-lg p-3">
                  {termin.notizen}
                </p>
              </div>
            )}

            {/* Storno-Grund */}
            {termin.storno_grund && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 uppercase tracking-wider">
                  <XCircle className="w-3.5 h-3.5" />
                  Storno-Grund
                </div>
                <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
                  {termin.storno_grund}
                </p>
              </div>
            )}

            {/* Historie */}
            {historie.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <History className="w-3.5 h-3.5" />
                  Verlauf
                </div>
                <div className="space-y-1.5">
                  {historie.map(h => {
                    const color = AKTION_COLORS[h.aktion] || '#6B7280'
                    const label = AKTION_LABELS[h.aktion] || h.aktion
                    const zeit = new Date(h.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    let detail = ''
                    if (h.aktion === 'verschoben' && h.aenderungen?.start_zeit) {
                      const [alt, neu] = h.aenderungen.start_zeit
                      detail = `${new Date(alt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} → ${new Date(neu).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                    }
                    return (
                      <div key={h.id} className="flex items-start gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                        <div className="min-w-0">
                          <span className="font-medium" style={{ color }}>{label}</span>
                          {h.erstellt_von && (
                            <span className="text-text-secondary ml-1">von {h.erstellt_von}</span>
                          )}
                          <span className="text-text-muted ml-1.5">{zeit}</span>
                          {detail && <div className="text-text-muted mt-0.5">{detail}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Actions */}
        {termin && !loading && (
          <div className="border-t border-border-default p-4 space-y-2">
            {confirmAction === 'absagen' ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Termin stornieren?</p>
                <textarea
                  value={stornoGrund}
                  onChange={e => setStornoGrund(e.target.value)}
                  placeholder="Grund für Stornierung (optional)..."
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm border border-red-200 rounded-lg bg-white dark:bg-red-900/10 text-text-primary outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange('abgesagt')}
                    className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Stornieren
                  </button>
                  <button
                    onClick={() => { setConfirmAction(null); setStornoGrund('') }}
                    className="flex-1 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Edit2 className="w-4 h-4" />
                  Bearbeiten
                </button>
                <div className="flex gap-2">
                  {termin.status !== 'abgeschlossen' && termin.status !== 'abgesagt' && (
                    <button
                      onClick={() => handleStatusChange('abgeschlossen')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Abschließen
                    </button>
                  )}
                  {termin.status !== 'abgesagt' && (
                    <button
                      onClick={() => setConfirmAction('absagen')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Absagen
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
