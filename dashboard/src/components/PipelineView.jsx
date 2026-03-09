import { useState } from 'react'
import StatusBadge, { PROJEKT_PHASEN } from './StatusBadge'
import { PHASE_FLOW, MONTAGE_TEAMS } from '../lib/constants'

const TEAMS_MAP = Object.fromEntries(MONTAGE_TEAMS.map(t => [t.value, t.label]))

const formatEuro = v => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '–'

function kontaktName(k) {
  if (!k) return '–'
  if (k.firma1) return k.firma1
  const hp = k.kontakt_personen?.find(p => p.ist_hauptkontakt) || k.kontakt_personen?.[0]
  if (hp) return [hp.vorname, hp.nachname].filter(Boolean).join(' ')
  return '–'
}

function daysInPhase(projekt) {
  const dateMap = {
    anfrage: projekt.created_at, angebot: projekt.angebots_datum, auftrag: projekt.auftrags_datum,
    bestellt: projekt.bestell_datum, ab_erhalten: projekt.ab_datum,
    lieferung_geplant: projekt.liefertermin_geplant, montagebereit: projekt.montage_datum,
    abnahme: projekt.abnahme_datum, rechnung: projekt.rechnung_datum,
    bezahlt: projekt.bezahlt_datum, erledigt: projekt.erledigt_datum,
  }
  const d = dateMap[projekt.status] || projekt.created_at
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function daysColor(days) {
  if (days == null) return '#6B7280'
  if (days < 0) return '#3B82F6'
  if (days < 7) return '#10B981'
  if (days <= 14) return '#F59E0B'
  return '#DC2626'
}

const SORT_OPTIONS = [
  { key: 'phase', label: 'Phase' },
  { key: 'alter', label: 'Alter' },
  { key: 'wert', label: 'Wert' },
  { key: 'team', label: 'Team' },
]

function sortProjekte(projekte, sortKey) {
  const sorted = [...projekte]
  switch (sortKey) {
    case 'phase':
      return sorted.sort((a, b) => {
        const ai = PHASE_FLOW.indexOf(a.status)
        const bi = PHASE_FLOW.indexOf(b.status)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
    case 'alter':
      return sorted.sort((a, b) => (daysInPhase(b) ?? -1) - (daysInPhase(a) ?? -1))
    case 'wert':
      return sorted.sort((a, b) => ((b.auftrags_wert || b.angebots_wert || 0) - (a.auftrags_wert || a.angebots_wert || 0)))
    case 'team':
      return sorted.sort((a, b) => (a.montage_team || '').localeCompare(b.montage_team || ''))
    default:
      return sorted
  }
}

function PhaseBar({ status }) {
  const currentIdx = PHASE_FLOW.indexOf(status)
  const phaseColor = PROJEKT_PHASEN[status]?.color || '#6B7280'

  return (
    <div className="flex items-center gap-px">
      {PHASE_FLOW.map((_, i) => (
        <div
          key={i}
          style={{
            width: 16,
            height: 6,
            borderRadius: 1,
            backgroundColor: currentIdx >= 0 && i <= currentIdx ? phaseColor : '#E5E7EB',
          }}
        />
      ))}
    </div>
  )
}

export default function PipelineView({ projekte, alerts, onProjektClick }) {
  const [sortKey, setSortKey] = useState('phase')

  const alertMap = {}
  if (alerts) {
    for (const a of alerts) {
      if (a.projekt_id) {
        if (!alertMap[a.projekt_id] || a.severity === 'danger') {
          alertMap[a.projekt_id] = a.severity
        }
      }
    }
  }

  const sorted = sortProjekte(projekte || [], sortKey)

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs text-gray-400 mr-1">Sortieren:</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortKey(opt.key)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              sortKey === opt.key
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {sorted.map(p => {
          const days = daysInPhase(p)
          const alertSeverity = alertMap[p.id]
          const wert = p.auftrags_wert || p.angebots_wert

          return (
            <div
              key={p.id}
              onClick={() => onProjektClick(p.id)}
              className="flex items-center px-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              style={{ height: 40 }}
            >
              {/* Alert dot */}
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                {alertSeverity && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: alertSeverity === 'danger' ? '#DC2626' : '#F59E0B',
                    }}
                  />
                )}
              </div>

              {/* Projekt-Nr */}
              <div className="font-mono text-xs text-gray-500 flex-shrink-0" style={{ width: 90 }}>
                {p.projekt_nr || '–'}
              </div>

              {/* Kunde */}
              <div className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate pr-2">
                {kontaktName(p.kontakte)}
              </div>

              {/* Wert */}
              <div className="text-xs text-gray-600 text-right flex-shrink-0" style={{ width: 100 }}>
                {formatEuro(wert)}
              </div>

              {/* Phase bar */}
              <div className="flex-shrink-0 mx-3" style={{ width: 200 }}>
                <PhaseBar status={p.status} />
              </div>

              {/* Status */}
              <div className="flex-shrink-0" style={{ width: 100 }}>
                <StatusBadge status={p.status} />
              </div>

              {/* Team */}
              <div className="text-xs text-gray-500 flex-shrink-0 truncate" style={{ width: 80 }}>
                {TEAMS_MAP[p.montage_team] || '–'}
              </div>

              {/* Days in phase */}
              <div
                className="text-xs font-medium text-right flex-shrink-0"
                style={{ width: 70, color: daysColor(days) }}
              >
                {days != null ? `${days} Tage` : '–'}
              </div>
            </div>
          )
        })}

        {(!projekte || projekte.length === 0) && (
          <div className="text-center text-sm text-gray-400 py-8">
            Keine Projekte vorhanden
          </div>
        )}
      </div>
    </div>
  )
}
