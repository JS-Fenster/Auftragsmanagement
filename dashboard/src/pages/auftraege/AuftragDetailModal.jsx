import { useState, useCallback } from 'react'
import { apiFetch } from '../../lib/api'
import { AUFTRAG_STATUS, ERLAUBTE_TRANSITIONS, PRIORITAETEN, ZEITFENSTER } from '../../lib/constants'
import { X, Search, User, MapPin, Phone, Mail, FileText, Clock, Undo2, Save } from 'lucide-react'
import {
  StatusBadge,
  PriorityBadge,
  formatDateTime,
  kundeName,
  kundeAdresse,
  kundeTelefon,
  kundeEmail,
  useDebounce,
  useSectionSubmit,
  SectionFeedback,
  useFormWithUndo,
  UnsavedChangesDialog,
} from './auftragHelpers'
import { useEffect } from 'react'

export default function AuftragDetailModal({ auftrag, onClose, onRefresh }) {
  const a = auftrag
  if (!a) return null

  // ── Dirty-State Form ──
  const form = useFormWithUndo({
    beschreibung: a.beschreibung || '',
    prioritaet: a.prioritaet || 'NORMAL',
    notizen: a.notizen || '',
    auftragstyp: a.auftragstyp || 'Reparaturauftrag',
    kunde_kategorie: a.kunde_kategorie || 'BESTANDSKUNDE',
    erp_kunde_id: a.erp_kunde_id || null,
    neukunde_name: a.neukunde_name || '',
    neukunde_telefon: a.neukunde_telefon || '',
    neukunde_email: a.neukunde_email || '',
    einsatzort_strasse: a.einsatzort_strasse || '',
    einsatzort_plz: a.einsatzort_plz || '',
    einsatzort_ort: a.einsatzort_ort || '',
  })

  // ── Kundensuche fuer Bestandskunde wechseln ──
  const [kundeSearch, setKundeSearch] = useState('')
  const [kundeResults, setKundeResults] = useState([])
  const [selectedKundeName, setSelectedKundeName] = useState(a.kunde_firma || '')
  const debouncedKundeSearch = useDebounce(kundeSearch, 300)

  useEffect(() => {
    if (!debouncedKundeSearch || debouncedKundeSearch.length < 2) {
      setKundeResults([])
      return
    }
    let cancelled = false
    apiFetch(`/reparatur-api/kunden?q=${encodeURIComponent(debouncedKundeSearch)}`)
      .then(data => { if (!cancelled) setKundeResults(Array.isArray(data) ? data : data.kunden || []) })
      .catch(() => { if (!cancelled) setKundeResults([]) })
    return () => { cancelled = true }
  }, [debouncedKundeSearch])

  // ── Unsaved Changes Dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // ── Save Handler ──
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSave = useCallback(async (closeAfter = false) => {
    if (!form.isDirty) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await apiFetch(`/reparatur-api/reparatur/${a.id}/update`, {
        method: 'PATCH',
        body: form.changedValues,
      })
      setSaveSuccess(true)
      setTimeout(() => {
        onRefresh()
        if (closeAfter) onClose()
      }, 500)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }, [a.id, form.isDirty, form.changedValues, onRefresh, onClose])

  // ── Close Handler ──
  const handleClose = useCallback(() => {
    if (form.isDirty) {
      setShowUnsavedDialog(true)
    } else {
      onClose()
    }
  }, [form.isDirty, onClose])

  // ── Status ──
  const statusSection = useSectionSubmit(onRefresh)
  const transitions = ERLAUBTE_TRANSITIONS[a.status] || []
  const [newStatus, setNewStatus] = useState(transitions[0] || '')

  // ── Termin SV1 ──
  const terminSection = useSectionSubmit(onRefresh)
  const [terminSv1, setTerminSv1] = useState(a.termin_sv1 ? a.termin_sv1.slice(0, 10) : '')
  const [zeitfenster, setZeitfenster] = useState(a.zeitfenster || '')

  // ── Outcome SV1 ──
  const outcomeSection = useSectionSubmit(onRefresh)
  const [outcomeSv1, setOutcomeSv1] = useState(a.outcome_sv1 || '')

  // ── Termin SV2 ──
  const terminSv2Section = useSectionSubmit(onRefresh)
  const [terminSv2, setTerminSv2] = useState(a.termin_sv2 ? a.termin_sv2.slice(0, 10) : '')

  // ── Mannstaerke ──
  const mannSection = useSectionSubmit(onRefresh)
  const [mannstaerke, setMannstaerke] = useState(a.mannstaerke != null ? String(a.mannstaerke) : '')

  // Dirty-Feld-Highlight-Style
  const dirtyBg = (field) => form.dirtyFields[field] ? 'bg-yellow-50 ring-1 ring-yellow-300' : ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4" onClick={handleClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-surface-card rounded-xl max-w-3xl w-full mx-auto my-8 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 text-text-muted hover:text-text-secondary z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-0">
          {/* 1. Header */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-text-primary">
              Auftrag {a.auftragsnummer || `#${String(a.id).slice(0, 8)}`}
            </h2>
            <StatusBadge status={a.status} />
            <PriorityBadge priority={a.prioritaet} />
            {form.undoStack.length > 0 && (
              <button
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-text-secondary bg-surface-hover hover:bg-surface-hover rounded-lg transition-colors"
                onClick={form.undo}
                title={`Letzte \u00c4nderung r\u00fcckg\u00e4ngig`}
              >
                <Undo2 className="w-3.5 h-3.5" />
                {`Zur\u00fcck`} ({form.undoStack.length})
              </button>
            )}
          </div>
          <p className="text-sm text-text-secondary">Erstellt: {formatDateTime(a.erstellt_am)}</p>

          {/* 2. Kunden-Info */}
          <div className="border-t border-border-default pt-4 mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1"><User className="w-4 h-4" /> Kunde</h3>

            {/* Kundenkategorie-Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${form.values.kunde_kategorie === 'BESTANDSKUNDE' ? 'bg-brand-light border-blue-300 text-brand-dark' : 'border-border-default text-text-secondary hover:bg-surface-main'}`}
                onClick={() => form.setValue('kunde_kategorie', 'BESTANDSKUNDE')}
              >
                Bestandskunde
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${form.values.kunde_kategorie === 'NEUKUNDE' ? 'bg-brand-light border-blue-300 text-brand-dark' : 'border-border-default text-text-secondary hover:bg-surface-main'}`}
                onClick={() => form.setValue('kunde_kategorie', 'NEUKUNDE')}
              >
                Neukunde
              </button>
            </div>

            {form.values.kunde_kategorie === 'BESTANDSKUNDE' ? (
              <div className="space-y-2">
                <div className="relative">
                  <div className={`flex items-center border border-border-default rounded-lg px-3 py-1.5 ${dirtyBg('erp_kunde_id')}`}>
                    <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
                    <input
                      className="flex-1 text-sm outline-none bg-transparent"
                      placeholder="Bestandskunde suchen..."
                      value={form.values.erp_kunde_id ? selectedKundeName : kundeSearch}
                      onChange={e => {
                        setKundeSearch(e.target.value)
                        if (form.values.erp_kunde_id) {
                          form.setValue('erp_kunde_id', null)
                          setSelectedKundeName('')
                        }
                      }}
                    />
                    {form.values.erp_kunde_id && (
                      <button onClick={() => { form.setValue('erp_kunde_id', null); setSelectedKundeName(''); setKundeSearch('') }} className="text-text-muted hover:text-text-secondary">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {kundeResults.length > 0 && !form.values.erp_kunde_id && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-surface-card border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {kundeResults.map((k, i) => (
                        <button
                          key={k.code || k.id || i}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-main border-b border-border-light last:border-0"
                          onClick={() => {
                            if (k.quelle === 'erp' && k.code) {
                              form.setValue('erp_kunde_id', k.code)
                              setSelectedKundeName(k.firma1 || k.name || '')
                            }
                            setKundeResults([])
                            setKundeSearch('')
                          }}
                        >
                          <div className="font-medium">{k.firma1 || k.name || '\u2013'}</div>
                          <div className="text-xs text-text-secondary">{[k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-primary">
                  <div><span className="text-text-secondary">Name:</span> {kundeName(a)}</div>
                  <div className="flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5 text-text-muted shrink-0" />{kundeAdresse(a)}</div>
                  {kundeTelefon(a) && (
                    <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-text-muted" />{kundeTelefon(a)}</div>
                  )}
                  {kundeEmail(a) && (
                    <div className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-text-muted" />{kundeEmail(a)}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  placeholder="Name *"
                  className={`border border-border-default rounded-lg px-3 py-1.5 text-sm ${dirtyBg('neukunde_name')}`}
                  value={form.values.neukunde_name}
                  onChange={e => form.setValue('neukunde_name', e.target.value)}
                />
                <input
                  placeholder="Telefon"
                  className={`border border-border-default rounded-lg px-3 py-1.5 text-sm ${dirtyBg('neukunde_telefon')}`}
                  value={form.values.neukunde_telefon}
                  onChange={e => form.setValue('neukunde_telefon', e.target.value)}
                />
                <input
                  placeholder="E-Mail"
                  className={`border border-border-default rounded-lg px-3 py-1.5 text-sm ${dirtyBg('neukunde_email')}`}
                  value={form.values.neukunde_email}
                  onChange={e => form.setValue('neukunde_email', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 2b. Einsatzort (abweichend) */}
          <div className="border-t border-border-default pt-4 mt-4">
            <div className="text-sm space-y-2">
              <label className="flex items-center gap-2 text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.values.einsatzort_strasse !== '' || form.values.einsatzort_plz !== '' || form.values.einsatzort_ort !== ''}
                  onChange={e => {
                    if (!e.target.checked) {
                      form.setValue('einsatzort_strasse', '')
                      form.setValue('einsatzort_plz', '')
                      form.setValue('einsatzort_ort', '')
                    }
                  }}
                  className="rounded border-border-default"
                />
                <MapPin className="w-3.5 h-3.5 text-text-muted" />
                Einsatzort abweichend
              </label>
              {(form.values.einsatzort_strasse !== '' || form.values.einsatzort_plz !== '' || form.values.einsatzort_ort !== '') && (
                <div className="grid grid-cols-1 gap-2 pl-6">
                  <input
                    type="text"
                    placeholder={`Stra\u00dfe`}
                    value={form.values.einsatzort_strasse}
                    onChange={e => form.setValue('einsatzort_strasse', e.target.value)}
                    className={`px-2 py-1 border border-border-default rounded text-sm ${dirtyBg('einsatzort_strasse')}`}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="PLZ"
                      value={form.values.einsatzort_plz}
                      onChange={e => form.setValue('einsatzort_plz', e.target.value)}
                      className={`px-2 py-1 border border-border-default rounded text-sm ${dirtyBg('einsatzort_plz')}`}
                    />
                    <input
                      type="text"
                      placeholder="Ort"
                      value={form.values.einsatzort_ort}
                      onChange={e => form.setValue('einsatzort_ort', e.target.value)}
                      className={`col-span-2 px-2 py-1 border border-border-default rounded text-sm ${dirtyBg('einsatzort_ort')}`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Beschreibung */}
          <div className="border-t border-border-default pt-4 mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> Beschreibung</h3>
            <textarea
              className={`w-full border border-border-default rounded-lg px-3 py-2 text-sm min-h-[80px] ${dirtyBg('beschreibung')}`}
              placeholder="Beschreibung des Auftrags..."
              value={form.values.beschreibung}
              onChange={e => form.setValue('beschreibung', e.target.value)}
            />
          </div>

          {/* 3b. Prioritaet */}
          <div className="border-t border-border-default pt-4 mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">{`Priorit\u00e4t`}</h3>
            <select
              className={`border border-border-default rounded-lg px-3 py-1.5 text-sm ${dirtyBg('prioritaet')}`}
              value={form.values.prioritaet}
              onChange={e => form.setValue('prioritaet', e.target.value)}
            >
              {Object.entries(PRIORITAETEN).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* 3c. Notizen */}
          <div className="border-t border-border-default pt-4 mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Notizen</h3>
            <textarea
              className={`w-full border border-border-default rounded-lg px-3 py-2 text-sm min-h-[60px] ${dirtyBg('notizen')}`}
              placeholder="Interne Notizen..."
              value={form.values.notizen}
              onChange={e => form.setValue('notizen', e.target.value)}
            />
          </div>

          {/* Save-Feedback */}
          {saveError && <p className="text-sm text-red-600 mt-2">{saveError}</p>}
          {saveSuccess && <p className="text-sm text-green-600 mt-2">{`\u00c4nderungen gespeichert!`}</p>}

          {/* Speichern-Button */}
          {form.isDirty && (
            <div className="border-t border-border-default pt-4 mt-4">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-btn-primary text-white text-sm font-medium rounded-lg hover:bg-btn-primary-hover disabled:opacity-50 transition-colors"
                disabled={saving}
                onClick={() => handleSave(false)}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Speichern...' : `${form.dirtyCount} \u00c4nderung${form.dirtyCount !== 1 ? 'en' : ''} speichern`}
              </button>
            </div>
          )}

          {/* 4. Status aendern */}
          {transitions.length > 0 && (
            <div className="border-t border-border-default pt-4 mt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2">{`Status \u00e4ndern`}</h3>
              <div className="flex items-center gap-2">
                <select
                  className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                >
                  {transitions.map(t => (
                    <option key={t} value={t}>{AUFTRAG_STATUS[t]?.label || t}</option>
                  ))}
                </select>
                <button
                  className="px-3 py-1.5 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50"
                  disabled={statusSection.submitting || !newStatus}
                  onClick={() => statusSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/status`, { method: 'PATCH', body: { neuer_status: newStatus } })
                  )}
                >
                  {statusSection.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={statusSection.error} success={statusSection.success} />
            </div>
          )}

          {/* 5. Termin SV1 */}
          {['IN_BEARBEITUNG', 'TERMIN_RESERVIERT', 'NICHT_BESTAETIGT', 'NO_SHOW'].includes(a.status) && (
            <div className="border-t border-border-default pt-4 mt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Termin SV1</h3>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Datum</label>
                  <input
                    type="date"
                    className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
                    value={terminSv1}
                    onChange={e => setTerminSv1(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Zeitfenster</label>
                  <select
                    className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
                    value={zeitfenster}
                    onChange={e => setZeitfenster(e.target.value)}
                  >
                    <option value="">{`\u2013 w\u00e4hlen \u2013`}</option>
                    {Object.entries(ZEITFENSTER).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="px-3 py-1.5 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50"
                  disabled={terminSection.submitting || !terminSv1}
                  onClick={() => terminSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/termin`, { method: 'PATCH', body: { termin_sv1: terminSv1, zeitfenster } })
                  )}
                >
                  {terminSection.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={terminSection.error} success={terminSection.success} />
            </div>
          )}

          {/* 6. Outcome SV1 */}
          {['TERMIN_FIX', 'ERLEDIGT'].includes(a.status) && (
            <div className="border-t border-border-default pt-4 mt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Ergebnis SV1</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="outcome" value="A" checked={outcomeSv1 === 'A'} onChange={() => setOutcomeSv1('A')} />
                  A &ndash; Sofort erledigt
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="outcome" value="B" checked={outcomeSv1 === 'B'} onChange={() => setOutcomeSv1('B')} />
                  B &ndash; Folgetermin noetig
                </label>
                <button
                  className="px-3 py-1.5 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50"
                  disabled={outcomeSection.submitting || !outcomeSv1}
                  onClick={() => outcomeSection.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/outcome`, { method: 'PATCH', body: { outcome_sv1: outcomeSv1 } })
                  )}
                >
                  {outcomeSection.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={outcomeSection.error} success={outcomeSection.success} />
            </div>
          )}

          {/* 7. Termin SV2 */}
          {a.outcome_sv1 === 'B' && (
            <div className="border-t border-border-default pt-4 mt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Termin SV2</h3>
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Datum</label>
                  <input
                    type="date"
                    className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
                    value={terminSv2}
                    onChange={e => setTerminSv2(e.target.value)}
                  />
                </div>
                <button
                  className="px-3 py-1.5 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50"
                  disabled={terminSv2Section.submitting || !terminSv2}
                  onClick={() => terminSv2Section.submit(() =>
                    apiFetch(`/reparatur-api/reparatur/${a.id}/termin-sv2`, { method: 'PATCH', body: { termin_sv2: terminSv2 } })
                  )}
                >
                  {terminSv2Section.submitting ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
              <SectionFeedback error={terminSv2Section.error} success={terminSv2Section.success} />
            </div>
          )}

          {/* 8. Mannstaerke */}
          <div className="border-t border-border-default pt-4 mt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">{`Mannst\u00e4rke`}</h3>
            <div className="flex items-center gap-2">
              <select
                className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
                value={mannstaerke}
                onChange={e => setMannstaerke(e.target.value)}
              >
                <option value="">unbekannt</option>
                <option value="1">1 Person</option>
                <option value="2">2 Personen</option>
              </select>
              <button
                className="px-3 py-1.5 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50"
                disabled={mannSection.submitting}
                onClick={() => mannSection.submit(() =>
                  apiFetch(`/reparatur-api/reparatur/${a.id}/mannstaerke`, {
                    method: 'PATCH',
                    body: { mannstaerke: mannstaerke ? Number(mannstaerke) : null }
                  })
                )}
              >
                {mannSection.submitting ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
            <SectionFeedback error={mannSection.error} success={mannSection.success} />
          </div>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          dirtyFields={form.dirtyFields}
          onSaveAndClose={() => { setShowUnsavedDialog(false); handleSave(true) }}
          onDiscard={() => { setShowUnsavedDialog(false); onClose() }}
          onBack={() => setShowUnsavedDialog(false)}
        />
      )}
    </div>
  )
}
