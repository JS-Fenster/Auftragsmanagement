import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatContext } from '../lib/chatContext'
import { ListChecks, History, Archive } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PFLICHT_GATES, VERSICHERUNG_GATES } from '../lib/constants'
import { STATUS_DATE_MAP, SONDER_STATUS, DATE_FIELDS } from './projekte/projektConstants'

import ProjektHeader from './projekte/ProjektHeader'
import ProjektStammdaten from './projekte/ProjektStammdaten'
import ProjektBestellungen from './projekte/ProjektBestellungen'
import ProjektAufgaben from './projekte/ProjektAufgaben'
import ProjektBelege from './projekte/ProjektBelege'
import ErpAngeboteTab from './projekte/ErpAngeboteTab'
import ProjektDokumente from './projekte/ProjektDokumente'
import ProjektEmails from './projekte/ProjektEmails'
import ProjektNotizen from './projekte/ProjektNotizen'
import ProjektTimeline from './projekte/ProjektTimeline'
import ProjektPositionen from './projekte/ProjektPositionen'

export default function ProjektDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setChatEntity } = useChatContext()
  const [projekt, setProjekt] = useState(null)
  const [positionen, setPositionen] = useState([])
  const [bestellungen, setBestellungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [projektBelege, setProjektBelege] = useState([])
  const [dokumente, setDokumente] = useState([])
  const [projektEmails, setProjektEmails] = useState([])
  const [blockedGates, setBlockedGates] = useState({})

  const loadProjekt = useCallback(async () => {
    setLoading(true)
    const [projektRes, posRes, bestRes, histRes, dokRes, belegeRes] = await Promise.all([
      supabase.from('projekte').select('*, kontakte!projekte_kontakt_id_fkey(id, firma1, firma2, strasse, plz, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))').eq('id', id).single(),
      supabase.from('projekt_positionen').select('*').eq('projekt_id', id).order('pos_nr'),
      supabase.from('projekt_bestellungen').select('*').eq('projekt_id', id).order('created_at', { ascending: false }),
      supabase.from('projekt_historie').select('*').eq('projekt_id', id).order('erstellt_am', { ascending: false }),
      supabase.from('projekt_dokumente').select('*').eq('projekt_id', id).order('created_at', { ascending: false }),
      supabase.from('belege').select('*').eq('projekt_id', id).order('created_at', { ascending: false }),
    ])

    if (projektRes.error) { navigate('/projekte'); return }
    setProjekt(projektRes.data)
    setPositionen(posRes.data || [])
    setBestellungen(bestRes.data || [])
    // Enrich projekt_dokumente with document details (separate query, FK join was failing)
    const rawDoks = dokRes.data || []
    if (rawDoks.length > 0) {
      const docIds = rawDoks.map(d => d.document_id).filter(Boolean)
      const { data: docDetails } = await supabase
        .from('documents')
        .select('id, betreff, kategorie, dokument_url, created_at')
        .in('id', docIds)
      const docMap = Object.fromEntries((docDetails || []).map(d => [d.id, d]))
      setDokumente(rawDoks.map(d => ({ ...d, documents: docMap[d.document_id] || null })))
    } else {
      setDokumente([])
    }
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
        const confirmed = window.confirm('Dieses Projekt wurde zwischenzeitlich von jemand anderem geändert. Trotzdem speichern? (Änderungen des anderen könnten überschrieben werden)')
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

    if (SONDER_STATUS.includes(newStatus)) {
      updates.vorheriger_status = oldStatus
    }
    if (SONDER_STATUS.includes(oldStatus) && !SONDER_STATUS.includes(newStatus)) {
      updates.vorheriger_status = null
    }

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
    if (!window.confirm('Projekt wirklich löschen?')) return
    await supabase.from('projekte').delete().eq('id', id)
    navigate('/projekte')
  }

  const handleAddNotiz = async (notizText) => {
    const timestamp = new Date().toLocaleString('de-DE')
    const existing = projekt.notizen || ''
    const updated = existing ? `${existing}\n\n[${timestamp}]\n${notizText}` : `[${timestamp}]\n${notizText}`

    await supabase.from('projekte').update({ notizen: updated }).eq('id', id)
    await supabase.from('projekt_historie').insert({
      projekt_id: id,
      aktion: 'notiz',
      feld: 'notizen',
      neuer_wert: notizText,
      erstellt_von: 'Dashboard',
    })
    loadProjekt()
  }

  const handleCreateBestellung = async (newBestellung) => {
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

    await supabase.from('projekt_historie').insert({
      projekt_id: id, aktion: 'bestellung',
      neuer_wert: `Bestellung bei ${newBestellung.lieferant_name} (${newBestellung.bestell_nummer || 'ohne Nr.'})`,
      erstellt_von: 'Dashboard'
    })

    loadProjekt()
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
      <ProjektHeader
        projekt={projekt}
        editing={editing}
        onStartEditing={startEditing}
        onSave={handleSave}
        onCancelEditing={() => setEditing(false)}
        onDelete={handleDelete}
        onNavigateBack={() => navigate('/projekte')}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <ProjektStammdaten
            projekt={projekt}
            kontakt={kontakt}
            adresse={adresse}
            editing={editing}
            editData={editData}
            setEditData={setEditData}
            blockedGates={blockedGates}
            onStatusChange={handleStatusChange}
          />

          <ProjektBestellungen
            bestellungen={bestellungen}
            onCreateBestellung={handleCreateBestellung}
          />

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

          <ProjektBelege projektId={id} projektBelege={projektBelege} />

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

          <ProjektDokumente
            projektId={id}
            dokumente={dokumente}
            blockedGates={blockedGates}
            onReload={loadProjekt}
          />

          <ProjektEmails projektEmails={projektEmails} />

          <ProjektNotizen projekt={projekt} onAddNotiz={handleAddNotiz} />
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

      {/* Positionen (full width) */}
      <ProjektPositionen positionen={positionen} />
    </div>
  )
}
