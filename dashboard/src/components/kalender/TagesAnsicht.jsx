import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { format, parseISO, isSameDay, isToday } from 'date-fns'

const SLOT_START = 7
const SLOT_END = 17
const HOURS = SLOT_END - SLOT_START
const SNAP_MINUTES = 30

// All positions as percentage (0–100%) of the grid height
const timeToPct = (timeStr) => {
  const [h, m] =
    typeof timeStr === 'string' ? timeStr.split(':').map(Number) : [timeStr.getHours(), timeStr.getMinutes()]
  return ((h - SLOT_START + m / 60) / HOURS) * 100
}

const yToPct = (y, gridH) => (gridH > 0 ? (y / gridH) * 100 : 0)

const pctToTime = (pct) => {
  const totalMinutes = (pct / 100) * HOURS * 60 + SLOT_START * 60
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
    .map((r) => ({ kuerzel: r.ressourcen.kuerzel, farbe: r.ressourcen.farbe, id: r.ressource_id }))
}

const getFahrzeugId = (termin) => {
  const fz = termin.termin_ressourcen?.find((r) => r.ressourcen?.typ === 'fahrzeug')
  return fz?.ressource_id ?? null
}

const isAbgesagt = (termin) => termin.status === 'abgesagt'

const ABWESENHEIT_LABELS = { urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei' }

function checkAzmWarning(termin, arbeitszeitmodelle, selectedDate) {
  const monteure = termin.termin_ressourcen?.filter((r) => r.rolle === 'monteur') || []
  if (monteure.length === 0) return false
  const dayNames = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
  const dayName = dayNames[selectedDate.getDay()]
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
    if (!tageszeit) return true
    const [azmSH, azmSM] = tageszeit.start.split(':').map(Number)
    const [azmEH, azmEM] = tageszeit.ende.split(':').map(Number)
    const azmS = azmSH * 60 + azmSM, azmE = azmEH * 60 + azmEM
    const tS = terminStart.getHours() * 60 + terminStart.getMinutes()
    const tE = terminEnd.getHours() * 60 + terminEnd.getMinutes()
    if (tS < azmS || tE > azmE) return true
  }
  return false
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
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])
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

function AbwesenheitBlock({ abwesenheit }) {
  const label = ABWESENHEIT_LABELS[abwesenheit.typ] || abwesenheit.typ
  if (abwesenheit.ganztaegig) {
    return (
      <div className="absolute inset-x-0 inset-y-0 z-5 flex items-center justify-center rounded-md pointer-events-none"
        style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
        <span className="text-xs font-medium text-red-400 bg-surface-card/80 px-2 py-0.5 rounded">{label}</span>
      </div>
    )
  }
  const top = timeToPct(abwesenheit.von_zeit)
  const bottom = timeToPct(abwesenheit.bis_zeit)
  return (
    <div className="absolute inset-x-1 z-5 flex items-center justify-center rounded-md pointer-events-none"
      style={{ top: `${top}%`, height: `${Math.max(bottom - top, 2)}%`, backgroundColor: 'rgba(239, 68, 68, 0.10)', border: '1px dashed rgba(239, 68, 68, 0.3)' }}>
      <span className="text-[10px] text-red-400">{label}</span>
    </div>
  )
}

const STATUS_STYLES = {
  geplant: { border: 'dashed', opacity: 1 },
  bestaetigt: { border: 'solid', opacity: 1 },
  abgeschlossen: { border: 'solid', opacity: 0.6 },
  abgesagt: { border: 'solid', opacity: 0.4 },
}

