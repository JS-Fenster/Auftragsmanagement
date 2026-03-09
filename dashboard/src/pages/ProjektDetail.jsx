import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Clock, Package, Wrench, FileText, Plus, Edit2, Trash2, ChevronRight, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge, { PROJEKT_PHASEN } from '../components/StatusBadge'
import { PrioritaetBadge } from '../components/StatusBadge'

const STATUS_FLOW = ['anfrage', 'angebot', 'auftrag', 'bestellt', 'ab_erhalten', 'lieferung_geplant', 'montagebereit', 'abnahme', 'rechnung', 'bezahlt', 'erledigt']
const SONDER_STATUS = ['reklamation', 'storniert', 'pausiert']
const STATUS_DATE_MAP = {
  angebot: 'angebots_datum',
  auftrag: 'auftrags_datum',
  bestellt: 'bestell_datum',
  ab_erhalten: 'ab_datum',
  lieferung_geplant: 'liefertermin_geplant',
  montagebereit: 'montage_datum',
  abnahme: 'abnahme_datum',
  rechnung: 'rechnung_datum',
  bezahlt: 'bezahlt_datum',
  erledigt: 'erledigt_datum',
  reklamation: 'reklamation_datum',
  storniert: 'storniert_datum',
  pausiert: 'pausiert_datum',
}

const formatEuro = (v) => v != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-'
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-'
const formatRelativeTime = (dateStr) => {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `vor ${days} Tagen`
  return new Date(dateStr).toLocaleDateString('de-DE')
}

const HISTORIE_STYLES = {
  status_change: { dot: '#3B82F6', icon: ChevronRight },
  field_update: { dot: '#9CA3AF', icon: Edit2 },
  notiz: { dot: '#10B981', icon: FileText },
  bestellung: { dot: '#F97316', icon: Package },
}

const BESTELL_STATUS = {
  entwurf: { label: 'Entwurf', color: '#6B7280', bg: '#F3F4F6' },
  bestellt: { label: 'Bestellt', color: '#F59E0B', bg: '#FFFBEB' },
  ab_erhalten: { label: 'AB erhalten', color: '#14B8A6', bg: '#F0FDFA' },
  teilgeliefert: { label: 'Teilgeliefert', color: '#06B6D4', bg: '#ECFEFF' },
  geliefert: { label: 'Geliefert', color: '#10B981', bg: '#ECFDF5' },
  storniert: { label: 'Storniert', color: '#DC2626', bg: '#FEF2F2' },
}

const DATE_FIELDS = [
  { key: 'angebots_datum', label: 'Angebots-Datum' },
  { key: 'auftrags_datum', label: 'Auftrags-Datum' },
  { key: 'bestell_datum', label: 'Bestell-Datum' },
  { key: 'ab_datum', label: 'AB-Datum' },
  { key: 'liefertermin_geplant', label: 'Liefertermin' },
  { key: 'montage_datum', label: 'Montage-Datum' },
  { key: 'abnahme_datum', label: 'Abnahme-Datum' },
  { key: 'rechnung_datum', label: 'Rechnung-Datum' },
  { key: 'bezahlt_datum', label: 'Bezahlt-Datum' },
  { key: 'erledigt_datum', label: 'Erledigt-Datum' },
]

const VALUE_FIELDS = [
  { key: 'angebots_wert', label: 'Angebots-Wert', format: formatEuro },
  { key: 'auftrags_wert', label: 'Auftrags-Wert', format: formatEuro },
  { key: 'rechnungs_betrag', label: 'Rechnungs-Betrag', format: formatEuro },
]

