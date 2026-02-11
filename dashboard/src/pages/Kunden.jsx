import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { AUFTRAG_STATUS } from '../lib/constants'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Search, User, MapPin, Phone, Mail, Building2, ChevronDown, ChevronRight,
  X, FileText, ClipboardList, Receipt, Briefcase, Package, AlertTriangle,
  Wrench, Star, Plus, Trash2, Edit3, Save, Globe, UserPlus, Tag, Truck, Check
} from 'lucide-react'

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

// ─── Badges ────────────────────────────────────────────────

function SourceBadge({ hasErp }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: hasErp ? '#EFF6FF' : '#F0FDF4',
        color: hasErp ? '#1E40AF' : '#166534',
      }}
    >
      {hasErp ? 'ERP' : 'Manuell'}
    </span>
  )
}

function RoleBadge({ rolle }) {
  if (!rolle) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {rolle}
    </span>
  )
}

function TypBadge({ typ }) {
  if (!typ) return null
  const map = {
    privat: { bg: '#F0FDF4', color: '#166534', label: 'Privat' },
    gewerbe: { bg: '#FEF3C7', color: '#92400E', label: 'Gewerbe' },
    oeffentlich: { bg: '#EFF6FF', color: '#1E40AF', label: 'Oeffentlich' },
  }
  const cfg = map[typ] || { bg: '#F3F4F6', color: '#374151', label: typ }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function KundeLieferantBadge({ istKunde, istLieferant }) {
  return (
    <>
      {istKunde && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          Kunde
        </span>
      )}
      {istLieferant && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
          <Truck className="w-3 h-3 mr-1" />Lieferant
        </span>
      )}
    </>
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

// ─── Helper: Display name from kontakt ────────────────────

function getDisplayName(kontakt) {
  if (kontakt.firma1) return kontakt.firma1
  const hauptperson = (kontakt.kontakt_personen || []).find(p => p.ist_hauptkontakt) || (kontakt.kontakt_personen || [])[0]
  if (hauptperson) {
    const parts = [hauptperson.vorname, hauptperson.nachname].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  return '–'
}

function getHauptperson(kontakt) {
  const personen = kontakt.kontakt_personen || []
  return personen.find(p => p.ist_hauptkontakt) || personen[0] || null
}

function getPrimaerDetail(person, typ) {
  if (!person) return null
  const details = person.kontakt_details || []
  return details.find(d => d.typ === typ && d.ist_primaer) || details.find(d => d.typ === typ) || null
}

const DETAIL_TYPE_ICON = {
  telefon: Phone,
  email: Mail,
  fax: Phone,
  website: Globe,
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
            <p className="text-sm text-gray-400 py-2">Keine Eintraege</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inline Add Detail Form ───────────────────────────────

function AddDetailForm({ personId, onSaved, onCancel }) {
  const [typ, setTyp] = useState('telefon')
  const [label, setLabel] = useState('')
  const [wert, setWert] = useState('')
  const [saving, setSaving] = useState(false)

  const defaultLabels = { telefon: 'Telefon', email: 'E-Mail', fax: 'Fax', website: 'Website' }

  const handleSave = async () => {
    if (!wert.trim()) return
    setSaving(true)
    const { error } = await supabase.from('kontakt_details').insert({
      kontakt_person_id: personId,
      typ,
      label: label.trim() || defaultLabels[typ] || typ,
      wert: wert.trim(),
      ist_primaer: false,
    })
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50 rounded-lg">
      <select value={typ} onChange={e => setTyp(e.target.value)}
        className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
        <option value="telefon">Telefon</option>
        <option value="email">E-Mail</option>
        <option value="fax">Fax</option>
        <option value="website">Website</option>
      </select>
      <input value={label} onChange={e => setLabel(e.target.value)}
        placeholder="Label (z.B. Mobil privat)"
        className="text-xs border border-gray-200 rounded px-2 py-1.5 w-32" />
      <input value={wert} onChange={e => setWert(e.target.value)}
        placeholder="Wert"
        className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1" />
      <button onClick={handleSave} disabled={saving || !wert.trim()}
        className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-1.5 rounded hover:bg-gray-200">
        <X className="w-3.5 h-3.5 text-gray-500" />
      </button>
    </div>
  )
}

// ─── Inline Add Person Form ───────────────────────────────

function AddPersonForm({ kontaktId, onSaved, onCancel }) {
  const [anrede, setAnrede] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [rolle, setRolle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nachname.trim()) return
    setSaving(true)
    const { error } = await supabase.from('kontakt_personen').insert({
      kontakt_id: kontaktId,
      anrede: anrede.trim() || null,
      vorname: vorname.trim() || null,
      nachname: nachname.trim(),
      rolle: rolle.trim() || null,
      ist_hauptkontakt: false,
    })
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="p-3 bg-blue-50 rounded-lg mt-3">
      <p className="text-xs font-medium text-blue-700 mb-2">Neue Person hinzufuegen</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={anrede} onChange={e => setAnrede(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
          <option value="">Anrede...</option>
          <option value="Herr">Herr</option>
          <option value="Frau">Frau</option>
        </select>
        <input value={vorname} onChange={e => setVorname(e.target.value)}
          placeholder="Vorname"
          className="text-xs border border-gray-200 rounded px-2 py-1.5" />
        <input value={nachname} onChange={e => setNachname(e.target.value)}
          placeholder="Nachname *"
          className="text-xs border border-gray-200 rounded px-2 py-1.5" />
        <input value={rolle} onChange={e => setRolle(e.target.value)}
          placeholder="Rolle (z.B. Ehepartner)"
          className="text-xs border border-gray-200 rounded px-2 py-1.5" />
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded hover:bg-blue-100 text-blue-700">Abbrechen</button>
        <button onClick={handleSave} disabled={saving || !nachname.trim()}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Speichere...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

// ─── New Kontakt Modal ────────────────────────────────────

function NeuerKontaktModal({ onClose, onCreated }) {
  const [typ, setTyp] = useState('privat')
  const [firma1, setFirma1] = useState('')
  const [firma2, setFirma2] = useState('')
  const [strasse, setStrasse] = useState('')
  const [plz, setPlz] = useState('')
  const [ort, setOrt] = useState('')
  const [istKunde, setIstKunde] = useState(true)
  const [istLieferant, setIstLieferant] = useState(false)
  const [anrede, setAnrede] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [detailTyp, setDetailTyp] = useState('telefon')
  const [detailLabel, setDetailLabel] = useState('')
  const [detailWert, setDetailWert] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    if (!firma1.trim() && !nachname.trim()) {
      setError('Firma oder Nachname muss ausgefuellt sein.')
      return
    }
    setSaving(true)
    setError(null)

    // 1. Create kontakt
    const { data: kontakt, error: kErr } = await supabase.from('kontakte').insert({
      typ,
      firma1: firma1.trim() || null,
      firma2: firma2.trim() || null,
      strasse: strasse.trim() || null,
      plz: plz.trim() || null,
      ort: ort.trim() || null,
      ist_kunde: istKunde,
      ist_lieferant: istLieferant,
    }).select().single()

    if (kErr) {
      setError(kErr.message)
      setSaving(false)
      return
    }

    // 2. Create person (if name given)
    if (nachname.trim()) {
      const { data: person, error: pErr } = await supabase.from('kontakt_personen').insert({
        kontakt_id: kontakt.id,
        anrede: anrede.trim() || null,
        vorname: vorname.trim() || null,
        nachname: nachname.trim(),
        ist_hauptkontakt: true,
        rolle: 'Eigentuemer',
      }).select().single()

      if (pErr) {
        setError(pErr.message)
        setSaving(false)
        return
      }

      // 3. Create detail (if given)
      if (detailWert.trim() && person) {
        const defaultLabels = { telefon: 'Telefon', email: 'E-Mail', fax: 'Fax', website: 'Website' }
        await supabase.from('kontakt_details').insert({
          kontakt_person_id: person.id,
          typ: detailTyp,
          label: detailLabel.trim() || defaultLabels[detailTyp] || detailTyp,
          wert: detailWert.trim(),
          ist_primaer: true,
        })
      }
    }

    setSaving(false)
    onCreated(kontakt)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-lg font-bold text-gray-900">Neuer Kontakt</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Typ */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
            <select value={typ} onChange={e => setTyp(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="privat">Privat</option>
              <option value="gewerbe">Gewerbe</option>
              <option value="oeffentlich">Oeffentlich</option>
            </select>
          </div>

          {/* Firma */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Firma 1</label>
              <input value={firma1} onChange={e => setFirma1(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Firma 2</label>
              <input value={firma2} onChange={e => setFirma2(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Strasse</label>
            <input value={strasse} onChange={e => setStrasse(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PLZ</label>
              <input value={plz} onChange={e => setPlz(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
              <input value={ort} onChange={e => setOrt(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Checkboxen */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={istKunde} onChange={e => setIstKunde(e.target.checked)}
                className="rounded border-gray-300" />
              Ist Kunde
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={istLieferant} onChange={e => setIstLieferant(e.target.checked)}
                className="rounded border-gray-300" />
              Ist Lieferant
            </label>
          </div>

          {/* Erste Person */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Erste Kontaktperson</p>
            <div className="grid grid-cols-3 gap-3">
              <select value={anrede} onChange={e => setAnrede(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <option value="">Anrede...</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
              </select>
              <input value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Vorname"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2" />
              <input value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Nachname"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Erster Kontaktweg */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Erster Kontaktweg</p>
            <div className="grid grid-cols-3 gap-3">
              <select value={detailTyp} onChange={e => setDetailTyp(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <option value="telefon">Telefon</option>
                <option value="email">E-Mail</option>
                <option value="fax">Fax</option>
                <option value="website">Website</option>
              </select>
              <input value={detailLabel} onChange={e => setDetailLabel(e.target.value)} placeholder="Label (optional)"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2" />
              <input value={detailWert} onChange={e => setDetailWert(e.target.value)} placeholder="Wert (Nr./Adresse)"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-end gap-3 rounded-b-xl">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700">Abbrechen</button>
          <button onClick={handleCreate} disabled={saving}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Erstelle...' : 'Kontakt anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Kontakt Detail Modal ─────────────────────────────────

function KontaktDetailModal({ kontaktId, onClose }) {
  const [kontakt, setKontakt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editStamm, setEditStamm] = useState(false)
  const [stammForm, setStammForm] = useState({})
  const [stammSaving, setStammSaving] = useState(false)
  const [addingDetailFor, setAddingDetailFor] = useState(null) // person_id or null
  const [addingPerson, setAddingPerson] = useState(false)

  // Related data
  const [relLoading, setRelLoading] = useState(true)
  const [projekte, setProjekte] = useState([])
  const [angebote, setAngebote] = useState([])
  const [rechnungen, setRechnungen] = useState([])
  const [offenePosten, setOffenePosten] = useState([])
  const [bestellungen, setBestellungen] = useState([])
  const [auftraege, setAuftraege] = useState([])

  // Load kontakt with nested data
  const loadKontakt = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('kontakte')
      .select('*, kontakt_personen!kontakt_id(*, kontakt_details(*))')
      .eq('id', kontaktId)
      .single()
    if (!error && data) {
      // Sort: hauptkontakt first
      data.kontakt_personen = (data.kontakt_personen || []).sort((a, b) => (b.ist_hauptkontakt ? 1 : 0) - (a.ist_hauptkontakt ? 1 : 0))
      setKontakt(data)
    }
    setLoading(false)
  }, [kontaktId])

  useEffect(() => { loadKontakt() }, [loadKontakt])

  // Load related ERP data
  useEffect(() => {
    if (!kontakt || !kontakt.erp_kunden_code) { setRelLoading(false); return }
    const code = kontakt.erp_kunden_code
    setRelLoading(true)

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
      supabase.from('auftraege')
        .select('id, status, prioritaet, beschreibung, erstellt_am, adresse_strasse, adresse_ort, termin_sv1, termin_sv2, auftragstyp')
        .eq('erp_kunde_id', code)
        .order('erstellt_am', { ascending: false }),
    ]).then(async ([projRes, angRes, rechRes, auftrRes]) => {
      const proj = projRes.data || []
      setProjekte(proj)
      setAngebote(angRes.data || [])

      const rech = rechRes.data || []
      setRechnungen(rech)
      if (rech.length > 0) {
        const rechCodes = rech.map(r => r.code)
        const { data: raData } = await supabase.from('erp_ra')
          .select('code, r_code, r_nummer, r_betrag, bez_summe, mahnstufe, faellig_datum')
          .in('r_code', rechCodes)
        setOffenePosten(raData || [])
      }

      const projCodes = proj.map(p => p.code)
      if (projCodes.length > 0) {
        const { data: bestData } = await supabase.from('erp_bestellungen')
          .select('code, nummer, datum, wert, projekt_code, lieferant_code')
          .in('projekt_code', projCodes)
          .order('datum', { ascending: false }).limit(50)
        setBestellungen(bestData || [])
      }

      setAuftraege(auftrRes.data || [])
      setRelLoading(false)
    })
  }, [kontakt?.erp_kunden_code])

  // Stammdaten edit
  const startEditStamm = () => {
    setStammForm({
      firma1: kontakt.firma1 || '',
      firma2: kontakt.firma2 || '',
      strasse: kontakt.strasse || '',
      plz: kontakt.plz || '',
      ort: kontakt.ort || '',
      hinweis_kontakt: kontakt.hinweis_kontakt || '',
      ist_kunde: kontakt.ist_kunde ?? true,
      ist_lieferant: kontakt.ist_lieferant ?? false,
    })
    setEditStamm(true)
  }

  const saveStamm = async () => {
    setStammSaving(true)
    await supabase.from('kontakte').update({
      firma1: stammForm.firma1.trim() || null,
      firma2: stammForm.firma2.trim() || null,
      strasse: stammForm.strasse.trim() || null,
      plz: stammForm.plz.trim() || null,
      ort: stammForm.ort.trim() || null,
      hinweis_kontakt: stammForm.hinweis_kontakt.trim() || null,
      ist_kunde: stammForm.ist_kunde,
      ist_lieferant: stammForm.ist_lieferant,
    }).eq('id', kontakt.id)
    setStammSaving(false)
    setEditStamm(false)
    loadKontakt()
  }

  // Delete detail
  const deleteDetail = async (detailId) => {
    await supabase.from('kontakt_details').delete().eq('id', detailId)
    loadKontakt()
  }

  if (loading || !kontakt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl p-12 flex items-center justify-center"
          onClick={e => e.stopPropagation()}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Lade Kontakt...</span>
        </div>
      </div>
    )
  }

  const displayName = getDisplayName(kontakt)
  const hasErp = !!kontakt.erp_kunden_code

  // Build lookup maps
  const projektMap = Object.fromEntries(projekte.map(p => [p.code, p]))
  const raByRechnung = {}
  offenePosten.forEach(ra => { raByRechnung[ra.r_code] = ra })

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

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between rounded-t-xl z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <SourceBadge hasErp={hasErp} />
              <KundeLieferantBadge istKunde={kontakt.ist_kunde} istLieferant={kontakt.ist_lieferant} />
              <TypBadge typ={kontakt.typ} />
            </div>
            {kontakt.kundennummer && (
              <p className="text-sm text-gray-500 mt-0.5">Kundennr. {kontakt.kundennummer}</p>
            )}
            {hasErp && (
              <p className="text-xs text-gray-400 mt-0.5">ERP-Code: {kontakt.erp_kunden_code}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Hinweis (gelb hervorgehoben) */}
        {kontakt.hinweis_kontakt && !editStamm && (
          <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {kontakt.hinweis_kontakt}
          </div>
        )}

        {/* Stammdaten */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Stammdaten</h3>
            {!editStamm ? (
              <button onClick={startEditStamm} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Edit3 className="w-3.5 h-3.5" /> Bearbeiten
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditStamm(false)} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                <button onClick={saveStamm} disabled={stammSaving}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {stammSaving ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            )}
          </div>

          {editStamm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Firma 1</label>
                <input value={stammForm.firma1} onChange={e => setStammForm(f => ({ ...f, firma1: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Firma 2</label>
                <input value={stammForm.firma2} onChange={e => setStammForm(f => ({ ...f, firma2: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Strasse</label>
                <input value={stammForm.strasse} onChange={e => setStammForm(f => ({ ...f, strasse: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">PLZ</label>
                <input value={stammForm.plz} onChange={e => setStammForm(f => ({ ...f, plz: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ort</label>
                <input value={stammForm.ort} onChange={e => setStammForm(f => ({ ...f, ort: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Hinweis</label>
                <input value={stammForm.hinweis_kontakt} onChange={e => setStammForm(f => ({ ...f, hinweis_kontakt: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5" placeholder="Hinweis zum Kontakt" />
              </div>
              <div className="sm:col-span-2 flex gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={stammForm.ist_kunde} onChange={e => setStammForm(f => ({ ...f, ist_kunde: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Kunde
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={stammForm.ist_lieferant} onChange={e => setStammForm(f => ({ ...f, ist_lieferant: e.target.checked }))}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  Lieferant
                </label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {kontakt.firma1 && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{kontakt.firma1}{kontakt.firma2 ? ` / ${kontakt.firma2}` : ''}</span>
                </div>
              )}
              {(kontakt.strasse || kontakt.plz || kontakt.ort) && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{[kontakt.strasse, [kontakt.plz, kontakt.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kontaktpersonen */}
        <div className="px-6 py-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Kontaktpersonen ({(kontakt.kontakt_personen || []).length})</h3>

          <div className="space-y-4">
            {(kontakt.kontakt_personen || []).map(person => {
              const fullName = [person.anrede, person.vorname, person.nachname].filter(Boolean).join(' ')
              const details = person.kontakt_details || []

              return (
                <div key={person.id} className="bg-gray-50 rounded-lg p-3">
                  {/* Person header */}
                  <div className="flex items-center gap-2 mb-2">
                    {person.ist_hauptkontakt && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    <span className="font-medium text-sm text-gray-800">{fullName || '(Unbenannt)'}</span>
                    <RoleBadge rolle={person.rolle} />
                    {person.hinweis && (
                      <span className="text-xs text-gray-500 italic ml-2">({person.hinweis})</span>
                    )}
                  </div>

                  {/* Details list */}
                  {details.length > 0 && (
                    <div className="space-y-1 ml-6">
                      {details.map(d => {
                        const DIcon = DETAIL_TYPE_ICON[d.typ] || Phone
                        return (
                          <div key={d.id} className="flex items-center gap-2 text-sm group">
                            <DIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-500 w-20 shrink-0">{d.label}</span>
                            <span className="text-gray-700">{d.wert}</span>
                            {d.ist_primaer && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                            <button onClick={() => deleteDetail(d.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 transition-opacity ml-auto">
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add detail form */}
                  {addingDetailFor === person.id ? (
                    <AddDetailForm personId={person.id} onSaved={() => { setAddingDetailFor(null); loadKontakt() }} onCancel={() => setAddingDetailFor(null)} />
                  ) : (
                    <button onClick={() => setAddingDetailFor(person.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2 ml-6">
                      <Plus className="w-3 h-3" /> Kontaktweg hinzufuegen
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add person */}
          {addingPerson ? (
            <AddPersonForm kontaktId={kontakt.id} onSaved={() => { setAddingPerson(false); loadKontakt() }} onCancel={() => setAddingPerson(false)} />
          ) : (
            <button onClick={() => setAddingPerson(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-3">
              <UserPlus className="w-4 h-4" /> Person hinzufuegen
            </button>
          )}
        </div>

        {/* Summary Cards */}
        {hasErp && !relLoading && (
          <div className="px-6 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Projekte</p>
              <p className="text-lg font-bold text-gray-900">{projekte.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Angebotswert</p>
              <p className="text-lg font-bold text-green-700">{formatEur(totalAngebotswert)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Rechnungen</p>
              <p className="text-lg font-bold text-green-700">{formatEur(totalRechnungswert)}</p>
            </div>
            {offeneRechnungen.length > 0 ? (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Offene Rechnungen</p>
                <p className="text-lg font-bold text-red-600">{offeneRechnungen.length}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Offene Rechnungen</p>
                <p className="text-lg font-bold text-gray-400">0</p>
              </div>
            )}
          </div>
        )}

        {/* Related Data (ERP only) */}
        {hasErp && (
          <div>
            {/* Reparatur-Auftraege */}
            <ExpandableSection
              title="Reparatur-Auftraege (Neu)"
              icon={Wrench}
              color="#6B7280"
              defaultOpen={true}
              loading={relLoading}
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
                        {a.termin_sv1 && <span className="text-gray-600">SV1: {formatDate(a.termin_sv1)}</span>}
                        {a.termin_sv2 && <span className="text-gray-600">SV2: {formatDate(a.termin_sv2)}</span>}
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
              color="#6B7280"
              defaultOpen={projekte.length > 0 && projekte.length <= 10}
              loading={relLoading}
              data={projekte}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(p => (
                    <div key={p.code} className="py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{p.nummer}</span>
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

            {/* Angebote / Auftraege */}
            <ExpandableSection
              title="Angebote / Auftraege (ERP)"
              icon={ClipboardList}
              color="#6B7280"
              loading={relLoading}
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
              color="#6B7280"
              count={`${rechnungen.length}${offeneRechnungen.length > 0 ? ` (${offeneRechnungen.length} offen)` : ''}`}
              loading={relLoading}
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
                            {r.zahlbar_bis && <span className={istOffen && new Date(r.zahlbar_bis) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'}>Faellig {formatDate(r.zahlbar_bis)}</span>}
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
              color="#6B7280"
              loading={relLoading}
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
  const [selectedKontaktId, setSelectedKontaktId] = useState(null)
  const [showNeuerKontakt, setShowNeuerKontakt] = useState(false)
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

      // Strategy: 3 parallel queries, then merge by kontakt.id
      const [kontakteRes, personenRes, detailsRes] = await Promise.all([
        // 1. Search kontakte by firma/ort/plz
        supabase.from('kontakte')
          .select('id, firma1, firma2, strasse, plz, ort, erp_kunden_code, ist_kunde, ist_lieferant, typ, kontakt_personen!kontakt_id(id, anrede, vorname, nachname, rolle, ist_hauptkontakt, kontakt_details(id, typ, label, wert, ist_primaer))')
          .or(`firma1.ilike.${term},firma2.ilike.${term},ort.ilike.${term},plz.ilike.${term}`)
          .limit(100),
        // 2. Search kontakt_personen by name
        supabase.from('kontakt_personen')
          .select('kontakt_id, vorname, nachname')
          .or(`vorname.ilike.${term},nachname.ilike.${term}`)
          .limit(50),
        // 3. Search kontakt_details by value (phone/email)
        supabase.from('kontakt_details')
          .select('kontakt_person_id, wert, kontakt_personen!inner(kontakt_id)')
          .ilike('wert', term)
          .limit(50),
      ])

      if (cancelled) return

      // Build a Map of kontakt_id -> kontakt from first query
      const kontaktMap = new Map()
      for (const k of (kontakteRes.data || [])) {
        kontaktMap.set(k.id, k)
      }

      // Collect kontakt IDs from person/detail searches that we need to load
      const missingIds = new Set()
      for (const p of (personenRes.data || [])) {
        if (!kontaktMap.has(p.kontakt_id)) missingIds.add(p.kontakt_id)
      }
      for (const d of (detailsRes.data || [])) {
        const kid = d.kontakt_personen?.kontakt_id
        if (kid && !kontaktMap.has(kid)) missingIds.add(kid)
      }

      // Load missing kontakte in batch
      if (missingIds.size > 0) {
        const { data: extraKontakte } = await supabase.from('kontakte')
          .select('id, firma1, firma2, strasse, plz, ort, erp_kunden_code, ist_kunde, ist_lieferant, typ, kontakt_personen!kontakt_id(id, anrede, vorname, nachname, rolle, ist_hauptkontakt, kontakt_details(id, typ, label, wert, ist_primaer))')
          .in('id', Array.from(missingIds))
        for (const k of (extraKontakte || [])) {
          kontaktMap.set(k.id, k)
        }
      }

      if (cancelled) return
      setResults(Array.from(kontaktMap.values()))
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
          <h1 className="text-2xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 mt-1">Kunden und Kontakte durchsuchen</p>
        </div>
        <button onClick={() => setShowNeuerKontakt(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> Neuer Kontakt
        </button>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-10 bg-white pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Firma, Name, Ort, PLZ, Telefon oder E-Mail suchen... (min. 2 Zeichen)"
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
          <p>Suchbegriff eingeben um Kontakte zu finden</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Kontakte gefunden fuer &ldquo;{debouncedTerm}&rdquo;</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">{results.length} Ergebnis{results.length !== 1 ? 'se' : ''}</p>
          <div className="grid gap-3">
            {results.map(k => {
              const displayName = getDisplayName(k)
              const hauptperson = getHauptperson(k)
              const telefonDetail = getPrimaerDetail(hauptperson, 'telefon')
              const emailDetail = getPrimaerDetail(hauptperson, 'email')
              const adresse = [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
              const hasErp = !!k.erp_kunden_code

              return (
                <div
                  key={k.id}
                  onClick={() => setSelectedKontaktId(k.id)}
                  className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{displayName}</span>
                        <SourceBadge hasErp={hasErp} />
                        <KundeLieferantBadge istKunde={k.ist_kunde} istLieferant={k.ist_lieferant} />
                      </div>
                      {k.firma2 && <p className="text-sm text-gray-500 truncate">{k.firma2}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                        {adresse && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {adresse}
                          </span>
                        )}
                        {telefonDetail && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {telefonDetail.wert}
                          </span>
                        )}
                        {emailDetail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {emailDetail.wert}
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
