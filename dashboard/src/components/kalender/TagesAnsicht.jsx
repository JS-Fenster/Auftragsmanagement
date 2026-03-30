import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { format, parseISO, isSameDay, isToday } from 'date-fns'

const SLOT_START = 7
const SLOT_END = 17
const HOUR_HEIGHT = 60
const TOTAL_HEIGHT = (SLOT_END - SLOT_START) * HOUR_HEIGHT
const SNAP_MINUTES = 30
const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT

const timeToY = (timeStr) => {
  const [h, m] =
    typeof timeStr === 'string' ? timeStr.split(':').map(Number) : [timeStr.getHours(), timeStr.getMinutes()]
  return (h - SLOT_START + m / 60) * HOUR_HEIGHT
}

const yToTime = (y) => {
  const totalMinutes = (y / HOUR_HEIGHT) * 60 + SLOT_START * 60
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
  const h = Math.floor(snapped / 60)
  const m = snapped % 60
  return { h, m, str: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
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
      id: r.ressource_id,
    }))
}

const getFahrzeugId = (termin) => {
  const fahrzeug = termin.termin_ressourcen?.find(
    (r) => r.ressourcen?.typ === 'fahrzeug'
  )
  return fahrzeug?.ressource_id ?? null
}

const isAbgesagt = (termin) => termin.status === 'abgesagt'

const ABWESENHEIT_LABELS = {
  urlaub: 'Urlaub',
  krank: 'Krank',
  frei: 'Frei',
}

// Check if a termin's monteur is outside their AZM for this day
function checkAzmWarning(termin, arbeitszeitmodelle, selectedDate) {
  const monteure = termin.termin_ressourcen?.filter((r) => r.rolle === 'monteur') || []
  if (monteure.length === 0) return false

  const dayOfWeek = selectedDate.getDay()
  const dayNames = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
  const dayName = dayNames[dayOfWeek]

  const terminStart = parseISO(termin.start_zeit)
  const terminEnd = parseISO(termin.end_zeit)

  for (const mr of monteure) {
    const azm = arbeitszeitmodelle.find((a) => {
      if (a.ressource_id !== mr.ressource_id) return false
      const ab = parseISO(a.gueltig_ab)
      if (ab > selectedDate) return false
      if (a.gueltig_bis && parseISO(a.gueltig_bis) < selectedDate) return false
      return true
    })

    if (!azm) continue

    const tageszeit = azm[dayName]
    if (!tageszeit) {
      // No working hours on this day — warning
      return true
    }

    const [azmStartH, azmStartM] = tageszeit.start.split(':').map(Number)
    const [azmEndH, azmEndM] = tageszeit.ende.split(':').map(Number)

    const azmStartMin = azmStartH * 60 + azmStartM
    const azmEndMin = azmEndH * 60 + azmEndM
    const terminStartMin = terminStart.getHours() * 60 + terminStart.getMinutes()
    const terminEndMin = terminEnd.getHours() * 60 + terminEnd.getMinutes()

    if (terminStartMin < azmStartMin || terminEndMin > azmEndMin) {
      return true
    }
  }

  return false
}

