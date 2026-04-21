import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  X, MapPin, Building2, AlertTriangle, Wrench, Star, Plus, Trash2,
  Edit3, Save, Briefcase, ClipboardList, Receipt, Package, UserPlus,
  ChevronDown, ChevronRight, Landmark
} from 'lucide-react'
import {
  formatDate, formatEur, getDisplayName,
  SourceBadge, RoleBadge, TypBadge, KundeLieferantBadge, StatusBadge,
  DETAIL_TYPE_ICON
} from './KundenBadges'
import ExpandableSection from './ExpandableSection'
import AddDetailForm from './AddDetailForm'
import AddPersonForm from './AddPersonForm'

export default function KontaktDetailModal({ kontaktId, onClose }) {
  const [kontakt, setKontakt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editStamm, setEditStamm] = useState(false)
  const [stammForm, setStammForm] = useState({})
  const [stammSaving, setStammSaving] = useState(false)
  const [addingDetailFor, setAddingDetailFor] = useState(null)
  const [addingPerson, setAddingPerson] = useState(false)

  // Buchhaltung & Zahlung (Welle 1 Dokumentenkette)
  const [buchhExpanded, setBuchhExpanded] = useState(false)
  const [editBuchh, setEditBuchh] = useState(false)
  const [buchhForm, setBuchhForm] = useState({})
  const [buchhSaving, setBuchhSaving] = useState(false)

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

  // Buchhaltungs-Daten edit
  const startEditBuchh = () => {
    setBuchhForm({
      ust_id: kontakt.ust_id || '',
      steuernummer: kontakt.steuernummer || '',
      iban: kontakt.iban || '',
      bic: kontakt.bic || '',
      bank_name: kontakt.bank_name || '',
      kontoinhaber: kontakt.kontoinhaber || '',
      debitoren_konto: kontakt.debitoren_konto || '',
      kreditoren_konto: kontakt.kreditoren_konto || '',
      default_zahlungsziel_tage: kontakt.default_zahlungsziel_tage ?? '',
      default_skonto_prozent: kontakt.default_skonto_prozent ?? '',
      default_skonto_tage: kontakt.default_skonto_tage ?? '',
      leitweg_id: kontakt.leitweg_id || '',
      rechnungs_email: kontakt.rechnungs_email || '',
      bestell_email: kontakt.bestell_email || '',
    })
    setEditBuchh(true)
  }

  const saveBuchh = async () => {
    setBuchhSaving(true)
    const toNum = (v) => (v === '' || v == null) ? null : Number(v)
    const toText = (v) => (v?.trim() || null)
    await supabase.from('kontakte').update({
      ust_id: toText(buchhForm.ust_id),
      steuernummer: toText(buchhForm.steuernummer),
      iban: toText(buchhForm.iban),
      bic: toText(buchhForm.bic),
      bank_name: toText(buchhForm.bank_name),
      kontoinhaber: toText(buchhForm.kontoinhaber),
      debitoren_konto: toText(buchhForm.debitoren_konto),
      kreditoren_konto: toText(buchhForm.kreditoren_konto),
      default_zahlungsziel_tage: toNum(buchhForm.default_zahlungsziel_tage),
      default_skonto_prozent: toNum(buchhForm.default_skonto_prozent),
      default_skonto_tage: toNum(buchhForm.default_skonto_tage),
      leitweg_id: toText(buchhForm.leitweg_id),
      rechnungs_email: toText(buchhForm.rechnungs_email),
      bestell_email: toText(buchhForm.bestell_email),
    }).eq('id', kontakt.id)
    setBuchhSaving(false)
    setEditBuchh(false)
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
        <div className="relative bg-surface-card rounded-xl shadow-2xl w-full max-w-5xl p-12 flex items-center justify-center"
          onClick={e => e.stopPropagation()}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-text-secondary">Lade Kontakt...</span>
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

      <div className="relative bg-surface-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-surface-card border-b border-border-light px-6 py-4 flex items-start justify-between rounded-t-xl z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-text-primary">{displayName}</h2>
              <SourceBadge hasErp={hasErp} />
              <KundeLieferantBadge istKunde={kontakt.ist_kunde} istLieferant={kontakt.ist_lieferant} />
              <TypBadge typ={kontakt.typ} />
            </div>
            {kontakt.kundennummer && (
              <p className="text-sm text-text-secondary mt-0.5">Kundennr. {kontakt.kundennummer}</p>
            )}
            {hasErp && (
              <p className="text-xs text-text-muted mt-0.5">ERP-Code: {kontakt.erp_kunden_code}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover transition-colors">
            <X className="w-5 h-5 text-text-muted" />
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
            <h3 className="text-sm font-semibold text-text-primary">Stammdaten</h3>
            {!editStamm ? (
              <button onClick={startEditStamm} className="flex items-center gap-1 text-xs text-brand hover:text-blue-800">
                <Edit3 className="w-3.5 h-3.5" /> Bearbeiten
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditStamm(false)} className="text-xs text-text-secondary hover:text-text-primary">Abbrechen</button>
                <button onClick={saveStamm} disabled={stammSaving}
                  className="flex items-center gap-1 text-xs text-brand hover:text-blue-800 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {stammSaving ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            )}
          </div>

          {editStamm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Firma 1</label>
                <input value={stammForm.firma1} onChange={e => setStammForm(f => ({ ...f, firma1: e.target.value }))}
                  className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Firma 2</label>
                <input value={stammForm.firma2} onChange={e => setStammForm(f => ({ ...f, firma2: e.target.value }))}
                  className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">Straße</label>
                <input value={stammForm.strasse} onChange={e => setStammForm(f => ({ ...f, strasse: e.target.value }))}
                  className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">PLZ</label>
                <input value={stammForm.plz} onChange={e => setStammForm(f => ({ ...f, plz: e.target.value }))}
                  className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ort</label>
                <input value={stammForm.ort} onChange={e => setStammForm(f => ({ ...f, ort: e.target.value }))}
                  className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">Hinweis</label>
                <input value={stammForm.hinweis_kontakt} onChange={e => setStammForm(f => ({ ...f, hinweis_kontakt: e.target.value }))}
                  className="w-full text-sm border border-border-default rounded px-3 py-1.5" placeholder="Hinweis zum Kontakt" />
              </div>
              <div className="sm:col-span-2 flex gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={stammForm.ist_kunde} onChange={e => setStammForm(f => ({ ...f, ist_kunde: e.target.checked }))}
                    className="rounded border-border-default text-brand focus:ring-brand" />
                  Kunde
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={stammForm.ist_lieferant} onChange={e => setStammForm(f => ({ ...f, ist_lieferant: e.target.checked }))}
                    className="rounded border-border-default text-purple-600 focus:ring-purple-500" />
                  Lieferant
                </label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {kontakt.firma1 && (
                <div className="flex items-center gap-2 text-text-primary">
                  <Building2 className="w-4 h-4 text-text-muted shrink-0" />
                  <span>{kontakt.firma1}{kontakt.firma2 ? ` / ${kontakt.firma2}` : ''}</span>
                </div>
              )}
              {(kontakt.strasse || kontakt.plz || kontakt.ort) && (
                <div className="flex items-center gap-2 text-text-primary">
                  <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                  <span>{[kontakt.strasse, [kontakt.plz, kontakt.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buchhaltung & Zahlung — kollabierbar */}
        <div className="px-6 py-4 border-t border-border-light">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setBuchhExpanded(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-brand transition-colors"
            >
              {buchhExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Landmark className="w-4 h-4 text-text-muted" />
              Buchhaltung &amp; Zahlung
              {!buchhExpanded && (kontakt.iban || kontakt.ust_id || kontakt.default_zahlungsziel_tage) && (
                <span className="text-xs text-text-muted font-normal ml-1">(gepflegt)</span>
              )}
            </button>
            {buchhExpanded && !editBuchh && (
              <button onClick={startEditBuchh} className="flex items-center gap-1 text-xs text-brand hover:text-blue-800">
                <Edit3 className="w-3.5 h-3.5" /> Bearbeiten
              </button>
            )}
            {buchhExpanded && editBuchh && (
              <div className="flex gap-2">
                <button onClick={() => setEditBuchh(false)} className="text-xs text-text-secondary hover:text-text-primary">Abbrechen</button>
                <button onClick={saveBuchh} disabled={buchhSaving}
                  className="flex items-center gap-1 text-xs text-brand hover:text-blue-800 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {buchhSaving ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            )}
          </div>

          {buchhExpanded && (
            editBuchh ? (
              <div className="space-y-4">
                {/* Steuer */}
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Steuer</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">USt-ID</label>
                      <input value={buchhForm.ust_id} onChange={e => setBuchhForm(f => ({ ...f, ust_id: e.target.value }))}
                        placeholder="DE123456789"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Steuernummer</label>
                      <input value={buchhForm.steuernummer} onChange={e => setBuchhForm(f => ({ ...f, steuernummer: e.target.value }))}
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                  </div>
                </div>

                {/* Bankverbindung */}
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Bankverbindung</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-text-secondary mb-1">IBAN</label>
                      <input value={buchhForm.iban} onChange={e => setBuchhForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))}
                        placeholder="DE12 3456 7890 1234 5678 90"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">BIC</label>
                      <input value={buchhForm.bic} onChange={e => setBuchhForm(f => ({ ...f, bic: e.target.value.toUpperCase() }))}
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Bank</label>
                      <input value={buchhForm.bank_name} onChange={e => setBuchhForm(f => ({ ...f, bank_name: e.target.value }))}
                        placeholder="z.B. Sparkasse Amberg"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-text-secondary mb-1">Kontoinhaber (falls abweichend)</label>
                      <input value={buchhForm.kontoinhaber} onChange={e => setBuchhForm(f => ({ ...f, kontoinhaber: e.target.value }))}
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                  </div>
                </div>

                {/* Zahlungsbedingungen */}
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Zahlungsbedingungen (Default)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Zahlungsziel (Tage)</label>
                      <input type="number" min="0" max="365"
                        value={buchhForm.default_zahlungsziel_tage}
                        onChange={e => setBuchhForm(f => ({ ...f, default_zahlungsziel_tage: e.target.value }))}
                        placeholder="14"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Skonto %</label>
                      <input type="number" step="0.01" min="0" max="20"
                        value={buchhForm.default_skonto_prozent}
                        onChange={e => setBuchhForm(f => ({ ...f, default_skonto_prozent: e.target.value }))}
                        placeholder="0.00"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Skonto-Frist (Tage)</label>
                      <input type="number" min="0" max="90"
                        value={buchhForm.default_skonto_tage}
                        onChange={e => setBuchhForm(f => ({ ...f, default_skonto_tage: e.target.value }))}
                        placeholder="0"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                  </div>
                </div>

                {/* DATEV */}
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">DATEV-Kontonummern</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Debitoren-Konto (Kunden)</label>
                      <input value={buchhForm.debitoren_konto} onChange={e => setBuchhForm(f => ({ ...f, debitoren_konto: e.target.value }))}
                        placeholder="z.B. 10000-69999"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Kreditoren-Konto (Lieferant)</label>
                      <input value={buchhForm.kreditoren_konto} onChange={e => setBuchhForm(f => ({ ...f, kreditoren_konto: e.target.value }))}
                        placeholder="z.B. 70000-99999"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5 font-mono" />
                    </div>
                  </div>
                </div>

                {/* Kommunikation */}
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">E-Rechnung &amp; Kommunikation</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Rechnungs-Email</label>
                      <input type="email" value={buchhForm.rechnungs_email}
                        onChange={e => setBuchhForm(f => ({ ...f, rechnungs_email: e.target.value }))}
                        placeholder="buchhaltung@..."
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                    </div>
                    {kontakt.ist_lieferant && (
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Bestell-Email</label>
                        <input type="email" value={buchhForm.bestell_email}
                          onChange={e => setBuchhForm(f => ({ ...f, bestell_email: e.target.value }))}
                          placeholder="einkauf@..."
                          className="w-full text-sm border border-border-default rounded px-3 py-1.5" />
                      </div>
                    )}
                    <div className={kontakt.ist_lieferant ? '' : 'sm:col-span-2'}>
                      <label className="block text-xs text-text-secondary mb-1">Leitweg-ID (E-Rechnung B2G)</label>
                      <input value={buchhForm.leitweg_id}
                        onChange={e => setBuchhForm(f => ({ ...f, leitweg_id: e.target.value }))}
                        placeholder="991-XXXXX-XX"
                        className="w-full text-sm border border-border-default rounded px-3 py-1.5 font-mono" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {kontakt.ust_id && <div><span className="text-text-secondary">USt-ID:</span> <span className="text-text-primary font-mono">{kontakt.ust_id}</span></div>}
                {kontakt.steuernummer && <div><span className="text-text-secondary">Steuernr.:</span> <span className="text-text-primary font-mono">{kontakt.steuernummer}</span></div>}
                {kontakt.iban && <div className="sm:col-span-2"><span className="text-text-secondary">IBAN:</span> <span className="text-text-primary font-mono">{kontakt.iban}</span>{kontakt.bic && <span className="text-text-muted ml-2 font-mono">BIC {kontakt.bic}</span>}</div>}
                {kontakt.bank_name && <div><span className="text-text-secondary">Bank:</span> <span className="text-text-primary">{kontakt.bank_name}</span></div>}
                {kontakt.kontoinhaber && <div><span className="text-text-secondary">Inhaber:</span> <span className="text-text-primary">{kontakt.kontoinhaber}</span></div>}
                {kontakt.default_zahlungsziel_tage != null && <div><span className="text-text-secondary">Zahlungsziel:</span> <span className="text-text-primary">{kontakt.default_zahlungsziel_tage} Tage</span></div>}
                {kontakt.default_skonto_prozent != null && kontakt.default_skonto_prozent > 0 && <div><span className="text-text-secondary">Skonto:</span> <span className="text-text-primary">{kontakt.default_skonto_prozent}% / {kontakt.default_skonto_tage} Tage</span></div>}
                {kontakt.debitoren_konto && <div><span className="text-text-secondary">Debitor:</span> <span className="text-text-primary font-mono">{kontakt.debitoren_konto}</span></div>}
                {kontakt.kreditoren_konto && <div><span className="text-text-secondary">Kreditor:</span> <span className="text-text-primary font-mono">{kontakt.kreditoren_konto}</span></div>}
                {kontakt.rechnungs_email && <div className="sm:col-span-2"><span className="text-text-secondary">Rechnungs-Email:</span> <span className="text-text-primary">{kontakt.rechnungs_email}</span></div>}
                {kontakt.bestell_email && <div className="sm:col-span-2"><span className="text-text-secondary">Bestell-Email:</span> <span className="text-text-primary">{kontakt.bestell_email}</span></div>}
                {kontakt.leitweg_id && <div><span className="text-text-secondary">Leitweg-ID:</span> <span className="text-text-primary font-mono">{kontakt.leitweg_id}</span></div>}
                {!kontakt.ust_id && !kontakt.iban && !kontakt.default_zahlungsziel_tage && !kontakt.debitoren_konto && !kontakt.rechnungs_email && (
                  <div className="sm:col-span-2 text-text-muted italic">Noch keine Buchhaltungsdaten gepflegt — "Bearbeiten" klicken zum Hinzufügen.</div>
                )}
              </div>
            )
          )}
        </div>

        {/* Kontaktpersonen */}
        <div className="px-6 py-4 border-t border-border-light">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Kontaktpersonen ({(kontakt.kontakt_personen || []).length})</h3>

          <div className="space-y-4">
            {(kontakt.kontakt_personen || []).map(person => {
              const fullName = [person.anrede, person.vorname, person.nachname].filter(Boolean).join(' ')
              const details = person.kontakt_details || []

              return (
                <div key={person.id} className="bg-surface-main rounded-lg p-3">
                  {/* Person header */}
                  <div className="flex items-center gap-2 mb-2">
                    {person.ist_hauptkontakt && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    <span className="font-medium text-sm text-text-primary">{fullName || '(Unbenannt)'}</span>
                    <RoleBadge rolle={person.rolle} />
                    {person.hinweis && (
                      <span className="text-xs text-text-secondary italic ml-2">({person.hinweis})</span>
                    )}
                  </div>

                  {/* Details list */}
                  {details.length > 0 && (
                    <div className="space-y-1 ml-6">
                      {details.map(d => {
                        const DIcon = DETAIL_TYPE_ICON[d.typ] || DETAIL_TYPE_ICON.telefon
                        return (
                          <div key={d.id} className="flex items-center gap-2 text-sm group">
                            <DIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span className="text-xs text-text-secondary w-20 shrink-0">{d.label}</span>
                            <span className="text-text-primary">{d.wert}</span>
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
                      className="flex items-center gap-1 text-xs text-brand hover:text-blue-800 mt-2 ml-6">
                      <Plus className="w-3 h-3" /> Kontaktweg hinzufügen
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
              className="flex items-center gap-1 text-sm text-brand hover:text-blue-800 mt-3">
              <UserPlus className="w-4 h-4" /> Person hinzufügen
            </button>
          )}
        </div>

        {/* Summary Cards */}
        {hasErp && !relLoading && (
          <div className="px-6 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-main rounded-lg px-3 py-2">
              <p className="text-xs text-text-secondary">Projekte</p>
              <p className="text-lg font-bold text-text-primary">{projekte.length}</p>
            </div>
            <div className="bg-surface-main rounded-lg px-3 py-2">
              <p className="text-xs text-text-secondary">Angebotswert</p>
              <p className="text-lg font-bold text-green-700">{formatEur(totalAngebotswert)}</p>
            </div>
            <div className="bg-surface-main rounded-lg px-3 py-2">
              <p className="text-xs text-text-secondary">Rechnungen</p>
              <p className="text-lg font-bold text-green-700">{formatEur(totalRechnungswert)}</p>
            </div>
            {offeneRechnungen.length > 0 ? (
              <div className="bg-surface-main rounded-lg px-3 py-2">
                <p className="text-xs text-text-secondary">Offene Rechnungen</p>
                <p className="text-lg font-bold text-red-600">{offeneRechnungen.length}</p>
              </div>
            ) : (
              <div className="bg-surface-main rounded-lg px-3 py-2">
                <p className="text-xs text-text-secondary">Offene Rechnungen</p>
                <p className="text-lg font-bold text-text-muted">0</p>
              </div>
            )}
          </div>
        )}

        {/* Related Data (ERP only) */}
        {hasErp && (
          <div>
            {/* Reparatur-Auftraege */}
            <ExpandableSection
              title="Reparatur-Aufträge (Neu)"
              icon={Wrench}
              color="#6B7280"
              defaultOpen={true}
              loading={relLoading}
              data={auftraege}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-main text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={a.status} />
                        <span className="text-text-primary font-medium truncate">{a.beschreibung || a.auftragstyp || '–'}</span>
                        {a.adresse_ort && <span className="text-text-muted text-xs">· {a.adresse_ort}</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                        {a.termin_sv1 && <span className="text-text-secondary">SV1: {formatDate(a.termin_sv1)}</span>}
                        {a.termin_sv2 && <span className="text-text-secondary">SV2: {formatDate(a.termin_sv2)}</span>}
                        <span className="text-text-muted">{formatDate(a.erstellt_am)}</span>
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
                    <div key={p.code} className="py-2 px-3 rounded-lg hover:bg-surface-main text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-text-secondary bg-surface-hover px-1.5 py-0.5 rounded">{p.nummer}</span>
                          <span className="font-medium text-text-primary truncate">{p.name}</span>
                        </div>
                        <span className="text-text-muted text-xs shrink-0 ml-2">{formatDate(p.datum)}</span>
                      </div>
                      {p.notiz && <p className="text-xs text-text-secondary mt-1 ml-16 truncate">{p.notiz}</p>}
                    </div>
                  ))}
                </div>
              )}
            />

            {/* Angebote / Auftraege */}
            <ExpandableSection
              title="Angebote / Aufträge (ERP)"
              icon={ClipboardList}
              color="#6B7280"
              loading={relLoading}
              data={angebote}
              renderItems={(items) => (
                <div className="space-y-1">
                  {items.map(a => {
                    const projekt = projektMap[a.projekt_code]
                    return (
                      <div key={a.code} className="py-2 px-3 rounded-lg hover:bg-surface-main text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.auftrags_datum ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Auftrag</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-surface-hover text-text-secondary">Angebot</span>
                            )}
                            {a.nummer && <span className="font-mono text-xs text-text-secondary">{a.nummer}</span>}
                            {projekt && <span className="text-text-secondary truncate text-xs">· {projekt.nummer}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                            <span className="text-text-primary font-medium">{formatEur(a.wert)}</span>
                            {a.auftrags_datum && <span className="text-green-600">Beauftragt {formatDate(a.auftrags_datum)}</span>}
                            <span className="text-text-muted">{formatDate(a.datum)}</span>
                          </div>
                        </div>
                        {projekt && <p className="text-xs text-text-muted mt-0.5 ml-16 truncate">{projekt.name}</p>}
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
                      <div key={r.code} className={`py-2 px-3 rounded-lg hover:bg-surface-main text-sm ${istOffen ? 'bg-red-50/50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-text-secondary">{r.nummer}</span>
                            {istOffen && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                <AlertTriangle className="w-3 h-3" />
                                Offen {formatEur(offenerBetrag)}
                                {ra.mahnstufe > 0 && ` · Mahnstufe ${ra.mahnstufe}`}
                              </span>
                            )}
                            {projekt && <span className="text-text-muted text-xs truncate">· {projekt.nummer}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                            <span className="text-text-primary font-medium">{formatEur(r.bruttowert || r.wert)}</span>
                            {r.zahlbar_bis && <span className={istOffen && new Date(r.zahlbar_bis) < new Date() ? 'text-red-500 font-medium' : 'text-text-muted'}>Fällig {formatDate(r.zahlbar_bis)}</span>}
                            <span className="text-text-muted">{formatDate(r.datum)}</span>
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
                      <div key={b.code} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-main text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-text-secondary">{b.nummer}</span>
                          {projekt && <span className="text-text-secondary text-xs truncate">· {projekt.nummer} – {projekt.name}</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                          <span className="text-text-primary font-medium">{formatEur(b.wert)}</span>
                          <span className="text-text-muted">{formatDate(b.datum)}</span>
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
