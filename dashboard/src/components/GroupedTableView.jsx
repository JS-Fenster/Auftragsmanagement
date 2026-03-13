import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react'
import { PROJEKT_PHASEN, PrioritaetBadge } from './StatusBadge'
import { PHASE_FLOW, SONDER_STATUS } from '../lib/constants'

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
    anfrage: projekt.created_at,
    angebot: projekt.angebots_datum,
    auftrag: projekt.auftrags_datum,
    bestellt: projekt.bestell_datum,
    ab_erhalten: projekt.ab_datum,
    lieferung_geplant: projekt.liefertermin_geplant,
    montagebereit: projekt.montage_datum,
    abnahme: projekt.abnahme_datum,
    rechnung: projekt.rechnung_datum,
    bezahlt: projekt.bezahlt_datum,
    erledigt: projekt.erledigt_datum,
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

const ALL_PHASES = [...PHASE_FLOW, ...SONDER_STATUS]

export default function GroupedTableView({ projekte, alerts, onProjektClick }) {
  const [collapsed, setCollapsed] = useState(new Set())

  // Auto-expand phases that have alerts
  useEffect(() => {
    const alertPhases = new Set(alerts.map(a => a.projekt?.status).filter(Boolean))
    setCollapsed(prev => {
      const next = new Set(prev)
      alertPhases.forEach(p => next.delete(p))
      return next
    })
  }, [alerts])

  // Group projects by phase
  const grouped = useMemo(() => {
    const map = {}
    for (const phase of ALL_PHASES) {
      map[phase] = []
    }
    for (const p of projekte) {
      if (map[p.status]) {
        map[p.status].push(p)
      }
    }
    return map
  }, [projekte])

  // Alert lookup by project id
  const alertByProjekt = useMemo(() => {
    const map = {}
    for (const a of alerts) {
      if (a.projekt?.id) map[a.projekt.id] = a
    }
    return map
  }, [alerts])

  const togglePhase = (phase) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(phase)) {
        next.delete(phase)
      } else {
        next.add(phase)
      }
      return next
    })
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-surface-card">
      {ALL_PHASES.map(phase => {
        const items = grouped[phase]
        if (!items || items.length === 0) return null

        const phaseInfo = PROJEKT_PHASEN[phase]
        if (!phaseInfo) return null

        const isCollapsed = collapsed.has(phase)
        const groupWert = items.reduce((sum, p) => sum + (p.wert || 0), 0)

        return (
          <div key={phase}>
            {/* Group Header */}
            <button
              onClick={() => togglePhase(phase)}
              className="w-full flex items-center justify-between px-3 bg-surface-main border-b hover:bg-surface-hover transition-colors cursor-pointer"
              style={{ height: 36 }}
            >
              <div className="flex items-center gap-2">
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
                }
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: phaseInfo.color }}
                />
                <span className="text-sm font-semibold text-text-primary">{phaseInfo.label}</span>
                <span
                  className="text-xs font-medium rounded-full px-2 py-0.5"
                  style={{ backgroundColor: phaseInfo.color, color: '#fff' }}
                >
                  {items.length}
                </span>
              </div>
              <span className="text-xs text-text-secondary">{formatEuro(groupWert)}</span>
            </button>

            {/* Group Body */}
            {!isCollapsed && (
              <div>
                {items.map(p => {
                  const days = daysInPhase(p)
                  const alert = alertByProjekt[p.id]

                  return (
                    <div
                      key={p.id}
                      onClick={() => onProjektClick(p.id)}
                      className="flex items-center px-3 border-b hover:bg-surface-main cursor-pointer"
                      style={{ height: 36 }}
                    >
                      <span className="font-mono text-xs text-text-secondary flex-shrink-0" style={{ width: 90 }}>
                        {p.projekt_nr || '–'}
                      </span>
                      <span className="flex-1 text-sm font-medium text-text-primary truncate min-w-0">
                        {kontaktName(p.kontakt)}
                      </span>
                      <span className="text-xs text-text-secondary text-right flex-shrink-0" style={{ width: 100 }}>
                        {formatEuro(p.wert)}
                      </span>
                      <span
                        className="text-xs text-right flex-shrink-0"
                        style={{ width: 100, color: daysColor(days) }}
                      >
                        {days != null ? `Seit ${days} Tagen` : '–'}
                      </span>
                      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 70 }}>
                        {p.prioritaet && p.prioritaet !== 'normal' && (
                          <PrioritaetBadge prioritaet={p.prioritaet} />
                        )}
                      </span>
                      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 28 }}>
                        {alert && (
                          <AlertTriangle
                            className="w-4 h-4"
                            style={{ color: alert.severity === 'critical' ? '#DC2626' : '#F59E0B' }}
                          />
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