function TerminBlock({ termin, hasAzmWarning, onTerminClick, onTerminHover, onTerminHoverEnd, onDragStart }) {
  const abgesagt = termin.status === 'abgesagt'
  const statusStyle = STATUS_STYLES[termin.status] || STATUS_STYLES.geplant
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const monteure = getMonteurKuerzel(termin)
  const kontaktName = getKontaktName(termin.kontakte)
  const adresse = termin.kontakte?.ort || ''
  const start = parseISO(termin.start_zeit)
  const end = parseISO(termin.end_zeit)
  const topPct = timeToPct(start)
  const heightPct = Math.max(timeToPct(end) - topPct, 2)

  const handleMouseEnter = (e) => {
    if (onTerminHover) { const rect = e.currentTarget.getBoundingClientRect(); onTerminHover(termin, rect) }
  }
  const handleMouseDown = (e) => { if (e.button !== 0) return; e.preventDefault(); onDragStart?.(termin, e) }

  return (
    <div data-termin="true"
      className={`absolute inset-x-1 rounded-md px-1.5 py-0.5 text-xs cursor-grab overflow-hidden transition-shadow hover:shadow-lg hover:z-20 group ${hasAzmWarning ? 'ring-2 ring-red-500/70' : ''}`}
      style={{
        top: `${topPct}%`, height: `${heightPct}%`,
        backgroundColor: `${farbe}20`,
        borderLeft: `3px ${statusStyle.border} ${farbe}`,
        opacity: statusStyle.opacity,
        zIndex: 10,
      }}
      onClick={() => onTerminClick?.(termin)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTerminHoverEnd?.()}
      onMouseDown={handleMouseDown}>
      {/* Row 1: Art Badge + Status indicator */}
      {termin.termin_arten && (
        <div className="flex items-center gap-1 mb-0.5">
          <span className="inline-block px-1 py-0 rounded text-[9px] font-semibold text-white truncate" style={{ backgroundColor: farbe }}>{termin.termin_arten.name}</span>
          {termin.status === 'bestaetigt' && <span className="text-[8px] text-emerald-600 font-medium">&#10003;</span>}
          {termin.status === 'abgeschlossen' && <span className="text-[8px] text-gray-500 font-medium">&#10003;&#10003;</span>}
        </div>
      )}
      {/* Titel */}
      <div className={`font-semibold truncate text-text-primary ${abgesagt ? 'line-through' : ''}`}>{termin.titel || kontaktName}</div>
      {/* Kontakt + Ort (if space) */}
      {heightPct >= 6 && termin.titel && (
        <div className="text-text-secondary truncate">{kontaktName}{adresse ? ` | ${adresse}` : ''}</div>
      )}
      {/* Zeit */}
      {heightPct >= 6 && (
        <div className={`text-text-muted ${abgesagt ? 'line-through' : ''}`}>{format(start, 'HH:mm')}&ndash;{format(end, 'HH:mm')}</div>
      )}
      {/* Monteure */}
      {monteure.length > 0 && heightPct >= 6 && (
        <div className="flex gap-0.5 mt-0.5 flex-wrap">
          {monteure.map((m) => (
            <span key={m.kuerzel} className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: m.farbe || '#6B7280' }} title={m.kuerzel}>{m.kuerzel}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function DragGhost({ termin, top, left, width }) {
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  return (
    <div className="fixed rounded-md px-1.5 py-1 text-xs opacity-80 pointer-events-none z-50 shadow-xl"
      style={{ top, left, width, height: 60, backgroundColor: `${farbe}40`, borderLeft: `3px solid ${farbe}` }}>
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
  columnType = 'fahrzeug',
}) {
  const gridRef = useRef(null)
  const [pendingDrag, setPendingDrag] = useState(null)
  const [drag, setDrag] = useState(null)

  const showToday = isToday(selectedDate)
  const isMonteurView = columnType === 'monteur'

  const dayTermine = useMemo(
    () => termine.filter((t) => isSameDay(parseISO(t.start_zeit), selectedDate)),
    [termine, selectedDate],
  )

  const columns = useMemo(() => {
    const cols = fahrzeuge.map((fz) => ({ fahrzeug: fz, termine: [], abwesenheiten: [] }))
    const colIndexMap = new Map(fahrzeuge.map((fz, i) => [fz.id, i]))
    for (const termin of dayTermine) {
      if (isMonteurView) {
        const mIds = (termin.termin_ressourcen || []).filter((r) => r.ressourcen?.typ === 'monteur').map((r) => r.ressource_id)
        for (const mId of mIds) { const idx = colIndexMap.get(mId); if (idx !== undefined) cols[idx].termine.push(termin) }
      } else {
        const fzId = getFahrzeugId(termin)
        const idx = colIndexMap.get(fzId)
        if (idx !== undefined) cols[idx].termine.push(termin)
      }
    }
    for (const ab of abwesenheiten) {
      if (!isSameDay(parseISO(ab.datum), selectedDate)) continue
      const idx = colIndexMap.get(ab.ressource_id)
      if (idx !== undefined) cols[idx].abwesenheiten.push(ab)
    }
    return cols
  }, [dayTermine, fahrzeuge, abwesenheiten, selectedDate, isMonteurView])

  // Two-phase drag: pendingDrag (mousedown) → drag (after 8px)
  const handleDragStart = useCallback((termin, e) => {
    setPendingDrag({ termin, startMouseX: e.clientX, startMouseY: e.clientY, startPct: timeToPct(parseISO(termin.start_zeit)) })
  }, [])

  useEffect(() => {
    if (!pendingDrag) return
    const onMove = (e) => {
      if (Math.abs(e.clientX - pendingDrag.startMouseX) >= 8 || Math.abs(e.clientY - pendingDrag.startMouseY) >= 8) {
        const gridEl = gridRef.current
        if (!gridEl) { setPendingDrag(null); return }
        const fzId = getFahrzeugId(pendingDrag.termin)
        const colIdx = fahrzeuge.findIndex((f) => f.id === fzId)
        setDrag({ termin: pendingDrag.termin, startMouseX: pendingDrag.startMouseX, startMouseY: pendingDrag.startMouseY, startPct: pendingDrag.startPct, colIdx, currentY: e.clientY, currentX: e.clientX, gridRect: gridEl.getBoundingClientRect() })
        setPendingDrag(null)
      }
    }
    const onUp = () => { onTerminClick?.(pendingDrag.termin); setPendingDrag(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [pendingDrag, fahrzeuge, onTerminClick])

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => setDrag((prev) => prev ? { ...prev, currentY: e.clientY, currentX: e.clientX } : null)
    const onUp = (e) => {
      if (!drag || !gridRef.current) { setDrag(null); return }
      const gridRect = gridRef.current.getBoundingClientRect()
      const gridH = gridRect.height
      const deltaY = e.clientY - drag.startMouseY
      const deltaPct = (deltaY / gridH) * 100
      const newPct = Math.max(0, Math.min(100, drag.startPct + deltaPct))
      const newTime = pctToTime(newPct)
      const start = parseISO(drag.termin.start_zeit)
      const end = parseISO(drag.termin.end_zeit)
      const dur = end.getTime() - start.getTime()
      const newStart = new Date(selectedDate); newStart.setHours(newTime.h, newTime.m, 0, 0)
      const newEnd = new Date(newStart.getTime() + dur)
      const colCount = fahrzeuge.length
      const timeColW = 48
      const relX = e.clientX - gridRect.left - timeColW
      let tgtCol = Math.floor((relX / (gridRect.width - timeColW)) * colCount)
      tgtCol = Math.max(0, Math.min(tgtCol, colCount - 1))
      onTerminDrop?.(drag.termin.id, newStart.toISOString(), newEnd.toISOString(), fahrzeuge[tgtCol]?.id)
      setDrag(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag, selectedDate, fahrzeuge, onTerminDrop])

  // Slot click-drag
  const [slotDrag, setSlotDrag] = useState(null)
  const handleSlotMouseDown = useCallback((e, fahrzeugId) => {
    if (e.target.closest('[data-termin]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    setSlotDrag({ fahrzeugId, rect, startY: relY, currentY: relY, gridH: rect.height })
  }, [])

  useEffect(() => {
    if (!slotDrag) return
    const onMove = (e) => {
      const relY = e.clientY - slotDrag.rect.top
      setSlotDrag((prev) => prev ? { ...prev, currentY: Math.max(0, Math.min(relY, prev.gridH)) } : null)
    }
    const onUp = (e) => {
      if (!slotDrag || !onSlotClick) { setSlotDrag(null); return }
      const relY = e.clientY - slotDrag.rect.top
      const minY = Math.min(slotDrag.startY, relY)
      const maxY = Math.max(slotDrag.startY, relY)
      const startPct = yToPct(minY, slotDrag.gridH)
      const endPct = yToPct(maxY, slotDrag.gridH)
      const startTime = pctToTime(startPct)
      const endTime = pctToTime(endPct)
      const isClick = Math.abs(maxY - minY) < 15
      const startDate = new Date(selectedDate); startDate.setHours(startTime.h, startTime.m, 0, 0)
      const endDate = new Date(selectedDate)
      if (isClick) endDate.setHours(startTime.h + 1, startTime.m, 0, 0)
      else endDate.setHours(endTime.h, endTime.m, 0, 0)
      setSlotDrag(null)
      onSlotClick(startDate, slotDrag.fahrzeugId, endDate)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [slotDrag, onSlotClick, selectedDate])

  if (fahrzeuge.length === 0) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">Keine Fahrzeuge konfiguriert</div>
  }

  const ghostStyle = drag ? { top: drag.currentY - 12, left: drag.currentX + 8, width: 160 } : null

  return (
    <div className="bg-surface-card h-full flex flex-col">
      {/* Column headers — fixed at top */}
      <div className="flex shrink-0 border-b border-border-default">
        <div className="w-12 shrink-0 bg-surface-main border-r border-border-default h-9" />
        {columns.map((col) => (
          <div key={col.fahrzeug.id} className="flex-1 min-w-[140px] h-9 flex items-center justify-center gap-1.5 bg-surface-main px-2 border-r border-border-default last:border-r-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.fahrzeug.farbe || '#6B7280' }} />
            <span className="text-xs font-semibold text-text-primary truncate">{col.fahrzeug.name}</span>
          </div>
        ))}
      </div>

      {/* Grid body — fills remaining height */}
      <div ref={gridRef} className="flex flex-1 min-h-0">
        {/* Time labels column */}
        <div className="w-12 shrink-0 bg-surface-main border-r border-border-default relative">
          <TimeSlotLabels />
        </div>

        {/* Data columns */}
        {columns.map((col) => (
          <div key={col.fahrzeug.id}
            className="flex-1 min-w-[140px] border-r border-border-default last:border-r-0 relative cursor-crosshair select-none"
            onMouseDown={(e) => handleSlotMouseDown(e, col.fahrzeug.id)}>

            <div className="absolute inset-0 pointer-events-none"><GridLines /></div>

            {slotDrag && slotDrag.fahrzeugId === col.fahrzeug.id && (() => {
              const minY = Math.min(slotDrag.startY, slotDrag.currentY)
              const maxY = Math.max(slotDrag.startY, slotDrag.currentY)
              if (maxY - minY < 5) return null
              const sPct = yToPct(minY, slotDrag.gridH)
              const ePct = yToPct(maxY, slotDrag.gridH)
              return (
                <div className="absolute inset-x-1 rounded-md z-20 pointer-events-none border-2 border-brand/50 flex items-center justify-center"
                  style={{ top: `${sPct}%`, height: `${ePct - sPct}%`, backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                  <span className="text-xs font-medium text-brand bg-surface-card/90 px-2 py-0.5 rounded">
                    {pctToTime(sPct).str} – {pctToTime(ePct).str}
                  </span>
                </div>
              )
            })()}

            {col.abwesenheiten.map((ab) => <AbwesenheitBlock key={ab.id} abwesenheit={ab} />)}

            {col.termine.map((termin) => (
              <TerminBlock key={termin.id} termin={termin}
                hasAzmWarning={checkAzmWarning(termin, arbeitszeitmodelle, selectedDate)}
                onTerminClick={onTerminClick} onTerminHover={onTerminHover}
                onTerminHoverEnd={onTerminHoverEnd} onDragStart={handleDragStart} />
            ))}

            {showToday && <CurrentTimeMarker />}
          </div>
        ))}
      </div>

      {drag && <DragGhost termin={drag.termin} {...ghostStyle} />}
    </div>
  )
}
