/**
 * BelegFormular — Hauptformular fuer Beleg-Erstellung/-Bearbeitung
 *
 * Beinhaltet: Kopfdaten, Empfaenger, Texte, Positionen, Zusammenfassung
 * Verwendet: BelegPositionenEditor, KundenSuchModal
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Save, Loader2, Search, X, ChevronDown } from 'lucide-react'
import BelegPositionenEditor from './BelegPositionenEditor'
import BelegZahlungen from './BelegZahlungen'
import { KundenSuchModal } from '../budgetangebot/KundenSuche'
import {
  BELEG_TYPEN, BELEG_STATUS, BELEG_EINHEITEN, MWST_OPTIONEN, MWST_STANDARD,
  DEFAULT_TEXTE, formatEuro, calculateBelegSummen, generateBelegNummer, saveBeleg
} from './constants'

const RECHNUNGSTYPEN = ['rechnung', 'abschlagsrechnung', 'schlussrechnung', 'gutschrift']

export default function BelegFormular({ beleg, positionen: initialPositionen, onSaved, onCancel }) {
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
  }))

  const [positionen, setPositionen] = useState(initialPositionen || [])
  const [showKundenSuche, setShowKundenSuche] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // ── Belegnummer generieren (nur bei neuen Belegen) ────────
  useEffect(() => {
    if (!formData.id && !formData.beleg_nummer) {
      generateBelegNummer(formData.beleg_typ).then(nr => {
        setFormData(prev => ({ ...prev, beleg_nummer: nr }))
      })
    }
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
  }, [])

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

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Kopfdaten */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default">
          <h2 className="font-semibold text-text-primary">Kopfdaten</h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div>
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
              <label className="text-xs font-medium text-text-secondary">Gueltig bis</label>
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
          <div>
            <label className="text-xs font-medium text-text-secondary">MwSt.-Satz</label>
            <select
              value={formData.mwst_satz}
              onChange={e => update('mwst_satz', parseFloat(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {MWST_OPTIONEN.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empfaenger */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Empfaenger</h2>
          <button
            onClick={() => setShowKundenSuche(true)}
            className="text-sm text-brand hover:text-brand-dark flex items-center gap-1"
          >
            <Search className="h-4 w-4" /> Kunde suchen
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
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
            <label className="text-xs font-medium text-text-secondary">Ansprechpartner</label>
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
      </div>

      {/* Einleitungstext */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default">
          <h2 className="font-semibold text-text-primary">Einleitungstext</h2>
        </div>
        <div className="p-5">
          <textarea
            value={formData.einleitungstext}
            onChange={e => update('einleitungstext', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y"
          />
        </div>
      </div>

      {/* Positionen */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default">
          <h2 className="font-semibold text-text-primary">Positionen</h2>
        </div>
        <div className="p-5">
          <BelegPositionenEditor positionen={positionen} setPositionen={setPositionen} />
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default">
          <h2 className="font-semibold text-text-primary">Zusammenfassung</h2>
        </div>
        <div className="p-5">
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
              <label className="text-xs font-medium text-text-secondary">Rabatt (%)</label>
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

      {/* Zahlungsbedingungen (nur bei Rechnungstypen) */}
      {isRechnungstyp && (
        <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
          <div className="px-5 py-3 border-b border-border-default">
            <h2 className="font-semibold text-text-primary">Zahlungsbedingungen</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
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
      )}

      {/* Zahlungseingaenge (nur bei Rechnungstypen, gespeichert, nicht Entwurf) */}
      {isRechnungstyp && formData.id && formData.status !== 'entwurf' && (
        <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
          <div className="px-5 py-3 border-b border-border-default">
            <h2 className="font-semibold text-text-primary">Zahlungseingaenge</h2>
          </div>
          <div className="p-5">
            <BelegZahlungen
              belegId={formData.id}
              bruttoSumme={summen.brutto_summe}
              status={formData.status}
            />
          </div>
        </div>
      )}

      {/* Abschlagsrechnung-Details */}
      {formData.beleg_typ === 'abschlagsrechnung' && (
        <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
          <div className="px-5 py-3 border-b border-border-default">
            <h2 className="font-semibold text-text-primary">Abschlagsrechnung</h2>
          </div>
          <div className="p-5 grid grid-cols-3 gap-4">
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

      {/* Schlusstext */}
      <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
        <div className="px-5 py-3 border-b border-border-default">
          <h2 className="font-semibold text-text-primary">Schlusstext</h2>
        </div>
        <div className="p-5">
          <textarea
            value={formData.schlusstext}
            onChange={e => update('schlusstext', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y"
          />
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