function TimeSlotLabels() {
  const slots = []
  for (let h = SLOT_START; h <= SLOT_END; h++) {
    slots.push(h)
  }
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
      <div
        key={`h-${h}`}
        className="absolute left-0 right-0 border-t border-border-default"
        style={{ top: (h - SLOT_START) * HOUR_HEIGHT }}
      />,
    )
    if (h < SLOT_END) {
      lines.push(
        <div
          key={`hm-${h}`}
          className="absolute left-0 right-0 border-t border-border-default/40 border-dashed"
          style={{ top: (h - SLOT_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
        />,
      )
    }
  }
  return <>{lines}</>
}

function CurrentTimeMarker() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

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

function AbwesenheitBlock({ abwesenheit }) {
  const label = ABWESENHEIT_LABELS[abwesenheit.typ] || abwesenheit.typ

  if (abwesenheit.ganztaegig) {
    return (
      <div
        className="absolute inset-x-0 z-5 flex items-center justify-center rounded-md pointer-events-none"
        style={{
          top: 0,
          height: TOTAL_HEIGHT,
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
        }}
      >
        <span className="text-xs font-medium text-red-400 bg-surface-card/80 px-2 py-0.5 rounded">
          {label}
        </span>
      </div>
    )
  }

  const top = timeToY(abwesenheit.von_zeit)
  const bottom = timeToY(abwesenheit.bis_zeit)
  const height = Math.max(bottom - top, 20)

  return (
    <div
      className="absolute inset-x-1 z-5 flex items-center justify-center rounded-md pointer-events-none"
      style={{
        top,
        height,
        backgroundColor: 'rgba(239, 68, 68, 0.10)',
        border: '1px dashed rgba(239, 68, 68, 0.3)',
      }}
    >
      <span className="text-[10px] text-red-400">{label}</span>
    </div>
  )
}

function TerminBlock({
  termin,
  hasAzmWarning,
  onTerminClick,
  onTerminHover,
  onTerminHoverEnd,
  onDragStart,
}) {
  const abgesagt = isAbgesagt(termin)
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const monteure = getMonteurKuerzel(termin)
  const kontaktName = getKontaktName(termin.kontakte)

  const start = parseISO(termin.start_zeit)
  const end = parseISO(termin.end_zeit)
  const top = timeToY(start)
  const height = Math.max(timeToY(end) - top, 24)

  const handleMouseEnter = (e) => {
    if (onTerminHover) {
      const rect = e.currentTarget.getBoundingClientRect()
      onTerminHover(termin, rect)
    }
  }

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    onDragStart?.(termin, e)
  }

  return (
    <div
      className={`
        absolute inset-x-1 rounded-md px-1.5 py-1 text-xs cursor-grab overflow-hidden
        transition-shadow hover:shadow-lg hover:z-20 group
        ${abgesagt ? 'opacity-50' : ''}
        ${hasAzmWarning ? 'ring-2 ring-red-500/70' : ''}
      `}
      style={{
        top,
        height,
        backgroundColor: abgesagt ? `${farbe}20` : `${farbe}20`,
        borderLeft: `3px solid ${farbe}`,
        zIndex: 10,
      }}
      onClick={() => onTerminClick?.(termin)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTerminHoverEnd?.()}
      onMouseDown={handleMouseDown}
    >
      {/* Art Badge */}
      {termin.termin_arten && (
        <div
          className="inline-block px-1 py-0 rounded text-[9px] font-semibold text-white mb-0.5 truncate max-w-full"
          style={{ backgroundColor: farbe }}
        >
          {termin.termin_arten.name}
        </div>
      )}

      <div className={`font-medium truncate text-text-primary ${abgesagt ? 'line-through' : ''}`}>
        {kontaktName}
      </div>

      {height >= 48 && (
        <div className={`text-text-muted ${abgesagt ? 'line-through' : ''}`}>
          {format(start, 'HH:mm')}&ndash;{format(end, 'HH:mm')}
        </div>
      )}

      {monteure.length > 0 && height >= 36 && (
        <div className="flex gap-0.5 mt-0.5 flex-wrap">
          {monteure.map((m) => (
            <span
              key={m.kuerzel}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0"
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

function DragGhost({ termin, top, left, width }) {
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const start = parseISO(termin.start_zeit)
  const end = parseISO(termin.end_zeit)
  const height = Math.max(timeToY(end) - timeToY(start), 24)

  return (
    <div
      className="fixed rounded-md px-1.5 py-1 text-xs opacity-80 pointer-events-none z-50 shadow-xl"
      style={{
        top,
        left,
        width,
        height,
        backgroundColor: `${farbe}40`,
        borderLeft: `3px solid ${farbe}`,
      }}
    >
      <div className="font-medium truncate text-text-primary">{getKontaktName(termin.kontakte)}</div>
    </div>
  )
}

export default function TagesAnsicht({
  termine = [],
  fahrzeuge = [],
  monteure = [],
  arbeitszeitmodelle = [],
  abwesenheiten = [],
  selectedDate,
  onTerminClick,
  onTerminHover,
  onTerminHoverEnd,
  onSlotClick,
  onTerminDrop,
}) {
  const gridRef = useRef(null)
  const [drag, setDrag] = useState(null) // { termin, startY, currentY, colIdx, originColIdx }

  const showToday = isToday(selectedDate)

  // Map termine to fahrzeug columns
  const columns = useMemo(() => {
    const cols = fahrzeuge.map((fz) => ({
      fahrzeug: fz,
      termine: [],
      abwesenheiten: [],
    }))

    const fzIndexMap = new Map(fahrzeuge.map((fz, i) => [fz.id, i]))

    for (const termin of termine) {
      const fzId = getFahrzeugId(termin)
      const idx = fzIndexMap.get(fzId)
      if (idx !== undefined) {
        cols[idx].termine.push(termin)
      }
    }

    // Map abwesenheiten to columns based on monteure assigned to that fahrzeug's termine
    for (const ab of abwesenheiten) {
      if (!isSameDay(parseISO(ab.datum), selectedDate)) continue
      // Show abwesenheit in every column where this ressource's monteur has termine
      for (const col of cols) {
        const hasRessource = col.termine.some((t) =>
          t.termin_ressourcen?.some(
            (r) => r.rolle === 'monteur' && r.ressource_id === ab.ressource_id,
          ),
        )
        if (hasRessource) {
          col.abwesenheiten.push(ab)
        }
      }
    }

    return cols
  }, [termine, fahrzeuge, abwesenheiten, selectedDate])

  // Drag handlers
  const handleDragStart = useCallback(
    (termin, e) => {
      const gridEl = gridRef.current
      if (!gridEl) return
      const gridRect = gridEl.getBoundingClientRect()
      const fzId = getFahrzeugId(termin)
      const colIdx = fahrzeuge.findIndex((f) => f.id === fzId)

      setDrag({
        termin,
        startMouseY: e.clientY,
        startTop: timeToY(parseISO(termin.start_zeit)),
        colIdx,
        originColIdx: colIdx,
        currentY: e.clientY,
        currentX: e.clientX,
        gridRect,
      })
    },
    [fahrzeuge],
  )

  useEffect(() => {
    if (!drag) return

    const handleMouseMove = (e) => {
      setDrag((prev) => (prev ? { ...prev, currentY: e.clientY, currentX: e.clientX } : null))
    }

    const handleMouseUp = (e) => {
      if (!drag || !gridRef.current) {
        setDrag(null)
        return
      }

      const deltaY = e.clientY - drag.startMouseY
      const newTop = drag.startTop + deltaY
      const snappedTop = Math.round(newTop / SNAP_PX) * SNAP_PX
      const clampedTop = Math.max(0, Math.min(snappedTop, TOTAL_HEIGHT - SNAP_PX))
      const newTime = yToTime(clampedTop)

      const start = parseISO(drag.termin.start_zeit)
      const end = parseISO(drag.termin.end_zeit)
      const durationMs = end.getTime() - start.getTime()

      const newStart = new Date(selectedDate)
      newStart.setHours(newTime.h, newTime.m, 0, 0)
      const newEnd = new Date(newStart.getTime() + durationMs)

      // Determine target column from X position
      const gridRect = gridRef.current.getBoundingClientRect()
      const colCount = fahrzeuge.length
      const timeColWidth = 48 // time label width
      const contentWidth = gridRect.width - timeColWidth
      const relX = e.clientX - gridRect.left - timeColWidth
      let targetColIdx = Math.floor((relX / contentWidth) * colCount)
      targetColIdx = Math.max(0, Math.min(targetColIdx, colCount - 1))
      const targetFahrzeugId = fahrzeuge[targetColIdx]?.id

      if (onTerminDrop) {
        onTerminDrop(drag.termin.id, newStart.toISOString(), newEnd.toISOString(), targetFahrzeugId)
      }

      setDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, selectedDate, fahrzeuge, onTerminDrop])

  const handleSlotClick = useCallback(
    (e, fahrzeugId) => {
      if (!onSlotClick || !gridRef.current) return
      const rect = e.currentTarget.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const time = yToTime(relY)
      const dateWithTime = new Date(selectedDate)
      dateWithTime.setHours(time.h, time.m, 0, 0)
      onSlotClick(dateWithTime, fahrzeugId)
    },
    [onSlotClick, selectedDate],
  )

  if (fahrzeuge.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Keine Fahrzeuge konfiguriert
      </div>
    )
  }

  // Ghost position for drag
  const ghostStyle = drag
    ? {
        top: drag.currentY - 12,
        left: drag.currentX + 8,
        width: 160,
      }
    : null

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
      <div ref={gridRef} className="relative flex min-w-[600px]">
        {/* Time column */}
        <div className="w-12 shrink-0 bg-surface-main border-r border-border-default">
          {/* Header spacer */}
          <div className="h-10 border-b border-border-default" />
          {/* Time labels */}
          <div className="relative" style={{ height: TOTAL_HEIGHT }}>
            <TimeSlotLabels />
          </div>
        </div>

        {/* Fahrzeug columns */}
        {columns.map((col, colIdx) => {
          const fz = col.fahrzeug
          return (
            <div key={fz.id} className="flex-1 min-w-[140px] border-r border-border-default last:border-r-0">
              {/* Column header */}
              <div className="h-10 flex items-center justify-center gap-1.5 border-b border-border-default bg-surface-main px-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: fz.farbe || '#6B7280' }}
                />
                <span className="text-xs font-semibold text-text-primary truncate">{fz.kuerzel}</span>
                <span className="text-[10px] text-text-muted truncate hidden sm:inline">{fz.name}</span>
              </div>

              {/* Day column body */}
              <div
                className="relative cursor-crosshair"
                style={{ height: TOTAL_HEIGHT }}
                onClick={(e) => {
                  // Only fire if clicking empty space, not on a termin
                  if (e.target === e.currentTarget || e.target.closest('[data-gridlines]')) {
                    handleSlotClick(e, fz.id)
                  }
                }}
              >
                {/* Grid lines */}
                <div data-gridlines="true" className="absolute inset-0 pointer-events-none">
                  <GridLines />
                </div>

                {/* Abwesenheiten */}
                {col.abwesenheiten.map((ab) => (
                  <AbwesenheitBlock key={ab.id} abwesenheit={ab} />
                ))}

                {/* Termine */}
                {col.termine.map((termin) => {
                  const hasAzmWarning = checkAzmWarning(termin, arbeitszeitmodelle, selectedDate)
                  return (
                    <TerminBlock
                      key={termin.id}
                      termin={termin}
                      hasAzmWarning={hasAzmWarning}
                      onTerminClick={onTerminClick}
                      onTerminHover={onTerminHover}
                      onTerminHoverEnd={onTerminHoverEnd}
                      onDragStart={handleDragStart}
                    />
                  )
                })}

                {/* Current time marker */}
                {showToday && <CurrentTimeMarker />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Drag ghost */}
      {drag && <DragGhost termin={drag.termin} {...ghostStyle} />}
    </div>
  )
}
