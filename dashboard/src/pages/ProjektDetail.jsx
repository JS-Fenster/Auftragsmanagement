import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatContext } from '../lib/chatContext'
import { ArrowLeft, Save, Clock, Package, Wrench, FileText, Plus, Edit2, Trash2, ChevronRight, ExternalLink, Shield, Link2, Unlink, AlertCircle, Eye, EyeOff, Tag, ListChecks, History, Archive, Mail, Paperclip, ChevronDown, ChevronUp, Upload, Download, X } from 'lucide-react'
import ProjektAufgaben from './projekte/ProjektAufgaben'
import ProjektTimeline from './projekte/ProjektTimeline'
import ErpAngeboteTab from './projekte/ErpAngeboteTab'
import { supabase } from '../lib/supabase'
import StatusBadge, { PROJEKT_PHASEN } from '../components/StatusBadge'
import { PrioritaetBadge } from '../components/StatusBadge'
import { PROJEKT_TYPEN, PROJEKT_DOKUMENT_TYPEN, PFLICHT_GATES, VERSICHERUNG_GATES, POSITIONS_EINHEITEN } from '../lib/constants'

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

const BELEG_TYPEN_MAP = {
  angebot:               { label: 'Angebot',             bg: '#F5F3FF', text: '#5B21B6' },
  auftragsbestaetigung:  { label: 'AB',                  bg: '#EFF6FF', text: '#1E40AF' },
  lieferschein:          { label: 'Lieferschein',        bg: '#F0FDFA', text: '#115E59' },
  rechnung:              { label: 'Rechnung',            bg: '#FFFBEB', text: '#92400E' },
  abschlagsrechnung:     { label: 'Abschlagsrechnung',   bg: '#FFF7ED', text: '#9A3412' },
  schlussrechnung:       { label: 'Schlussrechnung',     bg: '#D1FAE5', text: '#064E3B' },
  gutschrift:            { label: 'Gutschrift',          bg: '#FEE2E2', text: '#991B1B' },
}

