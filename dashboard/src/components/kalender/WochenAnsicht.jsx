import { useMemo } from 'react'
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

const isAbgesagt = (termin) => termin.status === 'abgesagt'

function TerminKachel({ termin, isContinuation, onTerminClick, onTerminHover, onTerminHoverEnd }) {
  const abgesagt = isAbgesagt(termin)
  const farbe = termin.termin_arten?.farbe || '#6B7280'
  const monteure = getMonteurKuerzel(termin)
  const kontaktName = getKontaktName(termin.kontakte)

  const handleMouseEnter = (e) => {
    if (onTerminHover) {
      const rect = e.currentTarget.getBoundingClientRect()
      onTerminHover(termin, rect)
    }
  }

  return (
    <button
      type="button"
      className={`
        group w-full text-left rounded-md px-2 py-1.5 text-xs
        transition-all cursor-pointer border border-transparent
        hover:shadow-md hover:scale-[1.02] hover:border-white/20
        ${abgesagt ? 'opacity-50' : ''}
      `}
      style={{
        backgroundColor: abgesagt ? `${farbe}33` : `${farbe}22`,
        borderLeftWidth: '3px',
        borderLeftColor: farbe,
      }}
      onClick={() => onTerminClick?.(termin)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onTerminHoverEnd?.()}
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
    </button>
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
}) {
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Build lookup: fahrzeugId -> dayIndex -> termine[]
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
      const fzId = getFahrzeugId(termin)
      if (!fzId || !map.has(fzId)) continue

      const row = map.get(fzId)
      const start = parseISO(termin.start_zeit)
      const end = parseISO(termin.end_zeit)

      for (let d = 0; d < 5; d++) {
        const day = weekDays[d]
        if (isSameDay(start, day)) {
          row.get(d).push({ termin, isContinuation: false })
        } else if (start < day && end > day) {
          // Multi-day: continuation
          row.get(d).push({ termin, isContinuation: true })
        }
      }
    }

    return map
  }, [termine, fahrzeuge, weekDays])

  if (fahrzeuge.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Keine Fahrzeuge konfiguriert
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
      <table className="w-full border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-border-default">
            <th className="w-32 px-3 py-2 text-left text-xs font-semibold text-text-secondary bg-surface-main sticky left-0 z-10">
              Fahrzeug
            </th>
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date())
              return (
                <th
                  key={i}
                  className={`px-2 py-2 text-center text-sm font-semibold border-l border-border-default ${
                    isToday ? 'text-brand bg-brand/5' : 'text-text-primary bg-surface-main'
                  }`}
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
                  return (
                    <td
                      key={dIdx}
                      className={`px-1 py-1 align-top border-l border-border-default min-h-[60px] ${
                        isToday ? 'bg-brand/5' : 'bg-surface-card'
                      } ${items.length === 0 ? 'cursor-pointer hover:bg-surface-hover transition-colors' : ''}`}
                      onClick={() => {
                        if (items.length === 0) {
                          onSlotClick?.(day, fz.id)
                        }
                      }}
                    >
                      <div className="flex flex-col gap-1 min-h-[50px]">
                        {items.map(({ termin, isContinuation }) => (
                          <TerminKachel
                            key={`${termin.id}-${isContinuation ? 'cont' : 'main'}`}
                            termin={termin}
                            isContinuation={isContinuation}
                            onTerminClick={onTerminClick}
                            onTerminHover={onTerminHover}
                            onTerminHoverEnd={onTerminHoverEnd}
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
    </div>
  )
}
