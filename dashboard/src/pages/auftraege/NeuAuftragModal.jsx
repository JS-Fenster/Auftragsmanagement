import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/api'
import { PRIORITAETEN } from '../../lib/constants'
import { X, Search, MapPin } from 'lucide-react'
import { kundeName, kundeAdresse, useDebounce } from './auftragHelpers'

export default function NeuAuftragModal({ onClose, onRefresh }) {
  const [kundeSearch, setKundeSearch] = useState('')
  const [kundeResults, setKundeResults] = useState([])
  const [selectedKunde, setSelectedKunde] = useState(null)
  const [neukundeMode, setNeukundeMode] = useState(false)
  const [neukunde, setNeukunde] = useState({ name: '', telefon: '', strasse: '', plz: '', ort: '' })
  const [prioritaet, setPrioritaet] = useState('NORMAL')
  const [beschreibung, setBeschreibung] = useState('')
  const [einsatzortAktiv, setEinsatzortAktiv] = useState(false)
  const [einsatzort, setEinsatzort] = useState({ strasse: '', plz: '', ort: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const debouncedSearch = useDebounce(kundeSearch, 300)

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2 || neukundeMode) {
      setKundeResults([])
      return
    }
    let cancelled = false
    apiFetch(`/reparatur-api/kunden?q=${encodeURIComponent(debouncedSearch)}`)
      .then(data => { if (!cancelled) setKundeResults(Array.isArray(data) ? data : data.kunden || []) })
      .catch(() => { if (!cancelled) setKundeResults([]) })
    return () => { cancelled = true }
  }, [debouncedSearch, neukundeMode])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        beschreibung,
        prioritaet,
        kunde_kategorie: neukundeMode ? 'NEUKUNDE' : 'BESTANDSKUNDE',
      }
      if (neukundeMode) {
        body.neukunde_name = neukunde.name
        body.neukunde_telefon = neukunde.telefon
        body.adresse_strasse = neukunde.strasse
        body.adresse_plz = neukunde.plz
        body.adresse_ort = neukunde.ort
      } else if (selectedKunde) {
        if (selectedKunde.quelle === 'manuell') {
          body.manuelle_kunde_id = selectedKunde.id
        } else {
          body.erp_kunde_id = selectedKunde.code
        }
      }
      if (einsatzortAktiv && (einsatzort.strasse || einsatzort.plz || einsatzort.ort)) {
        body.einsatzort_strasse = einsatzort.strasse
        body.einsatzort_plz = einsatzort.plz
        body.einsatzort_ort = einsatzort.ort
      }
      await apiFetch('/reparatur-api/reparatur', { method: 'POST', body })
      onRefresh()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-surface-card rounded-xl max-w-3xl w-full mx-auto my-8 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-secondary">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4">Neuer Auftrag</h2>

          {/* Kundensuche */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-text-primary">Kunde</label>
              <button
                className="text-xs text-brand hover:underline"
                onClick={() => { setNeukundeMode(!neukundeMode); setSelectedKunde(null) }}
              >
                {neukundeMode ? 'Bestandskunde suchen' : 'Neukunde anlegen'}
              </button>
            </div>

            {neukundeMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Name *" className="border border-border-default rounded-lg px-3 py-1.5 text-sm" value={neukunde.name} onChange={e => setNeukunde({ ...neukunde, name: e.target.value })} />
                <input placeholder="Telefon" className="border border-border-default rounded-lg px-3 py-1.5 text-sm" value={neukunde.telefon} onChange={e => setNeukunde({ ...neukunde, telefon: e.target.value })} />
                <input placeholder={`Stra\u00dfe`} className="border border-border-default rounded-lg px-3 py-1.5 text-sm" value={neukunde.strasse} onChange={e => setNeukunde({ ...neukunde, strasse: e.target.value })} />
                <div className="flex gap-2">
                  <input placeholder="PLZ" className="border border-border-default rounded-lg px-3 py-1.5 text-sm w-24" value={neukunde.plz} onChange={e => setNeukunde({ ...neukunde, plz: e.target.value })} />
                  <input placeholder="Ort" className="border border-border-default rounded-lg px-3 py-1.5 text-sm flex-1" value={neukunde.ort} onChange={e => setNeukunde({ ...neukunde, ort: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-border-default rounded-lg px-3 py-1.5">
                  <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
                  <input
                    className="flex-1 text-sm outline-none"
                    placeholder="Kundenname suchen..."
                    value={selectedKunde ? kundeName({ kunde: selectedKunde }) : kundeSearch}
                    onChange={e => { setKundeSearch(e.target.value); setSelectedKunde(null) }}
                  />
                  {selectedKunde && (
                    <button onClick={() => { setSelectedKunde(null); setKundeSearch('') }} className="text-text-muted hover:text-text-secondary">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {kundeResults.length > 0 && !selectedKunde && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-surface-card border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {kundeResults.map((k, i) => (
                      <button
                        key={k.id || k.code || i}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-main border-b border-border-light last:border-0"
                        onClick={() => { setSelectedKunde(k); setKundeResults([]) }}
                      >
                        <div className="font-medium">{kundeName({ kunde: k })}</div>
                        <div className="text-xs text-text-secondary">{kundeAdresse({ kunde: k })}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prioritaet */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-primary mb-1">{`Priorit\u00e4t`}</label>
            <select
              className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
              value={prioritaet}
              onChange={e => setPrioritaet(e.target.value)}
            >
              {Object.entries(PRIORITAETEN).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Beschreibung */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-primary mb-1">Beschreibung *</label>
            <textarea
              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm min-h-[100px]"
              placeholder="Was soll gemacht werden?"
              value={beschreibung}
              onChange={e => setBeschreibung(e.target.value)}
            />
          </div>

          {/* Einsatzort (optional) */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              <input
                type="checkbox"
                checked={einsatzortAktiv}
                onChange={e => {
                  setEinsatzortAktiv(e.target.checked)
                  if (!e.target.checked) setEinsatzort({ strasse: '', plz: '', ort: '' })
                }}
                className="rounded border-border-default"
              />
              <MapPin className="w-4 h-4 text-text-muted" />
              Einsatzort abweichend
            </label>
            {einsatzortAktiv && (
              <div className="grid grid-cols-1 gap-2 pl-6">
                <input
                  placeholder="Strasse"
                  className="border border-border-default rounded-lg px-3 py-1.5 text-sm"
                  value={einsatzort.strasse}
                  onChange={e => setEinsatzort({ ...einsatzort, strasse: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    placeholder="PLZ"
                    className="border border-border-default rounded-lg px-3 py-1.5 text-sm w-24"
                    value={einsatzort.plz}
                    onChange={e => setEinsatzort({ ...einsatzort, plz: e.target.value })}
                  />
                  <input
                    placeholder="Ort"
                    className="border border-border-default rounded-lg px-3 py-1.5 text-sm flex-1"
                    value={einsatzort.ort}
                    onChange={e => setEinsatzort({ ...einsatzort, ort: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Abbrechen</button>
            <button
              className="px-4 py-2 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50"
              disabled={submitting || !beschreibung || (!selectedKunde && !neukundeMode) || (neukundeMode && !neukunde.name)}
              onClick={handleSubmit}
            >
              {submitting ? 'Erstellen...' : 'Auftrag erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
