/**
 * ProjektStammdaten — Stammdaten card with dates, values, address, and status transitions
 */
import { ArrowLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { PROJEKT_PHASEN } from '../../components/StatusBadge'
import { PROJEKT_DOKUMENT_TYPEN } from '../../lib/constants'
import { formatEuro, formatDate, DATE_FIELDS, VALUE_FIELDS, STATUS_FLOW, SONDER_STATUS } from './projektConstants'

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

          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Straße" value={adresse.strasse} editing editValue={editData.einsatzort_strasse} onChange={v => setEditData(d => ({ ...d, einsatzort_strasse: v }))} />
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
