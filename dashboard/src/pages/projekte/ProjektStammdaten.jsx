/**
 * ProjektStammdaten — Stammdaten card with dates, values, address, and status transitions
 */
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronRight, AlertCircle, Building2, Plus, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PROJEKT_PHASEN } from '../../components/StatusBadge'
import { PROJEKT_DOKUMENT_TYPEN } from '../../lib/constants'
import { formatEuro, formatDate, DATE_FIELDS, VALUE_FIELDS, STATUS_FLOW, SONDER_STATUS } from './projektConstants'
import { supabase } from '../../lib/supabase'

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

function StatusTransitions({ projekt, blockedGates, onStatusChange }) {
  const getTransitions = () => {
    const status = projekt?.status
    if (!status) return { forward: [], backward: [], sonder: [], resume: null }

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
    const sonder = idx >= 2 ? SONDER_STATUS : []
    return { forward, backward, sonder, resume: null }
  }

  const { forward, backward, sonder, resume } = getTransitions()
  const hasTransitions = forward.length > 0 || backward.length > 0 || sonder.length > 0 || resume
  if (!hasTransitions) return null

  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
      <div className="px-5 py-3 border-b border-border-default">
        <h2 className="font-semibold text-text-primary">Status aendern</h2>
      </div>
      <div className="p-5 space-y-3">
        {resume && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary uppercase tracking-wide">Fortsetzen:</span>
            <button
              onClick={() => onStatusChange(resume)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
              style={{ backgroundColor: PROJEKT_PHASEN[resume]?.bg, color: PROJEKT_PHASEN[resume]?.text, border: `1px solid ${PROJEKT_PHASEN[resume]?.color}40` }}
            >
              <span className="flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> {PROJEKT_PHASEN[resume]?.label || resume}</span>
            </button>
          </div>
        )}
        {(forward.length > 0 || backward.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {forward.map(({ status, blocked, missingDocs }) => {
              const phase = PROJEKT_PHASEN[status]
              return (
                <div key={status} className="relative group">
                  <button onClick={() => !blocked && onStatusChange(status)}
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
                <button key={status} onClick={() => onStatusChange(status)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                  style={{ backgroundColor: phase.bg, color: phase.text, border: `1px solid ${phase.color}40` }}
                >
                  <span className="flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> {phase.label}</span>
                </button>
              )
            })}
          </div>
        )}
        {sonder.length > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-border-light">
            <span className="text-xs text-text-secondary uppercase tracking-wide">Sonder:</span>
            {sonder.map(status => {
              const phase = PROJEKT_PHASEN[status]
              return (
                <button key={status} onClick={() => onStatusChange(status)}
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
}

function ObjektSelector({ projekt, kontakt, editing, editData, setEditData }) {
  const navigate = useNavigate()
  const [suggestions, setSuggestions] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [objektDetail, setObjektDetail] = useState(null)
  const [showSearch, setShowSearch] = useState(false)

  // Load current objekt detail
  useEffect(() => {
    const objId = editData?.objekt_id || projekt?.objekt_id
    if (!objId) { setObjektDetail(null); return }
    supabase.from('objekte').select('*').eq('id', objId).single()
      .then(({ data }) => setObjektDetail(data))
  }, [editData?.objekt_id, projekt?.objekt_id])

  // Load suggestions when kontakt changes
  useEffect(() => {
    if (!kontakt?.id) { setSuggestions([]); return }
    const loadSuggestions = async () => {
      // 1. Objekte where this kontakt is eigentuemer
      const { data: owned } = await supabase.from('objekte').select('*').eq('eigentuemer_kontakt_id', kontakt.id)
      // 2. Objekte from other projects of this kontakt
      const { data: fromProjects } = await supabase.from('projekte').select('objekt_id, objekte!projekte_objekt_id_fkey(*)').eq('kontakt_id', kontakt.id).not('objekt_id', 'is', null)
      // 3. Objekte matching kontakt address
      let addrMatches = []
      if (kontakt.plz || kontakt.ort) {
        const q = supabase.from('objekte').select('*')
        if (kontakt.plz) q.eq('adresse_plz', kontakt.plz)
        if (kontakt.ort) q.ilike('adresse_ort', kontakt.ort)
        const { data } = await q
        addrMatches = data || []
      }

      const allObj = [...(owned || []), ...(fromProjects || []).map(p => p.objekte).filter(Boolean), ...addrMatches]
      const unique = allObj.filter((o, i, arr) => o && arr.findIndex(x => x.id === o.id) === i)
      setSuggestions(unique)
    }
    loadSuggestions()
  }, [kontakt?.id])

  // Search objekte
  useEffect(() => {
    if (!search || search.length < 2) { setSearchResults([]); return }
    const q = search.toLowerCase()
    supabase.from('objekte').select('*')
      .or(`adresse_strasse.ilike.%${q}%,adresse_ort.ilike.%${q}%,adresse_plz.ilike.%${q}%,bezeichnung.ilike.%${q}%`)
      .limit(10)
      .then(({ data }) => setSearchResults(data || []))
  }, [search])

  const selectObjekt = (obj) => {
    setEditData(d => ({
      ...d,
      objekt_id: obj.id,
      einsatzort_strasse: obj.adresse_strasse || d.einsatzort_strasse,
      einsatzort_plz: obj.adresse_plz || d.einsatzort_plz,
      einsatzort_ort: obj.adresse_ort || d.einsatzort_ort,
    }))
    setShowSearch(false)
    setSearch('')
  }

  const clearObjekt = () => {
    setEditData(d => ({ ...d, objekt_id: null }))
  }

  if (!editing) {
    return (
      <div>
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Objekt / Einsatzort
        </span>
        {objektDetail ? (
          <div className="mt-1 flex items-center gap-2">
            <button onClick={() => navigate('/objekte')} className="text-sm text-brand hover:underline font-medium">
              {objektDetail.adresse_strasse}, {objektDetail.adresse_plz} {objektDetail.adresse_ort}
            </button>
            {objektDetail.bezeichnung && <span className="text-xs text-text-muted">({objektDetail.bezeichnung})</span>}
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-primary">
            {projekt.einsatzort_strasse ? `${projekt.einsatzort_strasse}, ${projekt.einsatzort_plz} ${projekt.einsatzort_ort}` : '-'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1 mb-2">
        <Building2 className="w-3 h-3" /> Objekt / Einsatzort
      </span>

      {/* Current selection */}
      {(editData?.objekt_id || objektDetail) && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-brand/5 border border-brand/20">
          <Building2 className="w-4 h-4 text-brand" />
          <span className="text-sm font-medium text-text-primary flex-1">
            {objektDetail?.adresse_strasse}, {objektDetail?.adresse_plz} {objektDetail?.adresse_ort}
            {objektDetail?.bezeichnung && <span className="text-xs text-text-muted ml-1">({objektDetail.bezeichnung})</span>}
          </span>
          <button onClick={clearObjekt} className="text-xs text-red-500 hover:underline">Entfernen</button>
        </div>
      )}

      {/* Suggestions from Kunde */}
      {!editData?.objekt_id && suggestions.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-text-muted mb-1">Bekannte Objekte für diesen Kunden:</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map(obj => (
              <button key={obj.id} onClick={() => selectObjekt(obj)}
                className="px-2 py-1 text-xs bg-surface-card border border-border-default rounded-lg hover:bg-brand/5 hover:border-brand/30 transition-colors">
                {obj.adresse_strasse}, {obj.adresse_plz} {obj.adresse_ort}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search / Manual */}
      {!editData?.objekt_id && (
        <div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setShowSearch(!showSearch)}
              className="text-xs text-brand hover:underline flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Objekt suchen
            </button>
          </div>

          {showSearch && (
            <div className="mb-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Adresse, PLZ, Ort suchen..."
                className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main outline-none mb-1" />
              {searchResults.length > 0 && (
                <div className="border border-border-default rounded-lg overflow-hidden">
                  {searchResults.map(obj => (
                    <button key={obj.id} onClick={() => selectObjekt(obj)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover border-b border-border-default last:border-b-0">
                      <span className="font-medium">{obj.adresse_strasse}</span>
                      <span className="text-text-muted ml-1">{obj.adresse_plz} {obj.adresse_ort}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fallback: Manual address */}
          <div className="grid grid-cols-3 gap-2">
            <input value={editData.einsatzort_strasse || ''} onChange={e => setEditData(d => ({ ...d, einsatzort_strasse: e.target.value }))}
              placeholder="Straße" className="px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main outline-none" />
            <input value={editData.einsatzort_plz || ''} onChange={e => setEditData(d => ({ ...d, einsatzort_plz: e.target.value }))}
              placeholder="PLZ" className="px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main outline-none" />
            <input value={editData.einsatzort_ort || ''} onChange={e => setEditData(d => ({ ...d, einsatzort_ort: e.target.value }))}
              placeholder="Ort" className="px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main outline-none" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjektStammdaten({ projekt, kontakt, adresse, editing, editData, setEditData, blockedGates, onStatusChange }) {
  return (
    <>
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

          <ObjektSelector projekt={projekt} kontakt={kontakt} editing={editing} editData={editData} setEditData={setEditData} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Verantwortlich" value={projekt.verantwortlich} editing={editing} editValue={editData.verantwortlich} onChange={v => setEditData(d => ({ ...d, verantwortlich: v }))} />
            <Field label="Montage-Team" value={projekt.montage_team} editing={editing} editValue={editData.montage_team} onChange={v => setEditData(d => ({ ...d, montage_team: v }))} />
          </div>

          {/* A-001: Objekt + A-002: Gewaehrleistung */}
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

      {!editing && (
        <StatusTransitions
          projekt={projekt}
          blockedGates={blockedGates}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  )
}
