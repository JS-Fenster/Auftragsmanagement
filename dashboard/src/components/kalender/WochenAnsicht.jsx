import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { startOfWeek, addDays, format, isSameDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

const getKontaktName = (kontakt) => {
  if (!kontakt) return 'Unbekannt'
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find((p) => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
}

const formatTime = (isoString) => {
  const d = typeof isoString === 'string' ? parseISO(isoString) : isoString
  return format(d, 'HH:mm')
}

const getMonteurKuerzel = (termin) => {
  if (!termin.termin_ressourcen) return []
  return termin.termin_ressourcen
    .filter((r) => r.ressourcen?.typ === 'monteur')
    .map((r) => ({
      kuerzel: r.ressourcen.kuerzel,
      farbe: r.ressourcen.farbe,
    }))
}

const getFahrzeugId = (termin) => {
  const fahrzeug = termin.termin_ressourcen?.find(
    (r) => r.ressourcen?.typ === 'fahrzeug'
  )
  return fahrzeug?.ressource_id ?? null
}

function TerminKachel({ termin, isContinuation, onTerminClick, onTerminHover, onTerminHoverEnd, onDragStart }) {
  const abgesagt = termin.status === 'abgesagt'
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const monteure = getMonteurKuerzel(termin)
  const kontaktName = getKontaktName(termin.kontakte)

  const handleMouseEnter = (e) => {
    if (onTerminHover) {
      const rect = e.currentTarget.getBoundingClientRect()
      onTerminHover(termin, rect)
    }
  }

  const handleMouseDown = (e) => {
    if (e.button !== 0 || isContinuation) return
    e.preventDefault()
    e.stopPropagation()
    onDragStart?.(termin, e)
  }

  return (
    <div
      className={`
        group w-full text-left rounded-md px-2 py-1.5 text-xs
        transition-all border border-transparent select-none
        hover:shadow-md hover:scale-[1.02] hover:border-white/20
        ${abgesagt ? 'opacity-50' : 'cursor-grab'}
      `}
      style={{
        backgroundColor: abgesagt ? `${farbe}33` : `${farbe}22`,
        borderLeftWidth: '3px',
        borderLeftColor: farbe,
      }}
      onClick={() => onTerminClick?.(termin)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTerminHoverEnd?.()}
      onMouseDown={handleMouseDown}
    >
      {isContinuation ? (
        <div className="flex items-center gap-1 text-text-secondary">
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className={`truncate ${abgesagt ? 'line-through' : ''}`}>Forts.</span>
        </div>
      ) : (
        <>
          <div className={`font-medium truncate ${abgesagt ? 'line-through' : ''}`} style={{ color: farbe }}>
            {termin.ganztaegig ? 'Ganzt.' : formatTime(termin.start_zeit)} {kontaktName}
          </div>
          {!termin.ganztaegig && (
            <div className={`text-text-muted truncate ${abgesagt ? 'line-through' : ''}`}>
              {formatTime(termin.start_zeit)}&ndash;{formatTime(termin.end_zeit)}
            </div>
          )}
        </>
      )}
      {monteure.length > 0 && (
        <div className="flex gap-0.5 mt-1 flex-wrap">
          {monteure.map((m) => (
            <span
              key={m.kuerzel}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: m.farbe || '#6B7280' }}
              title={m.kuerzel}
            >
              {m.kuerzel}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WochenAnsicht({
  termine = [],
  fahrzeuge = [],
  monteure = [],
  currentDate,
  onTerminClick,
  onTerminHover,
  onTerminHoverEnd,
  onSlotClick,
  onDayClick,
  onTerminDrop,
  columnType = 'fahrzeug',
}) {
  const isMonteurView = columnType === 'monteur'
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const tableRef = useRef(null)

  // Drag state
  const [drag, setDrag] = useState(null) // { termin, startX, startY, currentX, currentY, active }
  const [dropTarget, setDropTarget] = useState(null) // { fzId, dayIdx }

  const handleDragStart = useCallback((termin, e) => {
    setDrag({ termin, startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY, active: false })
  }, [])

  useEffect(() => {
    if (!drag) return

    const onMove = (e) => {
      const dx = Math.abs(e.clientX - drag.startX)
      const dy = Math.abs(e.clientY - drag.startY)
      const isActive = drag.active || dx >= 8 || dy >= 8

      setDrag(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY, active: isActive } : null)

      // Find drop target cell
      if (isActive) {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const cell = el?.closest('[data-cell-fz][data-cell-day]')
        if (cell) {
          setDropTarget({ fzId: cell.dataset.cellFz, dayIdx: parseInt(cell.dataset.cellDay) })
        } else {
          setDropTarget(null)
        }
      }
    }

    const onUp = () => {
      if (drag.active && dropTarget && onTerminDrop) {
        const targetDay = weekDays[dropTarget.dayIdx]
        const oldStart = parseISO(drag.termin.start_zeit)
        const oldEnd = parseISO(drag.termin.end_zeit)
        const dur = oldEnd.getTime() - oldStart.getTime()

        // Keep same time, change day
        const newStart = new Date(targetDay)
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
        const newEnd = new Date(newStart.getTime() + dur)

        onTerminDrop(drag.termin.id, newStart.toISOString(), newEnd.toISOString(), dropTarget.fzId)
      } else if (!drag.active) {
        // Was a click, not drag
        onTerminClick?.(drag.termin)
      }
      setDrag(null)
      setDropTarget(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, dropTarget, weekDays, onTerminDrop, onTerminClick])

  // Build lookup: resourceId -> dayIndex -> termine[]
  const grid = useMemo(() => {
    const map = new Map()

    for (const fz of fahrzeuge) {
      const row = new Map()
      for (let d = 0; d < 5; d++) {
        row.set(d, [])
      }
      map.set(fz.id, row)
    }

    for (const termin of termine) {
      const start = parseISO(termin.start_zeit)
      const end = parseISO(termin.end_zeit)

      if (isMonteurView) {
        const monteurIds = (termin.termin_ressourcen || [])
          .filter((r) => r.ressourcen?.typ === 'monteur')
          .map((r) => r.ressource_id)
        for (const mId of monteurIds) {
          if (!map.has(mId)) continue
          const row = map.get(mId)
          for (let d = 0; d < 5; d++) {
            const day = weekDays[d]
            if (isSameDay(start, day)) {
              row.get(d).push({ termin, isContinuation: false })
            } else if (start < day && end > day) {
              row.get(d).push({ termin, isContinuation: true })
            }
          }
        }
      } else {
        const fzId = getFahrzeugId(termin)
        if (!fzId || !map.has(fzId)) continue
        const row = map.get(fzId)
        for (let d = 0; d < 5; d++) {
          const day = weekDays[d]
          if (isSameDay(start, day)) {
            row.get(d).push({ termin, isContinuation: false })
          } else if (start < day && end > day) {
            row.get(d).push({ termin, isContinuation: true })
          }
        }
      }
    }

    return map
  }, [termine, fahrzeuge, weekDays, isMonteurView])

  if (fahrzeuge.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        {isMonteurView ? 'Keine Monteure konfiguriert' : 'Keine Fahrzeuge konfiguriert'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card relative">
      <table ref={tableRef} className="w-full border-collapse min-w-[700px]" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-border-default">
            <th className="w-32 px-3 py-2 text-left text-xs font-semibold text-text-secondary bg-surface-main sticky left-0 z-10">
              {isMonteurView ? 'Monteur' : 'Fahrzeug'}
            </th>
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date())
              return (
                <th
                  key={i}
                  className={`px-2 py-2 text-center text-sm font-semibold border-l border-border-default cursor-pointer hover:bg-surface-hover transition-colors ${
                    isToday ? 'text-brand bg-brand/5' : 'text-text-primary bg-surface-main'
                  }`}
                  onClick={() => onDayClick?.(day)}
                  title="Klick für Tagesansicht"
                >
                  {WEEKDAYS[i]} {format(day, 'dd.MM', { locale: de })}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {fahrzeuge.map((fz) => {
            const row = grid.get(fz.id)
            return (
              <tr key={fz.id} className="border-b border-border-default last:border-b-0">
                <td className="px-3 py-2 align-top bg-surface-main sticky left-0 z-10 border-r border-border-default">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: fz.farbe || '#6B7280' }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">{fz.name}</div>
                    </div>
                  </div>
                </td>
                {weekDays.map((day, dIdx) => {
                  const items = row?.get(dIdx) || []
                  const isToday = isSameDay(day, new Date())
                  const isDropHere = dropTarget?.fzId === fz.id && dropTarget?.dayIdx === dIdx
                  return (
                    <td
                      key={dIdx}
                      data-cell-fz={fz.id}
                      data-cell-day={dIdx}
                      className={`px-1 py-1 align-top border-l border-border-default min-h-[60px] transition-colors ${
                        isDropHere ? 'bg-brand/20 ring-2 ring-brand/40 ring-inset' :
                        isToday ? 'bg-brand/5' : 'bg-surface-card'
                      } ${items.length === 0 && !drag ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
                      onClick={() => {
                        if (items.length === 0 && !drag) {
                          onDayClick?.(day)
                        }
                      }}
                      onDoubleClick={() => {
                        onSlotClick?.(day, fz.id)
                      }}
                    >
                      <div className="flex flex-col gap-1 min-h-[50px]">
                        {items.map(({ termin, isContinuation }) => (
                          <TerminKachel
                            key={`${termin.id}-${isContinuation ? 'cont' : 'main'}`}
                            termin={termin}
                            isContinuation={isContinuation}
                            onTerminClick={drag ? undefined : onTerminClick}
                            onTerminHover={drag ? undefined : onTerminHover}
                            onTerminHoverEnd={drag ? undefined : onTerminHoverEnd}
                            onDragStart={handleDragStart}
                          />
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Drag Ghost */}
      {drag?.active && (
        <div
          className="fixed z-50 pointer-events-none opacity-80 rounded-md px-2 py-1 text-xs shadow-xl max-w-[200px]"
          style={{
            left: drag.currentX + 12,
            top: drag.currentY - 8,
            backgroundColor: (drag.termin.termin_arten?.farbe || '#6B7280') + '40',
            borderLeft: `3px solid ${drag.termin.termin_arten?.farbe || '#6B7280'}`,
          }}
        >
          <div className="font-medium truncate text-text-primary">
            {getKontaktName(drag.termin.kontakte)}
          </div>
          <div className="text-text-muted">
            {formatTime(drag.termin.start_zeit)}–{formatTime(drag.termin.end_zeit)}
          </div>
        </div>
      )}
    </div>
  )
}
