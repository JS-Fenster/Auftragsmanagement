import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { format, startOfWeek, addDays, isSameDay, parseISO, isToday } from 'date-fns'
import { de } from 'date-fns/locale'
import { getKontaktName, getMonteurKuerzel, getFahrzeugName } from '../../lib/helpers'

const SLOT_START = 7
const SLOT_END = 17
const HOURS = SLOT_END - SLOT_START
const SNAP_MINUTES = 30
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

const timeToPct = (timeStr) => {
  const [h, m] =
    typeof timeStr === 'string' ? timeStr.split(':').map(Number) : [timeStr.getHours(), timeStr.getMinutes()]
  return ((h - SLOT_START + m / 60) / HOURS) * 100
}

const pctToTime = (pct) => {
  const totalMinutes = (pct / 100) * HOURS * 60 + SLOT_START * 60
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
  const h = Math.floor(snapped / 60)
  const m = snapped % 60
  return { h, m, str: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

function TimeSlotLabels() {
  const slots = []
  for (let h = SLOT_START; h < SLOT_END; h++) slots.push(h)
  return (
    <div className="absolute inset-0">
      {slots.map((h) => (
        <div key={h}
          className="absolute left-0 right-0 text-[10px] text-text-muted text-right pr-2"
          style={{ top: `${((h - SLOT_START) / HOURS) * 100}%` }}>
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  )
}

function GridLines() {
  const lines = []
  for (let h = SLOT_START; h < SLOT_END; h++) {
    const pct = ((h - SLOT_START) / HOURS) * 100
    lines.push(<div key={`h-${h}`} className="absolute left-0 right-0 border-t border-border-default" style={{ top: `${pct}%` }} />)
    lines.push(<div key={`hm-${h}`} className="absolute left-0 right-0 border-t border-border-default/40 border-dashed" style={{ top: `${pct + 50 / HOURS}%` }} />)
  }
  return <>{lines}</>
}

function CurrentTimeMarker() {
  const now = new Date()
  const pct = timeToPct(now)
  if (pct < 0 || pct > 100) return null
  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${pct}%` }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
        <div className="flex-1 border-t-2 border-red-500" />
        <span className="text-[10px] text-red-500 font-medium ml-1 bg-surface-card px-1 rounded">{format(now, 'HH:mm')}</span>
      </div>
    </div>
  )
}

function layoutOverlapping(termine) {
  if (termine.length === 0) return []
  const sorted = [...termine].sort((a, b) => {
    const aStart = parseISO(a.start_zeit)
    const bStart = parseISO(b.start_zeit)
    return aStart - bStart || (parseISO(b.end_zeit) - parseISO(a.end_zeit))
  })
  const placed = []
  for (const termin of sorted) {
    const tStart = parseISO(termin.start_zeit).getTime()
    let col = 0
    while (true) {
      const endInCol = placed.filter(p => p.col === col).reduce((max, p) => Math.max(max, parseISO(p.termin.end_zeit).getTime()), 0)
      if (endInCol <= tStart) break
      col++
    }
    placed.push({ termin, col })
  }
  const maxCol = placed.reduce((max, p) => Math.max(max, p.col), 0) + 1
  return placed.map(p => ({ termin: p.termin, left: p.col / maxCol, width: 1 / maxCol }))
}

function TerminBlock({ termin, left, width, onTerminClick, onTerminHover, onTerminHoverEnd, onDragStart }) {
  const abgesagt = termin.status === 'abgesagt'
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const monteure = getMonteurKuerzel(termin)
  const kontaktName = getKontaktName(termin.kontakte)
  const fahrzeug = getFahrzeugName(termin)
  const start = parseISO(termin.start_zeit)
  const end = parseISO(termin.end_zeit)
  const topPct = timeToPct(start)
  const heightPct = Math.max(timeToPct(end) - topPct, 2)

  const handleMouseEnter = (e) => {
    if (onTerminHover) { const rect = e.currentTarget.getBoundingClientRect(); onTerminHover(termin, rect) }
  }
  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onDragStart?.(termin, e)
  }

  return (
    <div
      data-termin-block="true"
      className={`absolute rounded-md px-1 py-0.5 text-[10px] overflow-hidden transition-shadow hover:shadow-lg hover:z-20 group ${abgesagt ? 'opacity-50' : 'cursor-grab'}`}
      style={{
        top: `${topPct}%`, height: `${heightPct}%`,
        left: `calc(${left * 100}% + 2px)`, width: `calc(${width * 100}% - 4px)`,
        backgroundColor: abgesagt ? `${farbe}20` : `${farbe}25`,
        borderLeft: `3px solid ${farbe}`, zIndex: 10,
      }}
      onClick={(e) => { e.stopPropagation(); onTerminClick?.(termin) }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTerminHoverEnd?.()}
      onMouseDown={handleMouseDown}
    >
      {heightPct < 4 ? (
        <div className="flex items-center gap-0.5 min-w-0">
          {monteure.slice(0, 2).map((m) => (
            <span key={m.kuerzel} className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[7px] font-bold text-white shrink-0"
              style={{ backgroundColor: m.farbe || '#6B7280' }}>{m.kuerzel}</span>
          ))}
          <span className={`truncate font-medium ${abgesagt ? 'line-through' : ''}`} style={{ color: farbe }}>{kontaktName}</span>
        </div>
      ) : heightPct < 6 ? (
        <>
          <div className="flex items-center gap-0.5">
            {monteure.slice(0, 3).map((m) => (
              <span key={m.kuerzel} className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0"
                style={{ backgroundColor: m.farbe || '#6B7280' }}>{m.kuerzel}</span>
            ))}
            <span className={`truncate font-medium ml-0.5 ${abgesagt ? 'line-through' : ''}`} style={{ color: farbe }}>{kontaktName}</span>
          </div>
          <div className="text-text-muted truncate">{format(start, 'HH:mm')}&ndash;{format(end, 'HH:mm')}</div>
        </>
      ) : (
        <>
          {termin.termin_arten && (
            <span className="inline-block px-1 rounded text-[8px] font-semibold text-white truncate" style={{ backgroundColor: farbe }}>{termin.termin_arten.name}</span>
          )}
          <div className={`font-medium truncate text-text-primary leading-tight ${abgesagt ? 'line-through' : ''}`}>{kontaktName}</div>
          <div className="text-text-muted">{format(start, 'HH:mm')}&ndash;{format(end, 'HH:mm')}</div>
          <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
            {monteure.map((m) => (
              <span key={m.kuerzel} className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0"
                style={{ backgroundColor: m.farbe || '#6B7280' }}>{m.kuerzel}</span>
            ))}
            {fahrzeug && <span className="text-[9px] text-text-muted ml-0.5">{fahrzeug}</span>}
          </div>
        </>
      )}
    </div>
  )
}

export default function WochenZeitansicht({
  termine = [],
  currentDate,
  columnType = 'fahrzeug',
  onTerminClick,
  onTerminHover,
  onTerminHoverEnd,
  onSlotClick,
  onDayClick,
  onTerminDrop,
}) {
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const gridRef = useRef(null)

  // Drag state
  const [drag, setDrag] = useState(null) // { termin, startX, startY, currentX, currentY, active }
  const [dropInfo, setDropInfo] = useState(null) // { dayIdx, time }

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

      if (isActive && gridRef.current) {
        // Find which day column we're over
        const cols = gridRef.current.querySelectorAll('[data-day-col]')
        let foundDay = null
        let foundTime = null
        for (const col of cols) {
          const rect = col.getBoundingClientRect()
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            foundDay = parseInt(col.dataset.dayCol)
            const relY = e.clientY - rect.top
            const pct = Math.max(0, Math.min(100, (relY / rect.height) * 100))
            foundTime = pctToTime(pct)
            break
          }
        }
        setDropInfo(foundDay !== null ? { dayIdx: foundDay, time: foundTime } : null)
      }
    }

    const onUp = () => {
      if (drag.active && dropInfo && onTerminDrop) {
        const targetDay = weekDays[dropInfo.dayIdx]
        const oldStart = parseISO(drag.termin.start_zeit)
        const oldEnd = parseISO(drag.termin.end_zeit)
        const dur = oldEnd.getTime() - oldStart.getTime()
        const newStart = new Date(targetDay)
        newStart.setHours(dropInfo.time.h, dropInfo.time.m, 0, 0)
        const newEnd = new Date(newStart.getTime() + dur)
        onTerminDrop(drag.termin.id, newStart.toISOString(), newEnd.toISOString(), null)
      } else if (!drag.active) {
        onTerminClick?.(drag.termin)
      }
      setDrag(null)
      setDropInfo(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag, dropInfo, weekDays, onTerminDrop, onTerminClick])

  const dayColumns = useMemo(() => {
    const filtered = termine.filter((t) => {
      const resources = t.termin_ressourcen || []
      return resources.some((r) => r.ressourcen?.typ === columnType)
    })
    return weekDays.map((day) => {
      const dayTermine = filtered.filter((t) => isSameDay(parseISO(t.start_zeit), day))
      const laid = layoutOverlapping(dayTermine)
      return { day, items: laid }
    })
  }, [termine, weekDays, columnType])

  return (
    <div className="bg-surface-card h-full flex flex-col">
      {/* Column headers */}
      <div className="flex shrink-0 border-b border-border-default">
        <div className="w-12 shrink-0 bg-surface-main border-r border-border-default h-10" />
        {dayColumns.map(({ day }, dIdx) => {
          const today = isToday(day)
          const isDropDay = dropInfo?.dayIdx === dIdx
          return (
            <div key={dIdx}
              className={`flex-1 min-w-[120px] h-10 flex items-center justify-center border-r border-border-default last:border-r-0 px-2 cursor-pointer hover:bg-surface-hover transition-colors ${
                isDropDay ? 'bg-brand/10 text-brand font-bold' : today ? 'bg-brand/5 text-brand font-bold' : 'bg-surface-main text-text-primary'
              }`}
              onClick={() => onDayClick?.(day)}
              title="Klick für Tagesansicht">
              <span className="text-sm font-semibold">
                {WEEKDAYS[dIdx]} {format(day, 'dd.MM', { locale: de })}
                {isDropDay && dropInfo?.time && (
                  <span className="ml-1 text-xs font-normal text-brand">{dropInfo.time.str}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* Grid body */}
      <div ref={gridRef} className="flex flex-1 min-h-0">
        <div className="w-12 shrink-0 bg-surface-main border-r border-border-default relative">
          <TimeSlotLabels />
        </div>

        {dayColumns.map(({ day, items }, dIdx) => {
          const today = isToday(day)
          const isDropDay = dropInfo?.dayIdx === dIdx
          return (
            <div key={dIdx}
              data-day-col={dIdx}
              className={`flex-1 min-w-[120px] border-r border-border-default last:border-r-0 relative cursor-crosshair select-none ${
                isDropDay ? 'bg-brand/5' : ''
              }`}
              onDoubleClick={(e) => {
                if (e.target.closest('[data-termin-block]')) return
                const rect = e.currentTarget.getBoundingClientRect()
                const relY = e.clientY - rect.top
                const pct = rect.height > 0 ? (relY / rect.height) * 100 : 0
                const time = pctToTime(pct)
                const startDate = new Date(day); startDate.setHours(time.h, time.m, 0, 0)
                const endDate = new Date(day); endDate.setHours(time.h + 1, time.m, 0, 0)
                onSlotClick?.(startDate, null, endDate)
              }}>

              <div className="absolute inset-0 pointer-events-none"><GridLines /></div>

              {/* Drop indicator line */}
              {isDropDay && dropInfo?.time && (
                <div className="absolute left-0 right-0 z-25 pointer-events-none"
                  style={{ top: `${timeToPct(`${dropInfo.time.str}`)}%` }}>
                  <div className="border-t-2 border-brand border-dashed" />
                  <span className="absolute -top-3 left-1 text-[9px] font-medium text-brand bg-surface-card px-1 rounded">
                    {dropInfo.time.str}
                  </span>
                </div>
              )}

              {items.map(({ termin, left, width }) => (
                <TerminBlock key={termin.id} termin={termin} left={left} width={width}
                  onTerminClick={drag ? undefined : onTerminClick}
                  onTerminHover={drag ? undefined : onTerminHover}
                  onTerminHoverEnd={drag ? undefined : onTerminHoverEnd}
                  onDragStart={handleDragStart} />
              ))}

              {today && <CurrentTimeMarker />}
            </div>
          )
        })}
      </div>

      {/* Drag Ghost */}
      {drag?.active && (
        <div className="fixed z-50 pointer-events-none opacity-80 rounded-md px-2 py-1 text-xs shadow-xl max-w-[180px]"
          style={{
            left: drag.currentX + 12, top: drag.currentY - 8,
            backgroundColor: (drag.termin.termin_arten?.farbe || '#6B7280') + '40',
            borderLeft: `3px solid ${drag.termin.termin_arten?.farbe || '#6B7280'}`,
          }}>
          <div className="font-medium truncate text-text-primary">{getKontaktName(drag.termin.kontakte)}</div>
          <div className="text-text-muted">
            {dropInfo?.time ? `→ ${WEEKDAYS[dropInfo.dayIdx]} ${dropInfo.time.str}` : format(parseISO(drag.termin.start_zeit), 'HH:mm')}
          </div>
        </div>
      )}
    </div>
  )
}
