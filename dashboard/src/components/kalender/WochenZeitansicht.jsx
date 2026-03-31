import { useMemo } from 'react'
import { format, startOfWeek, addDays, isSameDay, parseISO, isToday } from 'date-fns'
import { de } from 'date-fns/locale'

const SLOT_START = 7
const SLOT_END = 17
const HOUR_HEIGHT = 48
const TOTAL_HEIGHT = (SLOT_END - SLOT_START) * HOUR_HEIGHT
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

const timeToY = (timeStr) => {
  const [h, m] =
    typeof timeStr === 'string' ? timeStr.split(':').map(Number) : [timeStr.getHours(), timeStr.getMinutes()]
  return (h - SLOT_START + m / 60) * HOUR_HEIGHT
}

const getKontaktName = (kontakt) => {
  if (!kontakt) return 'Unbekannt'
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find((p) => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
}

const getMonteurKuerzel = (termin) => {
  if (!termin.termin_ressourcen) return []
  return termin.termin_ressourcen
    .filter((r) => r.ressourcen?.typ === 'monteur')
    .map((r) => ({
      kuerzel: r.ressourcen.kuerzel,
      farbe: r.ressourcen.farbe,
      name: r.ressourcen.name,
    }))
}

const getFahrzeugName = (termin) => {
  const fz = termin.termin_ressourcen?.find((r) => r.ressourcen?.typ === 'fahrzeug')
  return fz?.ressourcen?.kuerzel || fz?.ressourcen?.name || null
}

const isAbgesagt = (termin) => termin.status === 'abgesagt'

function TimeSlotLabels() {
  const slots = []
  for (let h = SLOT_START; h <= SLOT_END; h++) slots.push(h)
  return (
    <div className="relative" style={{ height: TOTAL_HEIGHT }}>
      {slots.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 text-[10px] text-text-muted -translate-y-1/2 text-right pr-2"
          style={{ top: (h - SLOT_START) * HOUR_HEIGHT }}
        >
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  )
}

function GridLines() {
  const lines = []
  for (let h = SLOT_START; h <= SLOT_END; h++) {
    lines.push(
      <div key={`h-${h}`} className="absolute left-0 right-0 border-t border-border-default"
        style={{ top: (h - SLOT_START) * HOUR_HEIGHT }} />,
    )
    if (h < SLOT_END) {
      lines.push(
        <div key={`hm-${h}`} className="absolute left-0 right-0 border-t border-border-default/40 border-dashed"
          style={{ top: (h - SLOT_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />,
      )
    }
  }
  return <>{lines}</>
}

function CurrentTimeMarker() {
  const now = new Date()
  const y = timeToY(now)
  if (y < 0 || y > TOTAL_HEIGHT) return null
  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: y }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
        <div className="flex-1 border-t-2 border-red-500" />
        <span className="text-[10px] text-red-500 font-medium ml-1 bg-surface-card px-1 rounded">
          {format(now, 'HH:mm')}
        </span>
      </div>
    </div>
  )
}

/**
 * Layout overlapping termine side-by-side within a day column.
 * Returns termine with added `left` (0-1 fractional) and `width` (0-1 fractional).
 */
function layoutOverlapping(termine) {
  if (termine.length === 0) return []

  // Sort by start time
  const sorted = [...termine].sort((a, b) => {
    const aStart = parseISO(a.start_zeit)
    const bStart = parseISO(b.start_zeit)
    return aStart - bStart || (parseISO(b.end_zeit) - parseISO(a.end_zeit))
  })

  // Assign columns using greedy interval graph coloring
  const placed = []
  for (const termin of sorted) {
    const tStart = parseISO(termin.start_zeit).getTime()
    const tEnd = parseISO(termin.end_zeit).getTime()

    // Find first column where this termin doesn't overlap
    let col = 0
    const colEnds = {} // col -> latest end time
    for (const p of placed) {
      if (p.col === col) {
        colEnds[col] = Math.max(colEnds[col] || 0, parseISO(p.termin.end_zeit).getTime())
      }
    }

    // Find first free column
    col = 0
    while (true) {
      const endInCol = placed
        .filter(p => p.col === col)
        .reduce((max, p) => Math.max(max, parseISO(p.termin.end_zeit).getTime()), 0)
      if (endInCol <= tStart) break
      col++
    }

    placed.push({ termin, col })
  }

  // Determine max column count for each overlap group
  const maxCol = placed.reduce((max, p) => Math.max(max, p.col), 0) + 1

  return placed.map(p => ({
    termin: p.termin,
    left: p.col / maxCol,
    width: 1 / maxCol,
  }))
}

function TerminBlock({ termin, left, width, onTerminClick, onTerminHover, onTerminHoverEnd }) {
  const abgesagt = isAbgesagt(termin)
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const monteure = getMonteurKuerzel(termin)
  const kontaktName = getKontaktName(termin.kontakte)
  const fahrzeug = getFahrzeugName(termin)

  const start = parseISO(termin.start_zeit)
  const end = parseISO(termin.end_zeit)
  const top = timeToY(start)
  const height = Math.max(timeToY(end) - top, 22)

  const handleMouseEnter = (e) => {
    if (onTerminHover) {
      const rect = e.currentTarget.getBoundingClientRect()
      onTerminHover(termin, rect)
    }
  }

  return (
    <div
      data-termin-block="true"
      className={`
        absolute rounded-md px-1 py-0.5 text-[10px] cursor-pointer overflow-hidden
        transition-shadow hover:shadow-lg hover:z-20 group
        ${abgesagt ? 'opacity-50' : ''}
      `}
      style={{
        top,
        height,
        left: `calc(${left * 100}% + 2px)`,
        width: `calc(${width * 100}% - 4px)`,
        backgroundColor: abgesagt ? `${farbe}20` : `${farbe}25`,
        borderLeft: `3px solid ${farbe}`,
        zIndex: 10,
      }}
      onClick={(e) => { e.stopPropagation(); onTerminClick?.(termin) }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTerminHoverEnd?.()}
    >
      {height < 26 ? (
        /* Ultra-compact: single line */
        <div className="flex items-center gap-0.5 min-w-0">
          {monteure.slice(0, 2).map((m) => (
            <span key={m.kuerzel}
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[7px] font-bold text-white shrink-0"
              style={{ backgroundColor: m.farbe || '#6B7280' }} title={m.name}>
              {m.kuerzel}
            </span>
          ))}
          <span className={`truncate font-medium ${abgesagt ? 'line-through' : ''}`}
            style={{ color: farbe }}>
            {kontaktName}
          </span>
        </div>
      ) : height < 42 ? (
        /* Compact: name + monteure */
        <>
          <div className="flex items-center gap-0.5">
            {monteure.slice(0, 3).map((m) => (
              <span key={m.kuerzel}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0"
                style={{ backgroundColor: m.farbe || '#6B7280' }} title={m.name}>
                {m.kuerzel}
              </span>
            ))}
            <span className={`truncate font-medium ml-0.5 ${abgesagt ? 'line-through' : ''}`}
              style={{ color: farbe }}>
              {kontaktName}
            </span>
          </div>
          <div className="text-text-muted truncate">
            {format(start, 'HH:mm')}&ndash;{format(end, 'HH:mm')}
          </div>
        </>
      ) : (
        /* Full: art badge + name + time + monteure + fahrzeug */
        <>
          {termin.termin_arten && (
            <span className="inline-block px-1 rounded text-[8px] font-semibold text-white truncate"
              style={{ backgroundColor: farbe }}>
              {termin.termin_arten.name}
            </span>
          )}
          <div className={`font-medium truncate text-text-primary leading-tight ${abgesagt ? 'line-through' : ''}`}>
            {kontaktName}
          </div>
          <div className="text-text-muted">
            {format(start, 'HH:mm')}&ndash;{format(end, 'HH:mm')}
          </div>
          <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
            {monteure.map((m) => (
              <span key={m.kuerzel}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0"
                style={{ backgroundColor: m.farbe || '#6B7280' }} title={m.name}>
                {m.kuerzel}
              </span>
            ))}
            {fahrzeug && (
              <span className="text-[9px] text-text-muted ml-0.5">{fahrzeug}</span>
            )}
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
}) {
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Filter termine by resource type, then group by day
  const dayColumns = useMemo(() => {
    // Filter: only termine that have at least one resource of the selected type
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
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
      <div className="relative flex min-w-[700px]">
        {/* Time column */}
        <div className="w-12 shrink-0 bg-surface-main border-r border-border-default">
          <div className="h-10 border-b border-border-default" />
          <div className="relative" style={{ height: TOTAL_HEIGHT }}>
            <TimeSlotLabels />
          </div>
        </div>

        {/* Day columns */}
        {dayColumns.map(({ day, items }, dIdx) => {
          const today = isToday(day)
          return (
            <div key={dIdx} className="flex-1 min-w-[120px] border-r border-border-default last:border-r-0">
              {/* Day header */}
              <div
                className={`h-10 flex items-center justify-center border-b border-border-default px-2 cursor-pointer hover:bg-surface-hover transition-colors ${
                  today ? 'bg-brand/5 text-brand font-bold' : 'bg-surface-main text-text-primary'
                }`}
                onClick={() => onDayClick?.(day)}
                title="Klick fuer Tagesansicht"
              >
                <span className="text-sm font-semibold">
                  {WEEKDAYS[dIdx]} {format(day, 'dd.MM', { locale: de })}
                </span>
              </div>

              {/* Time grid body */}
              <div
                className="relative cursor-crosshair select-none"
                style={{ height: TOTAL_HEIGHT }}
                onClick={(e) => {
                  if (e.target.closest('[data-termin-block]')) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const relY = e.clientY - rect.top
                  const totalMinutes = (relY / HOUR_HEIGHT) * 60 + SLOT_START * 60
                  const snapped = Math.round(totalMinutes / 30) * 30
                  const h = Math.floor(snapped / 60)
                  const m = snapped % 60
                  const startDate = new Date(day)
                  startDate.setHours(h, m, 0, 0)
                  const endDate = new Date(day)
                  endDate.setHours(h + 1, m, 0, 0)
                  onSlotClick?.(startDate, null, endDate)
                }}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <GridLines />
                </div>

                {/* Termine */}
                {items.map(({ termin, left, width }) => (
                  <TerminBlock
                    key={termin.id}
                    termin={termin}
                    left={left}
                    width={width}
                    onTerminClick={onTerminClick}
                    onTerminHover={onTerminHover}
                    onTerminHoverEnd={onTerminHoverEnd}
                  />
                ))}

                {/* Current time marker */}
                {today && <CurrentTimeMarker />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
