/**
 * BelegFormular — Hauptformular fuer Beleg-Erstellung/-Bearbeitung
 *
 * Tab-Layout (Welle 2 Etappe 6.1 — 2026-04-22):
 *   Übersicht / Empfänger / Positionen / Texte / Zahlung / Vorschau & Aktion
 * Oben Kern-Info-Leiste (Nummer · Typ · Status · Kunde · Brutto) permanent sichtbar.
 *
 * Verwendet: BelegPositionenEditor, BelegZahlungen, KundenSuchModal
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Save, Loader2, Search, FileText, User, List, AlignLeft, CreditCard, Eye } from 'lucide-react'
import BelegPositionenEditor from './BelegPositionenEditor'
import BelegZahlungen from './BelegZahlungen'
import { KundenSuchModal } from '../budgetangebot/KundenSuche'
import { supabase } from '../../lib/supabase'
import {
  BELEG_TYPEN, BELEG_STATUS, MWST_OPTIONEN, MWST_STANDARD,
  DEFAULT_TEXTE, formatEuro, calculateBelegSummen, generateBelegNummer, saveBeleg
} from './constants'

const RECHNUNGSTYPEN = ['rechnung', 'abschlagsrechnung', 'schlussrechnung', 'gutschrift']

const TABS = [
  { id: 'uebersicht', label: 'Übersicht',  icon: FileText },
  { id: 'empfaenger', label: 'Empfänger',  icon: User },
  { id: 'positionen', label: 'Positionen', icon: List },
  { id: 'texte',      label: 'Texte',      icon: AlignLeft },
  { id: 'zahlung',    label: 'Zahlung',    icon: CreditCard },
  { id: 'vorschau',   label: 'Vorschau & Aktion', icon: Eye },
]

export default function BelegFormular({ beleg, positionen: initialPositionen, onSaved, onCancel, onTypChange }) {
  // ── State ────────────────────────────────────────────────
  const [formData, setFormData] = useState(() => ({
    id: beleg?.id || null,
    projekt_id: beleg?.projekt_id || null,
    beleg_typ: beleg?.beleg_typ || 'angebot',
    beleg_nummer: beleg?.beleg_nummer || '',
    status: beleg?.status || 'entwurf',
    datum: beleg?.datum || new Date().toISOString().split('T')[0],
    gueltig_bis: beleg?.gueltig_bis || '',
    liefer_datum: beleg?.liefer_datum || '',
    leistungs_datum: beleg?.leistungs_datum || '',
    empfaenger_kontakt_id: beleg?.empfaenger_kontakt_id || null,
    empfaenger_firma: beleg?.empfaenger_firma || '',
    empfaenger_name: beleg?.empfaenger_name || '',
    empfaenger_strasse: beleg?.empfaenger_strasse || '',
    empfaenger_plz: beleg?.empfaenger_plz || '',
    empfaenger_ort: beleg?.empfaenger_ort || '',
    betreff: beleg?.betreff || '',
    einleitungstext: beleg?.einleitungstext || DEFAULT_TEXTE[beleg?.beleg_typ || 'angebot']?.einleitung || '',
    schlusstext: beleg?.schlusstext || DEFAULT_TEXTE[beleg?.beleg_typ || 'angebot']?.schluss || '',
    kunden_bestellnummer: beleg?.kunden_bestellnummer || '',
    rabatt_prozent: beleg?.rabatt_prozent || 0,
    mwst_satz: beleg?.mwst_satz ?? MWST_STANDARD,
    zahlungsbedingungen: beleg?.zahlungsbedingungen || '',
    zahlungsziel_tage: beleg?.zahlungsziel_tage || 14,
    skonto_prozent: beleg?.skonto_prozent || 0,
    skonto_tage: beleg?.skonto_tage || 0,
    abschlags_nr: beleg?.abschlags_nr || null,
    abschlags_prozent: beleg?.abschlags_prozent || null,
    abschlags_betrag: beleg?.abschlags_betrag || null,
    parent_id: beleg?.parent_id || null,
    // Welle 2 Etappe 6.2: MUSS-Felder UI
    unser_zeichen: beleg?.unser_zeichen || '',
    ihr_zeichen: beleg?.ihr_zeichen || '',
    kommission: beleg?.kommission || '',
    leistungszeitraum_von: beleg?.leistungszeitraum_von || '',
    leistungszeitraum_bis: beleg?.leistungszeitraum_bis || '',
    geplanter_liefertermin: beleg?.geplanter_liefertermin || '',
    tatsaechlicher_liefertermin: beleg?.tatsaechlicher_liefertermin || null,
    verantwortlicher_mitarbeiter_id: beleg?.verantwortlicher_mitarbeiter_id || null,
    eigene_bankverbindung_id: beleg?.eigene_bankverbindung_id || null,
    interne_notiz: beleg?.interne_notiz || '',
  }))

  const [positionen, setPositionen] = useState(initialPositionen || [])
  const [showKundenSuche, setShowKundenSuche] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('uebersicht')
  const [mitarbeiterListe, setMitarbeiterListe] = useState([])
  const [bankverbindungen, setBankverbindungen] = useState([])

  // ── Belegnummer generieren (nur bei neuen Belegen) ────────
  useEffect(() => {
    if (!formData.id && !formData.beleg_nummer) {
      generateBelegNummer(formData.beleg_typ).then(nr => {
        setFormData(prev => ({ ...prev, beleg_nummer: nr }))
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dropdowns laden (Welle 2 Etappe 6.2) ─────────────────
  useEffect(() => {
    let cancelled = false
    async function loadDropdowns() {
      const [maRes, bankRes] = await Promise.all([
        supabase
          .from('mitarbeiter')
          .select('id, vorname, nachname, rolle')
          .eq('status', 'aktiv')
          .in('rolle', ['buero', 'geschaeftsfuehrung'])
          .order('nachname').order('vorname'),
        supabase
          .from('eigene_bankverbindungen')
          .select('id, bezeichnung, iban, bank_name, ist_default')
          .order('sort_order'),
      ])
      if (cancelled) return
      setMitarbeiterListe(maRes.data || [])
      setBankverbindungen(bankRes.data || [])
      // Default-Bankverbindung bei neuem Beleg auto-auswählen
      if (!formData.id && !formData.eigene_bankverbindung_id) {
        const def = (bankRes.data || []).find(b => b.ist_default)
        if (def) setFormData(prev => ({ ...prev, eigene_bankverbindung_id: def.id }))
      }
    }
    loadDropdowns()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typ-Wechsel: Default-Texte + neue Nummer ─────────────
  const handleTypChange = useCallback(async (newTyp) => {
    const defaults = DEFAULT_TEXTE[newTyp] || {}
    const nummer = await generateBelegNummer(newTyp)
    setFormData(prev => ({
      ...prev,
      beleg_typ: newTyp,
      beleg_nummer: prev.id ? prev.beleg_nummer : nummer,
      einleitungstext: defaults.einleitung || prev.einleitungstext,
      schlusstext: defaults.schluss || prev.schlusstext,
      gueltig_bis: newTyp === 'angebot' ? prev.gueltig_bis : '',
    }))
    onTypChange?.(newTyp)
  }, [onTypChange])

  // ── Kunden-Auswahl ────────────────────────────────────────
  const handleKundeSelect = useCallback((kontakt) => {
    const person = kontakt.personen?.find(p => p.ist_hauptkontakt) || kontakt.personen?.[0]
    setFormData(prev => ({
      ...prev,
      empfaenger_kontakt_id: kontakt.id,
      empfaenger_firma: kontakt.firma1 || '',
      empfaenger_name: person ? `${person.vorname || ''} ${person.nachname || ''}`.trim() : '',
      empfaenger_strasse: kontakt.strasse || '',
      empfaenger_plz: kontakt.plz || '',
      empfaenger_ort: kontakt.ort || '',
    }))
    setShowKundenSuche(false)
  }, [])

  // ── Summen berechnen ──────────────────────────────────────
  const summen = useMemo(() =>
    calculateBelegSummen(positionen, formData.rabatt_prozent, formData.mwst_satz),
    [positionen, formData.rabatt_prozent, formData.mwst_satz]
  )

  // ── Speichern ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setError(null)
    setSaving(true)

    try {
      const result = await saveBeleg(formData, positionen.filter(p => !p._isGruppe))
      if (result.error) {
        setError(result.error.message || 'Fehler beim Speichern')
      } else {
        onSaved?.(result.data)
      }
    } catch (err) {
      setError(err.message || 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }, [formData, positionen, onSaved])

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))
  const isRechnungstyp = RECHNUNGSTYPEN.includes(formData.beleg_typ)

  // Kern-Info-Leiste: Empfänger-Kompakt-Label
  const empfaengerLabel = formData.empfaenger_firma || formData.empfaenger_name || '—'
  const statusLabel = BELEG_STATUS[formData.status]?.label || formData.status
  const typLabel = BELEG_TYPEN[formData.beleg_typ]?.label || formData.beleg_typ

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Kern-Info-Leiste (sticky) */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-xs text-text-muted block">Beleg-Nr.</span>
          <span className="font-semibold text-text-primary">{formData.beleg_nummer || '—'}</span>
        </div>
        <div>
          <span className="text-xs text-text-muted block">Typ</span>
          <span className="font-medium">{typLabel}</span>
        </div>
        <div>
          <span className="text-xs text-text-muted block">Status</span>
          <span className="font-medium">{statusLabel}</span>
        </div>
        <div className="flex-1 min-w-[150px]">
          <span className="text-xs text-text-muted block">Empfänger</span>
          <span className="font-medium truncate">{empfaengerLabel}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-text-muted block">Brutto</span>
          <span className="font-bold text-text-primary">{formatEuro(summen.brutto_summe)}</span>
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="border-b border-border-default flex overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'text-brand border-brand'
                    : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab-Inhalt */}
        <div className="p-5">

          {/* Tab: Übersicht */}
          {activeTab === 'uebersicht' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-text-secondary">Belegtyp *</label>
                <select
                  value={formData.beleg_typ}
                  onChange={e => handleTypChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {Object.entries(BELEG_TYPEN).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Beleg-Nr.</label>
                <input
                  type="text"
                  value={formData.beleg_nummer}
                  onChange={e => update('beleg_nummer', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm bg-surface-main focus:outline-none focus:ring-2 focus:ring-brand"
                  readOnly
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Datum *</label>
                <input
                  type="date"
                  value={formData.datum}
                  onChange={e => update('datum', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Status</label>
                <select
                  value={formData.status}
                  onChange={e => update('status', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {Object.entries(BELEG_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Betreff</label>
                <input
                  type="text"
                  value={formData.betreff}
                  onChange={e => update('betreff', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="z.B. Fensteraustausch EG"
                />
              </div>
              {formData.beleg_typ === 'angebot' && (
                <div>
                  <label className="text-xs font-medium text-text-secondary">Gültig bis</label>
                  <input
                    type="date"
                    value={formData.gueltig_bis}
                    onChange={e => update('gueltig_bis', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-text-secondary">Kunden-Bestell-Nr.</label>
                <input
                  type="text"
                  value={formData.kunden_bestellnummer}
                  onChange={e => update('kunden_bestellnummer', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Optional"
                />
              </div>
              {/* MwSt-Default (temporaer bis Etappe 6.6 Tatbestand pro Position) — eigene Zeile fuer stabiles Layout */}
              <div className="md:col-span-4">
                <div className="md:w-1/4">
                  <label className="text-xs font-medium text-text-secondary">MwSt.-Satz (Default)</label>
                  <select
                    value={formData.mwst_satz}
                    onChange={e => update('mwst_satz', parseFloat(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {MWST_OPTIONEN.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-text-muted mt-1">Wird in Etappe 6.6 durch Tatbestand pro Position ersetzt.</p>
                </div>
              </div>

              {/* Referenzen (MUSS-Felder) */}
              <div className="md:col-span-4 border-t border-border-default pt-4 mt-2">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Referenzen</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Unser Zeichen</label>
                    <input
                      type="text"
                      value={formData.unser_zeichen}
                      onChange={e => update('unser_zeichen', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder="z.B. AS/2026-042"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Ihr Zeichen</label>
                    <input
                      type="text"
                      value={formData.ihr_zeichen}
                      onChange={e => update('ihr_zeichen', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder="Referenz des Kunden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Kommission / Bauvorhaben</label>
                    <input
                      type="text"
                      value={formData.kommission}
                      onChange={e => update('kommission', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder="z.B. BV Müller, EG-West"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Verantwortlich (intern)</label>
                    <select
                      value={formData.verantwortlicher_mitarbeiter_id || ''}
                      onChange={e => update('verantwortlicher_mitarbeiter_id', e.target.value || null)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="">— keiner —</option>
                      {mitarbeiterListe.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.vorname} {m.nachname}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Termine (Leistung/Lieferung) */}
              <div className="md:col-span-4 border-t border-border-default pt-4 mt-2">
                <h3 className="text-sm font-semibold text-text-primary mb-1">Leistung &amp; Lieferung</h3>
                <p className="text-xs text-text-muted mb-3">
                  Leistungszeitraum ist bei Rechnungen ohne Einzelleistungsdatum pflichtig (§14 UStG).
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Leistungszeitraum von</label>
                    <input
                      type="date"
                      value={formData.leistungszeitraum_von}
                      onChange={e => update('leistungszeitraum_von', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Leistungszeitraum bis</label>
                    <input
                      type="date"
                      value={formData.leistungszeitraum_bis}
                      onChange={e => update('leistungszeitraum_bis', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Geplanter Liefertermin</label>
                    <input
                      type="date"
                      value={formData.geplanter_liefertermin}
                      onChange={e => update('geplanter_liefertermin', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div className="text-xs text-text-muted self-end pb-1">
                    Tatsächlicher Liefertermin wird nach Auslieferung über die Belegliste gesetzt.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Empfänger */}
          {activeTab === 'empfaenger' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-text-muted">Rechnungs-/Angebotsempfänger. Bei Freeze wird dieser Stand eingefroren (GoBD).</p>
                <button
                  onClick={() => setShowKundenSuche(true)}
                  className="text-sm text-brand hover:text-brand-dark flex items-center gap-1"
                >
                  <Search className="h-4 w-4" /> Kunde suchen
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-text-secondary">Firma</label>
                  <input
                    type="text"
                    value={formData.empfaenger_firma}
                    onChange={e => update('empfaenger_firma', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">Ansprechpartner / Name</label>
                  <input
                    type="text"
                    value={formData.empfaenger_name}
                    onChange={e => update('empfaenger_name', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-text-secondary">Straße</label>
                  <input
                    type="text"
                    value={formData.empfaenger_strasse}
                    onChange={e => update('empfaenger_strasse', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">PLZ</label>
                    <input
                      type="text"
                      value={formData.empfaenger_plz}
                      onChange={e => update('empfaenger_plz', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-text-secondary">Ort</label>
                    <input
                      type="text"
                      value={formData.empfaenger_ort}
                      onChange={e => update('empfaenger_ort', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Etappe 6.3 folgt: Firma/Privat-Toggle, Email, Telefon, USt-ID, Leitweg-ID.
              </div>
            </div>
          )}

          {/* Tab: Positionen */}
          {activeTab === 'positionen' && (
            <div className="space-y-6">
              <BelegPositionenEditor positionen={positionen} setPositionen={setPositionen} />
              <div className="border-t border-border-default pt-5">
                <h3 className="font-semibold text-text-primary mb-3">Zusammenfassung</h3>
                <div className="max-w-sm ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Netto</span>
                    <span>{formatEuro(summen.netto_summe)}</span>
                  </div>
                  {formData.rabatt_prozent > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Rabatt ({formData.rabatt_prozent}%)</span>
                      <span>- {formatEuro(summen.rabatt_betrag)}</span>
                    </div>
                  )}
                  {formData.rabatt_prozent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Netto nach Rabatt</span>
                      <span>{formatEuro(summen.netto_nach_rabatt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">MwSt. ({formData.mwst_satz}%)</span>
                    <span>{formatEuro(summen.mwst_betrag)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-border-default pt-2">
                    <span>Brutto</span>
                    <span>{formatEuro(summen.brutto_summe)}</span>
                  </div>
                  <div className="pt-2">
                    <label className="text-xs font-medium text-text-secondary">Rabatt gesamt (%)</label>
                    <input
                      type="number"
                      value={formData.rabatt_prozent}
                      onChange={e => update('rabatt_prozent', parseFloat(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      min="0" max="100" step="0.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Texte */}
          {activeTab === 'texte' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">Einleitungstext</label>
                <textarea
                  value={formData.einleitungstext}
                  onChange={e => update('einleitungstext', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">Schlusstext</label>
                <textarea
                  value={formData.schlusstext}
                  onChange={e => update('schlusstext', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y"
                />
              </div>
              <div className="border-t border-border-default pt-5">
                <label className="text-sm font-medium text-text-primary block mb-1">
                  Interne Notiz
                  <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    nicht auf PDF
                  </span>
                </label>
                <p className="text-xs text-text-muted mb-2">
                  Nur intern sichtbar — nicht Teil des Beleg-PDFs für den Kunden.
                </p>
                <textarea
                  value={formData.interne_notiz}
                  onChange={e => update('interne_notiz', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y"
                  placeholder="z.B. Kunde zahlt zögerlich, Nachfassen am..."
                />
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Etappe 6.8 folgt: Rich-Text-Editor für Einleitung/Schluss (Fettdruck, Absätze, Aufzählungen).
              </div>
            </div>
          )}

          {/* Tab: Zahlung */}
          {activeTab === 'zahlung' && (
            <div className="space-y-6">
              {/* Eigene Bankverbindung (immer sichtbar, auch für nicht-Rechnungstypen — Vorausangabe auf Angebot/AB moeglich) */}
              <div>
                <h3 className="font-semibold text-text-primary mb-3">Eigene Bankverbindung</h3>
                <div className="max-w-xl">
                  <label className="text-xs font-medium text-text-secondary">
                    Auf welches Konto zahlen?
                  </label>
                  <select
                    value={formData.eigene_bankverbindung_id || ''}
                    onChange={e => update('eigene_bankverbindung_id', e.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">— keine Auswahl —</option>
                    {bankverbindungen.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bezeichnung} — {b.iban}
                      </option>
                    ))}
                  </select>
                  {bankverbindungen.length === 0 && (
                    <p className="text-xs text-amber-700 mt-1">
                      Keine Bankverbindungen hinterlegt. Anlegen unter Einstellungen → Dokumentenkette.
                    </p>
                  )}
                </div>
              </div>

              {isRechnungstyp ? (
                <>
                  <div className="border-t border-border-default pt-5">
                    <h3 className="font-semibold text-text-primary mb-3">Zahlungsbedingungen</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-text-secondary">Bedingungen</label>
                        <input
                          type="text"
                          value={formData.zahlungsbedingungen}
                          onChange={e => update('zahlungsbedingungen', e.target.value)}
                          className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                          placeholder="z.B. 14 Tage netto, 2% Skonto bei Zahlung innerhalb 7 Tagen"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-secondary">Zahlungsziel (Tage)</label>
                        <input
                          type="number"
                          value={formData.zahlungsziel_tage}
                          onChange={e => update('zahlungsziel_tage', parseInt(e.target.value) || 14)}
                          className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                          min="0"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Skonto %</label>
                          <input
                            type="number"
                            value={formData.skonto_prozent}
                            onChange={e => update('skonto_prozent', parseFloat(e.target.value) || 0)}
                            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            min="0" max="10" step="0.5"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Skonto Tage</label>
                          <input
                            type="number"
                            value={formData.skonto_tage}
                            onChange={e => update('skonto_tage', parseInt(e.target.value) || 0)}
                            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.beleg_typ === 'abschlagsrechnung' && (
                    <div>
                      <h3 className="font-semibold text-text-primary mb-3">Abschlagsrechnung</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Abschlagsnummer</label>
                          <input
                            type="number"
                            value={formData.abschlags_nr || ''}
                            onChange={e => update('abschlags_nr', parseInt(e.target.value) || null)}
                            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            placeholder="1, 2, 3..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Anteil (%)</label>
                          <input
                            type="number"
                            value={formData.abschlags_prozent || ''}
                            onChange={e => update('abschlags_prozent', parseFloat(e.target.value) || null)}
                            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            min="0" max="100" step="1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Festbetrag</label>
                          <input
                            type="number"
                            value={formData.abschlags_betrag || ''}
                            onChange={e => update('abschlags_betrag', parseFloat(e.target.value) || null)}
                            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.id && formData.status !== 'entwurf' && (
                    <div>
                      <h3 className="font-semibold text-text-primary mb-3">Zahlungseingänge</h3>
                      <BelegZahlungen
                        belegId={formData.id}
                        bruttoSumme={summen.brutto_summe}
                        status={formData.status}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-text-muted border-t border-border-default pt-5">
                  Zahlungsbedingungen sind nur bei Rechnungstypen relevant (Rechnung, Abschlag, Schluss, Gutschrift).
                </p>
              )}
            </div>
          )}

          {/* Tab: Vorschau & Aktion */}
          {activeTab === 'vorschau' && (
            <div className="space-y-5">
              <div className="p-6 bg-surface-main border-2 border-dashed border-border-default rounded-lg text-center text-text-muted">
                <Eye className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Live-PDF-Vorschau kommt in Etappe 6.10.</p>
                <p className="text-xs mt-1">Aktuell: Beleg speichern, dann in BelegVorschau ansehen.</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Etappe 6.9 folgt: Button "An Buchhaltung übermitteln" (Freeze via RPC <code>freeze_beleg</code>). Nach Freeze wird der Beleg read-only, nur Status + Mahnstufe bleiben änderbar.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Parent-Info Banner */}
      {formData.parent_id && beleg?._parent_nummer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-sm text-blue-700">
            Erstellt aus {beleg._parent_typ_label || 'Beleg'} <strong>{beleg._parent_nummer}</strong>
          </span>
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Aktionen */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !formData.beleg_nummer}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-btn-primary text-white text-sm font-medium rounded-lg hover:bg-btn-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</>
          ) : (
            <><Save className="w-4 h-4" /> {formData.id ? 'Aktualisieren' : 'Speichern'}</>
          )}
        </button>
      </div>

      {/* Kunden-Suche Modal */}
      {showKundenSuche && (
        <KundenSuchModal
          onSelect={handleKundeSelect}
          onClose={() => setShowKundenSuche(false)}
        />
      )}
    </div>
  )
}