const BELEG_STATUS_MAP = {
  entwurf:      { label: 'Entwurf',      bg: '#F3F4F6', text: '#374151' },
  freigegeben:  { label: 'Freigegeben',  bg: '#EFF6FF', text: '#1E40AF' },
  versendet:    { label: 'Versendet',    bg: '#F5F3FF', text: '#5B21B6' },
  angenommen:   { label: 'Angenommen',   bg: '#ECFDF5', text: '#065F46' },
  abgelehnt:    { label: 'Abgelehnt',    bg: '#FEE2E2', text: '#991B1B' },
  bezahlt:      { label: 'Bezahlt',      bg: '#D1FAE5', text: '#064E3B' },
  teilbezahlt:  { label: 'Teilbezahlt',  bg: '#FFFBEB', text: '#92400E' },
  storniert:    { label: 'Storniert',    bg: '#F3F4F6', text: '#6B7280' },
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
  const { setChatEntity } = useChatContext()
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
  const [projektBelege, setProjektBelege] = useState([])
  const [dokumente, setDokumente] = useState([])
  const [projektEmails, setProjektEmails] = useState([])
  const [emailsExpanded, setEmailsExpanded] = useState(false)
  const [showLinkDokument, setShowLinkDokument] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const [linkDocSearch, setLinkDocSearch] = useState('')
  const [linkDocResults, setLinkDocResults] = useState([])
  const [linkDocTyp, setLinkDocTyp] = useState('sonstiges')
  const [blockedGates, setBlockedGates] = useState({})

  const loadProjekt = useCallback(async () => {
    setLoading(true)
    const [projektRes, posRes, bestRes, histRes, dokRes, belegeRes] = await Promise.all([
      supabase.from('projekte').select('*, kontakte!projekte_kontakt_id_fkey(id, firma1, firma2, strasse, plz, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))').eq('id', id).single(),
      supabase.from('projekt_positionen').select('*').eq('projekt_id', id).order('pos_nr'),
      supabase.from('projekt_bestellungen').select('*').eq('projekt_id', id).order('created_at', { ascending: false }),
      supabase.from('projekt_historie').select('*').eq('projekt_id', id).order('erstellt_am', { ascending: false }),
      supabase.from('projekt_dokumente').select('*, documents(id, dateiname, kategorie, storage_pfad, created_at)').eq('projekt_id', id).order('created_at', { ascending: false }),
      supabase.from('belege').select('*').eq('projekt_id', id).order('created_at', { ascending: false }),
    ])

    if (projektRes.error) { navigate('/projekte'); return }
    setProjekt(projektRes.data)
    setPositionen(posRes.data || [])
    setBestellungen(bestRes.data || [])
    setHistorie(histRes.data || [])
    setDokumente(dokRes.data || [])
    setProjektBelege(belegeRes.data || [])
    // Provide entity context to Jess chat
    setChatEntity({
      entity_name: `${projektRes.data.projekt_nummer} ${projektRes.data.titel}`,
      kunde_id: projektRes.data.kontakt_id,
    })
    // Load emails for this project's customer (AM-094)
    if (projektRes.data.kontakt_id) {
      const { data: emailData } = await supabase
        .from('documents')
        .select('id, email_betreff, email_von_email, email_von_name, email_empfangen_am, email_kategorie, email_hat_anhaenge, email_anhaenge_count, email_body_text')
        .eq('source', 'email')
        .eq('kontakt_id', projektRes.data.kontakt_id)
        .is('bezug_email_id', null)
        .order('email_empfangen_am', { ascending: false })
        .limit(10)
      setProjektEmails(emailData || [])
    }
    setLoading(false)
  }, [id, navigate, setChatEntity])

  useEffect(() => { loadProjekt() }, [loadProjekt])

  // Refresh when Jess completes an action (e.g. status change, note added)
  useEffect(() => {
    const handler = () => loadProjekt()
    window.addEventListener('jess-action-completed', handler)
    return () => window.removeEventListener('jess-action-completed', handler)
  }, [loadProjekt])

  // A-003: Gate-Check wenn Dokumente sich aendern
  useEffect(() => {
    if (!projekt) return
    const gates = {}
    const checkGates = (gateMap) => {
      for (const [status, requiredDocs] of Object.entries(gateMap)) {
        const missing = requiredDocs.filter(
          typ => !dokumente.some(d => d.dokument_typ === typ)
        )
        if (missing.length > 0) {
          gates[status] = [...(gates[status] || []), ...missing]
        }
      }
    }
    checkGates(PFLICHT_GATES)
    if (projekt.typ === 'versicherung') checkGates(VERSICHERUNG_GATES)
    setBlockedGates(gates)
  }, [projekt?.typ, dokumente])

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

    // Optimistic Locking (AM-084): check if record was modified since we loaded it
    if (projekt.updated_at) {
      const { data: current } = await supabase.from('projekte').select('updated_at').eq('id', id).single()
      if (current && current.updated_at !== projekt.updated_at) {
        const confirmed = window.confirm('Dieses Projekt wurde zwischenzeitlich von jemand anderem geaendert. Trotzdem speichern? (Aenderungen des anderen koennten ueberschrieben werden)')
        if (!confirmed) return
      }
    }

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

  // A-003: Dokument-Suche und Verknuepfung
  const searchDocuments = async (term) => {
    if (term.length < 2) { setLinkDocResults([]); return }
    const { data } = await supabase
      .from('documents')
      .select('id, dateiname, kategorie, created_at')
      .ilike('dateiname', `%${term}%`)
      .limit(10)
    setLinkDocResults(data || [])
  }

  // AM-093: Upload files directly to project
  const handleFileUpload = async (files) => {
    if (!files?.length) return
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress(`${i + 1}/${files.length}: ${file.name}`)
      const filePath = `projekte/${id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
      if (uploadError) { console.error('Upload failed:', uploadError.message); continue }
      // Create document record
      const { data: doc } = await supabase.from('documents').insert({
        dateiname: file.name,
        storage_pfad: filePath,
        source: 'upload',
        kategorie: 'Sonstiges',
      }).select('id').single()
      if (doc) {
        await supabase.from('projekt_dokumente').insert({
          projekt_id: id,
          document_id: doc.id,
          dokument_typ: 'sonstiges',
        })
      }
    }
    setUploading(false)
    setUploadProgress('')
    loadProjekt()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounterRef.current++
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragOver(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleLinkDokument = async (documentId) => {
    const { error } = await supabase
      .from('projekt_dokumente')
      .insert({
        projekt_id: id,
        document_id: documentId,
        dokument_typ: linkDocTyp,
      })
    if (error) { console.error(error); return }
    setShowLinkDokument(false)
    setLinkDocSearch('')
    setLinkDocResults([])
    setLinkDocTyp('sonstiges')
    loadProjekt()
  }

  const handleUnlinkDokument = async (projektDokumentId) => {
    const { error } = await supabase
      .from('projekt_dokumente')
      .delete()
      .eq('id', projektDokumentId)
    if (error) { console.error(error); return }
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

    const nextStatus = idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
    const forward = nextStatus ? [{
      status: nextStatus,
      blocked: !!blockedGates[nextStatus],
      missingDocs: blockedGates[nextStatus] || [],
    }] : []
    const backward = idx > 0 ? [{ status: STATUS_FLOW[idx - 1], blocked: false, missingDocs: [] }] : []
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
          <button onClick={() => navigate('/projekte')} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{projekt.projekt_nummer}</h1>
            {projekt.titel && <p className="text-sm text-text-secondary mt-0.5">{projekt.titel}</p>}
          </div>
          <StatusBadge status={projekt.status} size="md" />
          {projekt.typ && projekt.typ !== 'auftrag' && PROJEKT_TYPEN[projekt.typ] && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: PROJEKT_TYPEN[projekt.typ].bg, color: PROJEKT_TYPEN[projekt.typ].color }}
            >
              {PROJEKT_TYPEN[projekt.typ].label}
            </span>
          )}
          {projekt.prioritaet && projekt.prioritaet !== 'normal' && (
            <PrioritaetBadge prioritaet={projekt.prioritaet} />
          )}
          {projekt.tags && projekt.tags.length > 0 && projekt.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Tag className="h-3 w-3" /> {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
                Abbrechen
              </button>
              <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors flex items-center gap-1.5">
                <Save className="h-4 w-4" /> Speichern
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-1.5">
                <Edit2 className="h-4 w-4" /> Bearbeiten
              </button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" /> Loeschen
              </button>
              <button
                onClick={() => window.open(`/projekte/${id}?standalone=1`, '_blank', 'width=1200,height=800')}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
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
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
            <div className="px-5 py-3 border-b border-border-default">
              <h2 className="font-semibold text-text-primary">Stammdaten</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Titel" value={projekt.titel} editing={editing} editValue={editData.titel} onChange={v => setEditData(d => ({ ...d, titel: v }))} />
                <div>
                  <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Kunde</span>
                  <p className="mt-1 text-sm text-text-primary">
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
                  <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Einsatzort</span>
                  <p className="mt-1 text-sm text-text-primary">
                    {adresse.strasse ? `${adresse.strasse}, ${adresse.plz} ${adresse.ort}` : '-'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Verantwortlich" value={projekt.verantwortlich} editing={editing} editValue={editData.verantwortlich} onChange={v => setEditData(d => ({ ...d, verantwortlich: v }))} />
                <Field label="Montage-Team" value={projekt.montage_team} editing={editing} editValue={editData.montage_team} onChange={v => setEditData(d => ({ ...d, montage_team: v }))} />
              </div>

              {/* A-001: Objekt + A-002: Gewährleistung */}
              {(projekt.gewaehrleistung_bis || projekt.objekt_id) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projekt.gewaehrleistung_bis && (
                    <div>
                      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Gewährleistung bis</span>
                      <p className="mt-1 text-sm text-text-primary">{formatDate(projekt.gewaehrleistung_bis)}</p>
                    </div>
                  )}
                  {projekt.rechnungsempfaenger_kontakt_id && projekt.rechnungsempfaenger_kontakt_id !== projekt.kontakt_id && (
                    <div>
                      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Rechnungsempfänger</span>
                      <p className="mt-1 text-sm text-text-primary italic">Abweichend (ID: {projekt.rechnungsempfaenger_kontakt_id.slice(0,8)}...)</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-border-light pt-4">
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
              <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
                <div className="px-5 py-3 border-b border-border-default">
                  <h2 className="font-semibold text-text-primary">Status aendern</h2>
                </div>
                <div className="p-5 space-y-3">
                  {/* Resume from Sonder-Status */}
                  {resume && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary uppercase tracking-wide">Fortsetzen:</span>
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
                      {forward.map(({ status, blocked, missingDocs }) => {
                        const phase = PROJEKT_PHASEN[status]
                        return (
                          <div key={status} className="relative group">
                            <button onClick={() => !blocked && handleStatusChange(status)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${blocked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                              style={{ backgroundColor: phase.bg, color: phase.text, border: `1px solid ${phase.color}40` }}
                              disabled={blocked}
                            >
                              <span className="flex items-center gap-1.5">
                                {blocked && <AlertCircle className="h-3.5 w-3.5" />}
                                {phase.label} <ChevronRight className="h-4 w-4" />
                              </span>
                            </button>
                            {blocked && (
                              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                Fehlend: {missingDocs.map(d => PROJEKT_DOKUMENT_TYPEN[d]?.label || d).join(', ')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {backward.map(({ status }) => {
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
                    <div className="flex items-center gap-3 pt-2 border-t border-border-light">
                      <span className="text-xs text-text-secondary uppercase tracking-wide">Sonder:</span>
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
          <div id="sektion-bestellungen" className="bg-surface-card rounded-lg shadow-sm border border-border-default transition-all">
            <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <Package className="h-4 w-4 text-text-muted" /> Bestellungen
              </h2>
              <button onClick={() => setShowNewBestellung(true)} className="text-sm text-brand hover:text-brand-dark flex items-center gap-1">
                <Plus className="h-4 w-4" /> Neue Bestellung
              </button>
            </div>
            <div className="p-5">
              {showNewBestellung && (
                <div className="mb-4 p-4 bg-brand-light rounded-lg border border-blue-200 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Bestell-Nr.</label>
                      <input type="text" value={newBestellung.bestell_nummer} onChange={e => setNewBestellung(d => ({ ...d, bestell_nummer: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="z.B. B-2026-001" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Lieferant *</label>
                      <input type="text" value={newBestellung.lieferant_name} onChange={e => setNewBestellung(d => ({ ...d, lieferant_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="z.B. WERU" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Bestell-Datum</label>
                      <input type="date" value={newBestellung.bestell_datum} onChange={e => setNewBestellung(d => ({ ...d, bestell_datum: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Wert</label>
                      <input type="number" value={newBestellung.bestell_wert} onChange={e => setNewBestellung(d => ({ ...d, bestell_wert: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="0.00" step="0.01" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-text-secondary">Notizen</label>
                      <input type="text" value={newBestellung.notizen} onChange={e => setNewBestellung(d => ({ ...d, notizen: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="Optionale Notizen..." />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowNewBestellung(false); setNewBestellung({ bestell_nummer: '', lieferant_name: '', bestell_datum: new Date().toISOString().split('T')[0], ab_nummer: '', liefertermin_geplant: '', bestell_wert: '', notizen: '' }) }} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
                      Abbrechen
                    </button>
                    <button onClick={handleCreateBestellung} disabled={!newBestellung.lieferant_name.trim()} className="px-3 py-1.5 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                      <Save className="h-4 w-4" /> Speichern
                    </button>
                  </div>
                </div>
              )}
              {bestellungen.length === 0 && !showNewBestellung ? (
                <p className="text-sm text-text-muted">Keine Bestellungen vorhanden.</p>
              ) : bestellungen.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
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
                          <tr key={b.id} className="border-b border-gray-50 hover:bg-surface-main">
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

          {/* Aufgaben */}
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
            <div className="px-5 py-3 border-b border-border-default">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-text-muted" /> Aufgaben
              </h2>
            </div>
            <div className="p-5">
              <ProjektAufgaben projektId={id} />
            </div>
          </div>

          {/* Belege */}
          <div id="sektion-belege" className="bg-surface-card rounded-lg shadow-sm border border-border-default transition-all">
            <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <FileText className="h-4 w-4 text-text-muted" /> Belege
              </h2>
              <button onClick={() => navigate(`/belege/neu?projekt_id=${id}`)} className="text-sm text-brand hover:text-brand-dark flex items-center gap-1">
                <Plus className="h-4 w-4" /> Neuer Beleg
              </button>
            </div>
            <div className="p-5">
              {projektBelege.length === 0 ? (
                <p className="text-sm text-text-muted">Keine Belege vorhanden.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                        <th className="pb-2 pr-4">Beleg-Nr.</th>
                        <th className="pb-2 pr-4">Typ</th>
                        <th className="pb-2 pr-4">Datum</th>
                        <th className="pb-2 pr-4 text-right">Betrag</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projektBelege.map(b => {
                        const typInfo = BELEG_TYPEN_MAP[b.beleg_typ]
                        const statusInfo = BELEG_STATUS_MAP[b.status]
                        return (
                          <tr key={b.id} className="border-b border-gray-50 hover:bg-surface-main cursor-pointer" onClick={() => navigate(`/belege/${b.id}`)}>
                            <td className="py-2 pr-4 font-medium text-brand">{b.beleg_nummer || '-'}</td>
                            <td className="py-2 pr-4">
                              {typInfo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: typInfo.text, backgroundColor: typInfo.bg }}>{typInfo.label}</span>
                              ) : (b.beleg_typ || '-')}
                            </td>
                            <td className="py-2 pr-4">{formatDate(b.datum)}</td>
                            <td className="py-2 pr-4 text-right font-medium">{formatEuro(b.brutto_summe)}</td>
                            <td className="py-2">
                              {statusInfo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: statusInfo.text || statusInfo.color, backgroundColor: statusInfo.bg }}>{statusInfo.label}</span>
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

          {/* W4A-Angebote (historisch) */}
          {projekt?.kontakte?.firma1 && (
            <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
              <div className="px-5 py-3 border-b border-border-default">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Archive className="h-4 w-4 text-text-muted" /> W4A-Angebote (historisch)
                </h2>
              </div>
              <div className="p-5">
                <ErpAngeboteTab firma={projekt.kontakte.firma1} />
              </div>
            </div>
          )}

          {/* Dokumente (A-003) */}
          <div id="sektion-dokumente" className="bg-surface-card rounded-lg shadow-sm border border-border-default transition-all">
            <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <Link2 className="h-4 w-4 text-text-muted" /> Dokumente
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-sm text-brand hover:text-brand-dark flex items-center gap-1 cursor-pointer">
                  <Upload className="h-4 w-4" /> Upload
                  <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                </label>
                <button onClick={() => setShowLinkDokument(true)} className="text-sm text-brand hover:text-brand-dark flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Verknuepfen
                </button>
              </div>
            </div>
            <div className="p-5"
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag & Drop Zone */}
              {dragOver && (
                <div className="mb-4 p-6 border-2 border-dashed border-brand rounded-lg bg-brand-light text-center">
                  <Upload className="h-8 w-8 text-brand mx-auto mb-2" />
                  <p className="text-sm text-brand font-medium">Dateien hier ablegen</p>
                </div>
              )}
              {uploading && (
                <div className="mb-4 p-3 bg-surface-hover rounded-lg flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-text-secondary">{uploadProgress}</span>
                </div>
              )}
              {/* Pflicht-Dokumente Checkliste */}
              {Object.keys(blockedGates).length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Fehlende Pflicht-Dokumente
                  </p>
                  {Object.entries(blockedGates).map(([status, docs]) => (
                    <div key={status} className="text-xs text-amber-700">
                      <span className="font-medium">{PROJEKT_PHASEN[status]?.label || status}:</span>{' '}
                      {docs.map(d => PROJEKT_DOKUMENT_TYPEN[d]?.label || d).join(', ')}
                    </div>
                  ))}
                </div>
              )}

              {/* Link-Dokument Formular */}
              {showLinkDokument && (
                <div className="mb-4 p-4 bg-brand-light rounded-lg border border-blue-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Dokument suchen</label>
                      <input
                        type="text" value={linkDocSearch}
                        onChange={e => { setLinkDocSearch(e.target.value); searchDocuments(e.target.value) }}
                        className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        placeholder="Dateiname eingeben..."
                      />
                      {linkDocResults.length > 0 && (
                        <ul className="mt-1 bg-surface-card border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {linkDocResults.map(doc => (
                            <li key={doc.id} onClick={() => handleLinkDokument(doc.id)}
                              className="px-3 py-2 text-sm hover:bg-brand-light cursor-pointer flex justify-between">
                              <span className="truncate">{doc.dateiname}</span>
                              <span className="text-xs text-text-muted ml-2">{doc.kategorie}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Dokument-Typ</label>
                      <select value={linkDocTyp} onChange={e => setLinkDocTyp(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm bg-surface-card">
                        {Object.entries(PROJEKT_DOKUMENT_TYPEN).map(([key, typ]) => (
                          <option key={key} value={key}>{typ.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => { setShowLinkDokument(false); setLinkDocSearch(''); setLinkDocResults([]) }}
                      className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              {/* Dokumente-Liste */}
              {dokumente.length === 0 && !showLinkDokument ? (
                <p className="text-sm text-text-muted">Keine Dokumente verknuepft.</p>
              ) : dokumente.length > 0 && (
                <div className="space-y-2">
                  {dokumente.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-main group">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-text-muted flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{d.documents?.dateiname || 'Unbekannt'}</p>
                          <p className="text-xs text-text-muted">
                            {PROJEKT_DOKUMENT_TYPEN[d.dokument_typ]?.label || d.dokument_typ}
                            {d.ist_pflicht && <span className="ml-1 text-amber-600 font-medium">Pflicht</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.documents?.storage_pfad && (
                          <button onClick={async () => {
                            const { data } = await supabase.storage.from('documents').createSignedUrl(d.documents.storage_pfad, 60)
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                          }} className="p-1 text-text-muted hover:text-brand" title="Herunterladen">
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => handleUnlinkDokument(d.id)}
                          className="p-1 text-text-muted hover:text-red-500"
                          title="Verknuepfung entfernen">
                          <Unlink className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Emails zum Kunden (AM-094) */}
          {projektEmails.length > 0 && (
            <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
              <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Mail className="h-4 w-4 text-text-muted" /> Emails zum Kunden
                  <span className="text-xs font-normal text-text-muted bg-surface-hover px-1.5 py-0.5 rounded-full">{projektEmails.length}</span>
                </h2>
                <button onClick={() => setEmailsExpanded(!emailsExpanded)} className="text-text-muted hover:text-text-secondary">
                  {emailsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {(emailsExpanded ? projektEmails : projektEmails.slice(0, 3)).map(email => (
                    <div key={email.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-main group">
                      <Mail className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary truncate">{email.email_betreff || '(Kein Betreff)'}</p>
                          {email.email_hat_anhaenge && <Paperclip className="h-3 w-3 text-text-muted flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-text-muted">{email.email_von_name || email.email_von_email}</span>
                          <span className="text-xs text-text-muted">·</span>
                          <span className="text-xs text-text-muted">{formatRelativeTime(email.email_empfangen_am)}</span>
                          {email.email_kategorie && (
                            <>
                              <span className="text-xs text-text-muted">·</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">{email.email_kategorie.replace(/_/g, ' ')}</span>
                            </>
                          )}
                        </div>
                        {emailsExpanded && email.email_body_text && (
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">{email.email_body_text.slice(0, 200)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {projektEmails.length > 3 && !emailsExpanded && (
                  <button onClick={() => setEmailsExpanded(true)}
                    className="mt-2 text-xs text-brand hover:text-brand-hover cursor-pointer">
                    + {projektEmails.length - 3} weitere Emails anzeigen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notizen */}
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
            <div className="px-5 py-3 border-b border-border-default">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <FileText className="h-4 w-4 text-text-muted" /> Notizen
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {projekt.notizen && (
                <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans bg-surface-main rounded-lg p-4">{projekt.notizen}</pre>
              )}
              <div className="flex gap-2">
                <textarea
                  value={newNotiz}
                  onChange={e => setNewNotiz(e.target.value)}
                  placeholder="Neue Notiz..."
                  rows={2}
                  className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                />
                <button
                  onClick={handleAddNotiz}
                  disabled={!newNotiz.trim()}
                  className="self-end px-3 py-2 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Hinzufuegen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Timeline 1/3 */}
        <div className="space-y-6">
          <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
            <div className="px-5 py-3 border-b border-border-default">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <History className="h-4 w-4 text-text-muted" /> Projekt-Timeline
              </h2>
            </div>
            <div className="p-5">
              <ProjektTimeline projektId={id} />
            </div>
          </div>
        </div>
      </div>

      {/* Positionen (full width) - A-004 erweitert */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <Wrench className="h-4 w-4 text-text-muted" /> Positionen
          </h2>
        </div>
        <div className="p-5">
          {positionen.length === 0 ? (
            <p className="text-sm text-text-muted">Keine Positionen vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                    <th className="pb-2 pr-4">Pos</th>
                    <th className="pb-2 pr-4">Bezeichnung</th>
                    <th className="pb-2 pr-4">Typ</th>
                    <th className="pb-2 pr-4 text-right">Breite</th>
                    <th className="pb-2 pr-4 text-right">Hoehe</th>
                    <th className="pb-2 pr-4 text-right">Menge</th>
                    <th className="pb-2 pr-4">Einheit</th>
                    <th className="pb-2 pr-4 text-right">EK</th>
                    <th className="pb-2 pr-4 text-right">VK</th>
                    <th className="pb-2 pr-4 text-right">Gesamt</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen
                    .filter(pos => pos.status !== 'REPLACED')
                    .map(pos => {
                      if (pos.ist_ueberschrift) {
                        return (
                          <tr key={pos.id} className="bg-surface-main">
                            <td className="py-2 pr-4 text-text-secondary">{pos.pos_nr}</td>
                            <td colSpan={10} className="py-2 font-bold text-text-primary">{pos.bezeichnung || pos.gruppe || '-'}</td>
                          </tr>
                        )
                      }
                      const isAlt = pos.ist_alternativ
                      const isNachtrag = pos.ist_nachtrag
                      return (
                        <tr key={pos.id} className={`border-b border-gray-50 hover:bg-surface-main ${isAlt ? 'opacity-50' : ''} ${isNachtrag ? 'bg-brand-light/30' : ''}`}>
                          <td className="py-2 pr-4 text-text-secondary">
                            {pos.pos_nr}
                            {pos.version > 1 && (
                              <span className="ml-1 text-xs px-1 py-0.5 rounded bg-brand-light text-brand-dark">V{pos.version}</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 font-medium">
                            {pos.bezeichnung || '-'}
                            {isAlt && <span className="ml-1 text-xs text-text-muted">(Alternativ)</span>}
                            {isNachtrag && <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-brand-light text-brand-dark">NT {pos.nachtrag_nr || ''}</span>}
                          </td>
                          <td className="py-2 pr-4">{pos.typ || '-'}</td>
                          <td className="py-2 pr-4 text-right">{pos.breite_mm || '-'}</td>
                          <td className="py-2 pr-4 text-right">{pos.hoehe_mm || '-'}</td>
                          <td className="py-2 pr-4 text-right">{pos.menge ?? '-'}</td>
                          <td className="py-2 pr-4 text-xs text-text-secondary">{POSITIONS_EINHEITEN[pos.einheit]?.short || pos.einheit || '-'}</td>
                          <td className="py-2 pr-4 text-right">{formatEuro(pos.einzelpreis)}</td>
                          <td className="py-2 pr-4 text-right">{formatEuro(pos.vk_preis)}</td>
                          <td className="py-2 pr-4 text-right font-medium">{isAlt ? '-' : formatEuro(pos.gesamtpreis)}</td>
                          <td className="py-2">{pos.status || '-'}</td>
                        </tr>
                      )
                    })}
                </tbody>
                {positionen.filter(p => p.status !== 'REPLACED' && !p.ist_ueberschrift && !p.ist_alternativ).length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border-default font-semibold">
                      <td colSpan={9} className="py-2 pr-4 text-right">Summe</td>
                      <td className="py-2 pr-4 text-right">
                        {formatEuro(positionen.filter(p => p.status !== 'REPLACED' && !p.ist_ueberschrift && !p.ist_alternativ).reduce((sum, p) => sum + (p.gesamtpreis || 0), 0))}
                      </td>
                      <td />
                    </tr>
                    {positionen.some(p => p.ist_nachtrag && p.status !== 'REPLACED') && (
                      <tr className="font-semibold text-brand-dark">
                        <td colSpan={9} className="py-1 pr-4 text-right text-sm">davon Nachträge</td>
                        <td className="py-1 pr-4 text-right text-sm">
                          {formatEuro(positionen.filter(p => p.ist_nachtrag && p.status !== 'REPLACED' && !p.ist_alternativ).reduce((sum, p) => sum + (p.gesamtpreis || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    )}
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
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-sm font-semibold text-text-primary">{hasValue ? formatEuro(value) : '-'}</span>
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
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
      {editing ? (
        <input
          type={type}
          value={editValue ?? ''}
          onChange={e => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      ) : (
        <p className="mt-1 text-sm text-text-primary">{value || '-'}</p>
      )}
    </div>
  )
}