export default function ProjektDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [projekt, setProjekt] = useState(null)
  const [positionen, setPositionen] = useState([])
  const [bestellungen, setBestellungen] = useState([])
  const [historie, setHistorie] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [newNotiz, setNewNotiz] = useState('')
  const [showNewBestellung, setShowNewBestellung] = useState(false)
  const [newBestellung, setNewBestellung] = useState({
    bestell_nummer: '', lieferant_name: '', bestell_datum: new Date().toISOString().split('T')[0],
    ab_nummer: '', liefertermin_geplant: '', bestell_wert: '', notizen: ''
  })

  const loadProjekt = useCallback(async () => {
    setLoading(true)
    const [projektRes, posRes, bestRes, histRes] = await Promise.all([
      supabase.from('projekte').select('*, kontakte(id, firma1, firma2, strasse, plz, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))').eq('id', id).single(),
      supabase.from('projekt_positionen').select('*').eq('projekt_id', id).order('pos_nr'),
      supabase.from('projekt_bestellungen').select('*').eq('projekt_id', id).order('created_at', { ascending: false }),
      supabase.from('projekt_historie').select('*').eq('projekt_id', id).order('erstellt_am', { ascending: false }),
    ])

    if (projektRes.error) { navigate('/projekte'); return }
    setProjekt(projektRes.data)
    setPositionen(posRes.data || [])
    setBestellungen(bestRes.data || [])
    setHistorie(histRes.data || [])
    setLoading(false)
  }, [id, navigate])

  useEffect(() => { loadProjekt() }, [loadProjekt])

  const startEditing = () => {
    setEditData({
      titel: projekt.titel || '',
      verantwortlich: projekt.verantwortlich || '',
      montage_team: projekt.montage_team || '',
      einsatzort_strasse: projekt.einsatzort_strasse || '',
      einsatzort_plz: projekt.einsatzort_plz || '',
      einsatzort_ort: projekt.einsatzort_ort || '',
      ab_nummer: projekt.ab_nummer || '',
      liefertermin_kw: projekt.liefertermin_kw || '',
      ...Object.fromEntries(DATE_FIELDS.map(f => [f.key, projekt[f.key] || ''])),
      angebots_wert: projekt.angebots_wert ?? '',
      auftrags_wert: projekt.auftrags_wert ?? '',
      rechnungs_betrag: projekt.rechnungs_betrag ?? '',
      rechnungs_nummer: projekt.rechnungs_nummer || '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    const changes = {}
    const historieEntries = []

    Object.keys(editData).forEach(key => {
      const oldVal = projekt[key] ?? ''
      const newVal = editData[key]
      if (String(newVal) !== String(oldVal)) {
        changes[key] = newVal || null
        historieEntries.push({
          projekt_id: id,
          aktion: 'field_update',
          feld: key,
          alter_wert: String(oldVal),
          neuer_wert: String(newVal || ''),
          erstellt_von: 'Dashboard',
        })
      }
    })

    if (Object.keys(changes).length === 0) { setEditing(false); return }

    await supabase.from('projekte').update(changes).eq('id', id)
    if (historieEntries.length > 0) {
      await supabase.from('projekt_historie').insert(historieEntries)
    }
    setEditing(false)
    loadProjekt()
  }

  const handleStatusChange = async (newStatus) => {
    const oldStatus = projekt.status
    const today = new Date().toISOString().split('T')[0]
    const updates = { status: newStatus }

    // Sonder-Status: vorherigen Status merken
    if (SONDER_STATUS.includes(newStatus)) {
      updates.vorheriger_status = oldStatus
    }
    // Zurueck aus Sonder-Status: vorheriger_status leeren
    if (SONDER_STATUS.includes(oldStatus) && !SONDER_STATUS.includes(newStatus)) {
      updates.vorheriger_status = null
    }

    // Datum automatisch setzen (nur beim ersten Mal)
    const dateField = STATUS_DATE_MAP[newStatus]
    if (dateField && !projekt[dateField]) {
      updates[dateField] = today
    }

    await supabase.from('projekte').update(updates).eq('id', id)
    await supabase.from('projekt_historie').insert({
      projekt_id: id,
      aktion: 'status_change',
      feld: 'status',
      alter_wert: oldStatus,
      neuer_wert: newStatus,
      erstellt_von: 'Dashboard',
    })
    loadProjekt()
  }

  const handleDelete = async () => {
    if (!window.confirm('Projekt wirklich loeschen?')) return
    await supabase.from('projekte').delete().eq('id', id)
    navigate('/projekte')
  }

  const handleAddNotiz = async () => {
    if (!newNotiz.trim()) return
    const timestamp = new Date().toLocaleString('de-DE')
    const existing = projekt.notizen || ''
    const updated = existing ? `${existing}\n\n[${timestamp}]\n${newNotiz.trim()}` : `[${timestamp}]\n${newNotiz.trim()}`

    await supabase.from('projekte').update({ notizen: updated }).eq('id', id)
    await supabase.from('projekt_historie').insert({
      projekt_id: id,
      aktion: 'notiz',
      feld: 'notizen',
      neuer_wert: newNotiz.trim(),
      erstellt_von: 'Dashboard',
    })
    setNewNotiz('')
    loadProjekt()
  }

  const handleCreateBestellung = async () => {
    if (!newBestellung.lieferant_name.trim()) return

    const { error } = await supabase.from('projekt_bestellungen').insert({
      projekt_id: id,
      bestell_nummer: newBestellung.bestell_nummer || null,
      lieferant_name: newBestellung.lieferant_name,
      bestell_datum: newBestellung.bestell_datum || null,
      ab_nummer: newBestellung.ab_nummer || null,
      liefertermin_geplant: newBestellung.liefertermin_geplant || null,
      bestell_wert: newBestellung.bestell_wert ? parseFloat(newBestellung.bestell_wert) : null,
      notizen: newBestellung.notizen || null,
      status: 'bestellt',
    })
    if (error) { console.error(error); return }

    // Auto-update project status to 'bestellt' if currently 'auftrag'
    if (projekt.status === 'auftrag') {
      await supabase.from('projekte').update({
        status: 'bestellt',
        bestell_datum: newBestellung.bestell_datum || new Date().toISOString().split('T')[0]
      }).eq('id', id)
      await supabase.from('projekt_historie').insert({
        projekt_id: id, aktion: 'status_change', feld: 'status',
        alter_wert: 'auftrag', neuer_wert: 'bestellt', erstellt_von: 'Dashboard'
      })
    }

    // Historie entry for bestellung
    await supabase.from('projekt_historie').insert({
      projekt_id: id, aktion: 'bestellung',
      neuer_wert: `Bestellung bei ${newBestellung.lieferant_name} (${newBestellung.bestell_nummer || 'ohne Nr.'})`,
      erstellt_von: 'Dashboard'
    })

    setShowNewBestellung(false)
    setNewBestellung({ bestell_nummer: '', lieferant_name: '', bestell_datum: new Date().toISOString().split('T')[0], ab_nummer: '', liefertermin_geplant: '', bestell_wert: '', notizen: '' })
    loadProjekt()
  }

  const getTransitions = () => {
    const status = projekt?.status
    if (!status) return { forward: [], backward: [], sonder: [], resume: null }

    // Sonder-Status: nur "Zurueck" zum vorherigen Status
    if (SONDER_STATUS.includes(status)) {
      const resume = projekt.vorheriger_status
      return { forward: [], backward: [], sonder: [], resume }
    }

    const idx = STATUS_FLOW.indexOf(status)
    if (idx < 0) return { forward: [], backward: [], sonder: [], resume: null }

    const forward = idx < STATUS_FLOW.length - 1 ? [STATUS_FLOW[idx + 1]] : []
    const backward = idx > 0 ? [STATUS_FLOW[idx - 1]] : []
    // Sonder-Status nur ab "auftrag" aufwaerts anbieten
    const sonder = idx >= 2 ? SONDER_STATUS : []
    return { forward, backward, sonder, resume: null }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!projekt) return null

  const kontakt = projekt.kontakte
  const adresse = {
    strasse: projekt.einsatzort_strasse || kontakt?.strasse || '',
    plz: projekt.einsatzort_plz || kontakt?.plz || '',
    ort: projekt.einsatzort_ort || kontakt?.ort || '',
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projekte')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{projekt.projekt_nummer}</h1>
            {projekt.titel && <p className="text-sm text-gray-500 mt-0.5">{projekt.titel}</p>}
          </div>
          <StatusBadge status={projekt.status} size="md" />
          {projekt.prioritaet && projekt.prioritaet !== 'normal' && (
            <PrioritaetBadge prioritaet={projekt.prioritaet} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Abbrechen
              </button>
              <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                <Save className="h-4 w-4" /> Speichern
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5">
                <Edit2 className="h-4 w-4" /> Bearbeiten
              </button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" /> Loeschen
              </button>
              <button
                onClick={() => window.open(`/projekte/${id}?standalone=1`, '_blank', 'width=1200,height=800')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                title="In neuem Fenster oeffnen"
              >
                <ExternalLink size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stammdaten */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Stammdaten</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Titel" value={projekt.titel} editing={editing} editValue={editData.titel} onChange={v => setEditData(d => ({ ...d, titel: v }))} />
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kunde</span>
                  <p className="mt-1 text-sm text-gray-900">
                    {kontakt ? (kontakt.firma1 || (() => { const hp = kontakt.kontakt_personen?.find(p => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]; return hp ? `${hp.vorname || ''} ${hp.nachname || ''}`.trim() : '-' })()) : '-'}
                  </p>
                </div>
              </div>

              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Strasse" value={adresse.strasse} editing editValue={editData.einsatzort_strasse} onChange={v => setEditData(d => ({ ...d, einsatzort_strasse: v }))} />
                  <Field label="PLZ" value={adresse.plz} editing editValue={editData.einsatzort_plz} onChange={v => setEditData(d => ({ ...d, einsatzort_plz: v }))} />
                  <Field label="Ort" value={adresse.ort} editing editValue={editData.einsatzort_ort} onChange={v => setEditData(d => ({ ...d, einsatzort_ort: v }))} />
                </div>
              ) : (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Einsatzort</span>
                  <p className="mt-1 text-sm text-gray-900">
                    {adresse.strasse ? `${adresse.strasse}, ${adresse.plz} ${adresse.ort}` : '-'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Verantwortlich" value={projekt.verantwortlich} editing={editing} editValue={editData.verantwortlich} onChange={v => setEditData(d => ({ ...d, verantwortlich: v }))} />
                <Field label="Montage-Team" value={projekt.montage_team} editing={editing} editValue={editData.montage_team} onChange={v => setEditData(d => ({ ...d, montage_team: v }))} />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {DATE_FIELDS.map(f => (
                    <Field key={f.key} label={f.label} value={formatDate(projekt[f.key])} editing={editing} editValue={editData[f.key]} onChange={v => setEditData(d => ({ ...d, [f.key]: v }))} type="date" />
                  ))}
                  <Field label="AB-Nummer" value={projekt.ab_nummer} editing={editing} editValue={editData.ab_nummer} onChange={v => setEditData(d => ({ ...d, ab_nummer: v }))} />
                  <Field label="Lieferwoche (KW)" value={projekt.liefertermin_kw} editing={editing} editValue={editData.liefertermin_kw} onChange={v => setEditData(d => ({ ...d, liefertermin_kw: v }))} type="number" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {editing ? (
                    <>
                      {VALUE_FIELDS.map(f => (
                        <Field key={f.key} label={f.label} value={f.format(projekt[f.key])} editing editValue={editData[f.key]} onChange={v => setEditData(d => ({ ...d, [f.key]: v }))} type="number" />
                      ))}
                      <Field label="Rechnungs-Nr." value={projekt.rechnungs_nummer} editing editValue={editData.rechnungs_nummer} onChange={v => setEditData(d => ({ ...d, rechnungs_nummer: v }))} />
                    </>
                  ) : (
                    <>
                      <WertCell label="Angebot" value={projekt.angebots_wert} />
                      <WertCell label="Auftrag" value={projekt.auftrags_wert} diff={projekt.auftrags_wert != null && projekt.angebots_wert != null ? projekt.auftrags_wert - projekt.angebots_wert : null} />
                      <WertCell label="Rechnung" value={projekt.rechnungs_betrag} diff={projekt.rechnungs_betrag != null && (projekt.auftrags_wert ?? projekt.angebots_wert) != null ? projekt.rechnungs_betrag - (projekt.auftrags_wert ?? projekt.angebots_wert) : null} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Transitions */}
          {!editing && (() => {
            const { forward, backward, sonder, resume } = getTransitions()
            const hasTransitions = forward.length > 0 || backward.length > 0 || sonder.length > 0 || resume
            if (!hasTransitions) return null
            return (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-5 py-3 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900">Status aendern</h2>
                </div>
                <div className="p-5 space-y-3">
                  {/* Resume from Sonder-Status */}
                  {resume && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Fortsetzen:</span>
                      <button
                        onClick={() => handleStatusChange(resume)}
                        className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                        style={{ backgroundColor: PROJEKT_PHASEN[resume]?.bg, color: PROJEKT_PHASEN[resume]?.text, border: `1px solid ${PROJEKT_PHASEN[resume]?.color}40` }}
                      >
                        <span className="flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> {PROJEKT_PHASEN[resume]?.label || resume}</span>
                      </button>
                    </div>
                  )}
                  {/* Linear transitions */}
                  {(forward.length > 0 || backward.length > 0) && (
                    <div className="flex flex-wrap gap-3">
                      {forward.map(status => {
                        const phase = PROJEKT_PHASEN[status]
                        return (
                          <button key={status} onClick={() => handleStatusChange(status)}
                            className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                            style={{ backgroundColor: phase.bg, color: phase.text, border: `1px solid ${phase.color}40` }}
                          >
                            <span className="flex items-center gap-1.5">{phase.label} <ChevronRight className="h-4 w-4" /></span>
                          </button>
                        )
                      })}
                      {backward.map(status => {
                        const phase = PROJEKT_PHASEN[status]
                        return (
                          <button key={status} onClick={() => handleStatusChange(status)}
                            className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                            style={{ backgroundColor: phase.bg, color: phase.text, border: `1px solid ${phase.color}40` }}
                          >
                            <span className="flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> {phase.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Sonder-Status */}
                  {sonder.length > 0 && (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Sonder:</span>
                      {sonder.map(status => {
                        const phase = PROJEKT_PHASEN[status]
                        return (
                          <button key={status} onClick={() => handleStatusChange(status)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                            style={{ backgroundColor: phase.bg, color: phase.text, border: `1px solid ${phase.color}40` }}
                          >
                            {phase.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Bestellungen */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-400" /> Bestellungen
              </h2>
              <button onClick={() => setShowNewBestellung(true)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="h-4 w-4" /> Neue Bestellung
              </button>
            </div>
            <div className="p-5">
              {showNewBestellung && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Bestell-Nr.</label>
                      <input type="text" value={newBestellung.bestell_nummer} onChange={e => setNewBestellung(d => ({ ...d, bestell_nummer: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="z.B. B-2026-001" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Lieferant *</label>
                      <input type="text" value={newBestellung.lieferant_name} onChange={e => setNewBestellung(d => ({ ...d, lieferant_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="z.B. WERU" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Bestell-Datum</label>
                      <input type="date" value={newBestellung.bestell_datum} onChange={e => setNewBestellung(d => ({ ...d, bestell_datum: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Wert</label>
                      <input type="number" value={newBestellung.bestell_wert} onChange={e => setNewBestellung(d => ({ ...d, bestell_wert: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="0.00" step="0.01" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500">Notizen</label>
                      <input type="text" value={newBestellung.notizen} onChange={e => setNewBestellung(d => ({ ...d, notizen: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Optionale Notizen..." />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowNewBestellung(false); setNewBestellung({ bestell_nummer: '', lieferant_name: '', bestell_datum: new Date().toISOString().split('T')[0], ab_nummer: '', liefertermin_geplant: '', bestell_wert: '', notizen: '' }) }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      Abbrechen
                    </button>
                    <button onClick={handleCreateBestellung} disabled={!newBestellung.lieferant_name.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                      <Save className="h-4 w-4" /> Speichern
                    </button>
                  </div>
                </div>
              )}
              {bestellungen.length === 0 && !showNewBestellung ? (
                <p className="text-sm text-gray-400">Keine Bestellungen vorhanden.</p>
              ) : bestellungen.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <th className="pb-2 pr-4">Bestell-Nr.</th>
                        <th className="pb-2 pr-4">Lieferant</th>
                        <th className="pb-2 pr-4">Datum</th>
                        <th className="pb-2 pr-4">AB-Nr.</th>
                        <th className="pb-2 pr-4">Liefertermin</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestellungen.map(b => {
                        const bStatus = BESTELL_STATUS[b.status]
                        return (
                          <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-4 font-medium">{b.bestell_nummer || '-'}</td>
                            <td className="py-2 pr-4">{b.lieferant_name || '-'}</td>
                            <td className="py-2 pr-4">{formatDate(b.bestell_datum)}</td>
                            <td className="py-2 pr-4">{b.ab_nummer || '-'}</td>
                            <td className="py-2 pr-4">{formatDate(b.liefertermin_geplant)}</td>
                            <td className="py-2">
                              {bStatus ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: bStatus.color, backgroundColor: bStatus.bg }}>
                                  {bStatus.label}
                                </span>
                              ) : (b.status || '-')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Notizen */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" /> Notizen
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {projekt.notizen && (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-4">{projekt.notizen}</pre>
              )}
              <div className="flex gap-2">
                <textarea
                  value={newNotiz}
                  onChange={e => setNewNotiz(e.target.value)}
                  placeholder="Neue Notiz..."
                  rows={2}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleAddNotiz}
                  disabled={!newNotiz.trim()}
                  className="self-end px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Hinzufuegen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Timeline 1/3 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> Historie
              </h2>
            </div>
            <div className="p-5">
              {historie.length === 0 ? (
                <p className="text-sm text-gray-400">Noch keine Eintraege.</p>
              ) : (
                <div className="relative space-y-0">
                  {historie.map((entry, idx) => {
                    const style = HISTORIE_STYLES[entry.aktion] || HISTORIE_STYLES.field_update
                    const isLast = idx === historie.length - 1
                    return (
                      <div key={entry.id} className="relative flex gap-3 pb-6">
                        {/* Vertical line */}
                        {!isLast && (
                          <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200" />
                        )}
                        {/* Dot */}
                        <div className="relative z-10 flex-shrink-0 mt-0.5">
                          <div className="h-4 w-4 rounded-full border-2" style={{ borderColor: style.dot, backgroundColor: `${style.dot}20` }} />
                        </div>
                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-400">{formatRelativeTime(entry.erstellt_am)}</p>
                          {entry.aktion === 'status_change' ? (
                            <p className="text-sm text-gray-700 mt-0.5">
                              Status: <span className="font-medium">{PROJEKT_PHASEN[entry.alter_wert]?.label || entry.alter_wert}</span>
                              {' '}<ChevronRight className="inline h-3 w-3 text-gray-400" />{' '}
                              <span className="font-medium">{PROJEKT_PHASEN[entry.neuer_wert]?.label || entry.neuer_wert}</span>
                            </p>
                          ) : entry.aktion === 'notiz' ? (
                            <p className="text-sm text-gray-700 mt-0.5">{entry.neuer_wert}</p>
                          ) : (
                            <p className="text-sm text-gray-700 mt-0.5">
                              <span className="text-gray-500">{entry.feld}:</span>{' '}
                              {entry.alter_wert && <span className="line-through text-gray-400">{entry.alter_wert}</span>}
                              {entry.alter_wert && ' '}
                              <span className="font-medium">{entry.neuer_wert || '-'}</span>
                            </p>
                          )}
                          {entry.erstellt_von && (
                            <p className="text-xs text-gray-400 mt-0.5">{entry.erstellt_von}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Positionen (full width) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gray-400" /> Positionen
          </h2>
        </div>
        <div className="p-5">
          {positionen.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Positionen vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-4">Pos</th>
                    <th className="pb-2 pr-4">Bezeichnung</th>
                    <th className="pb-2 pr-4">Typ</th>
                    <th className="pb-2 pr-4 text-right">Breite</th>
                    <th className="pb-2 pr-4 text-right">Hoehe</th>
                    <th className="pb-2 pr-4 text-right">Menge</th>
                    <th className="pb-2 pr-4 text-right">Einzelpreis</th>
                    <th className="pb-2 pr-4 text-right">Gesamt</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map(pos => (
                    <tr key={pos.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-500">{pos.pos_nr}</td>
                      <td className="py-2 pr-4 font-medium">{pos.bezeichnung || '-'}</td>
                      <td className="py-2 pr-4">{pos.typ || '-'}</td>
                      <td className="py-2 pr-4 text-right">{pos.breite_mm || '-'}</td>
                      <td className="py-2 pr-4 text-right">{pos.hoehe_mm || '-'}</td>
                      <td className="py-2 pr-4 text-right">{pos.menge ?? '-'}</td>
                      <td className="py-2 pr-4 text-right">{formatEuro(pos.einzelpreis)}</td>
                      <td className="py-2 pr-4 text-right">{formatEuro(pos.gesamtpreis)}</td>
                      <td className="py-2">{pos.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                {positionen.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 font-semibold">
                      <td colSpan={7} className="py-2 pr-4 text-right">Summe</td>
                      <td className="py-2 pr-4 text-right">
                        {formatEuro(positionen.reduce((sum, p) => sum + (p.gesamtpreis || 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WertCell({ label, value, diff }) {
  const hasValue = value != null
  const hasDiff = diff != null && diff !== 0
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-sm font-semibold text-gray-900">{hasValue ? formatEuro(value) : '-'}</span>
        {hasDiff && (
          <span className="text-xs font-medium" style={{ color: diff > 0 ? '#16A34A' : '#DC2626' }}>
            {diff > 0 ? '+' : ''}{formatEuro(diff)}
          </span>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, editing, editValue, onChange, type = 'text' }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      {editing ? (
        <input
          type={type}
          value={editValue ?? ''}
          onChange={e => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      ) : (
        <p className="mt-1 text-sm text-gray-900">{value || '-'}</p>
      )}
    </div>
  )
}
