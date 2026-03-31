import { useMemo } from 'react'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { de } from 'date-fns/locale'

const WOCHENTAG_KEYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
const WOCHENTAG_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

const getActiveAZM = (azModelle, ressourceId, date) => {
  const dateStr = format(date, 'yyyy-MM-dd')
  return azModelle.find(m =>
    m.ressource_id === ressourceId &&
    m.gueltig_ab <= dateStr &&
    (!m.gueltig_bis || m.gueltig_bis >= dateStr)
  )
}

const getVerfuegbareStunden = (azm, date) => {
  if (!azm) return 9
  const dayKey = WOCHENTAG_KEYS[date.getDay()]
  const dayConfig = azm[dayKey]
  if (!dayConfig) return 0
  const [sh, sm] = dayConfig.start.split(':').map(Number)
  const [eh, em] = dayConfig.ende.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

const getAbwesenheit = (abwesenheiten, ressourceId, date) => {
  const dateStr = format(date, 'yyyy-MM-dd')
  return abwesenheiten.find(a =>
    a.ressource_id === ressourceId &&
    a.datum === dateStr
  )
}

const getGebuchteStunden = (termine, ressourceId, date) => {
  return termine
    .filter(t => {
      const tDate = new Date(t.start_zeit)
      return isSameDay(tDate, date) &&
        t.termin_ressourcen?.some(r => r.ressource_id === ressourceId)
    })
    .reduce((sum, t) => {
      const start = new Date(t.start_zeit)
      const end = new Date(t.end_zeit)
      const hours = (end - start) / (1000 * 60 * 60)
      return sum + hours
    }, 0)
}

const getFuellgradStyle = (prozent, abwesend, azmFrei) => {
  if (azmFrei) {
    return { text: '--', textColor: 'text-text-muted' }
  }
  if (abwesend) {
    const label = abwesend.typ === 'urlaub' ? 'Urlaub' : abwesend.typ === 'krank' ? 'Krank' : abwesend.typ || 'Abwesend'
    return { text: label, textColor: 'text-text-muted', striped: true }
  }
  if (prozent === 0) {
    return { text: 'frei', textColor: 'text-text-muted' }
  }
  if (prozent <= 50) {
    return { text: `${Math.round(prozent)}%`, textColor: 'text-amber-700', bgHex: '#FEF3C7', barHex: '#F59E0B' }
  }
  if (prozent <= 80) {
    return { text: `${Math.round(prozent)}%`, textColor: 'text-blue-700', bgHex: '#EFF6FF', barHex: '#3B82F6' }
  }
  if (prozent <= 100) {
    return { text: `${Math.round(prozent)}%`, textColor: 'text-emerald-700', bgHex: '#ECFDF5', barHex: '#10B981' }
  }
  return { text: `${Math.round(prozent)}%`, textColor: 'text-red-700', bgHex: '#FEE2E2', barHex: '#EF4444' }
}

function AuslastungCell({ style, prozent, abwesend, azmFrei }) {
  if (azmFrei) {
    return (
      <div className="h-4 rounded bg-gray-200 flex items-center justify-center">
        <span className="text-text-muted text-[9px]">--</span>
      </div>
    )
  }
  if (abwesend) {
    return (
      <div className="h-4 rounded flex items-center justify-center"
        style={{ background: 'repeating-linear-gradient(135deg, #E5E7EB, #E5E7EB 2px, #F3F4F6 2px, #F3F4F6 6px)' }}>
        <span className="text-text-muted text-[9px] font-medium">{style.text}</span>
      </div>
    )
  }
  if (prozent === 0) {
    return (
      <div className="h-4 rounded flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <span className="text-text-muted text-[9px]">frei</span>
      </div>
    )
  }
  return (
    <div className="h-4 rounded relative overflow-hidden" style={{ backgroundColor: style.bgHex }}>
      <div className="absolute inset-y-0 left-0 rounded transition-all"
        style={{ width: `${Math.min(prozent, 100)}%`, backgroundColor: style.barHex, opacity: 0.6 }} />
      <span className={`relative z-10 flex items-center justify-center h-full text-[9px] font-semibold ${style.textColor}`}>
        {style.text}
      </span>
    </div>
  )
}

export default function MonteurAuslastung({
  termine = [],
  monteure = [],
  fahrzeuge = [],
  arbeitszeitmodelle = [],
  abwesenheiten = [],
  currentDate,
  zeitraum = 'woche',
  spalten = 'fahrzeuge',
  highlightDate = null,
  onCellClick,
}) {
  const weekDays = useMemo(() => {
    const monday = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i))
  }, [currentDate])

  // Wochen-Grid: Monteur x Wochentage (bisherige Ansicht)
  const weekGrid = useMemo(() => {
    return monteure.map(monteur => {
      const days = weekDays.map(date => {
        const azm = getActiveAZM(arbeitszeitmodelle, monteur.id, date)
        const verfuegbar = getVerfuegbareStunden(azm, date)
        const abwesend = getAbwesenheit(abwesenheiten, monteur.id, date)
        const gebucht = getGebuchteStunden(termine, monteur.id, date)
        const azmFrei = azm && verfuegbar === 0
        const prozent = verfuegbar > 0 ? (gebucht / verfuegbar) * 100 : 0
        const style = getFuellgradStyle(prozent, abwesend, azmFrei)
        return { date, verfuegbar, gebucht, prozent, abwesend, azmFrei, style }
      })
      return { monteur, days }
    })
  }, [monteure, weekDays, termine, arbeitszeitmodelle, abwesenheiten])

  // Tag-Grid: shows only currentDate, columns match calendar above
  const dayGrid = useMemo(() => {
    if (zeitraum !== 'tag') return null
    const date = currentDate

    return monteure.map(monteur => {
      const azm = getActiveAZM(arbeitszeitmodelle, monteur.id, date)
      const verfuegbar = getVerfuegbareStunden(azm, date)
      const abwesend = getAbwesenheit(abwesenheiten, monteur.id, date)
      const gebucht = getGebuchteStunden(termine, monteur.id, date)
      const azmFrei = azm && verfuegbar === 0
      const prozent = verfuegbar > 0 ? (gebucht / verfuegbar) * 100 : 0
      const style = getFuellgradStyle(prozent, abwesend, azmFrei)
      return { monteur, verfuegbar, gebucht, prozent, abwesend, azmFrei, style }
    })
  }, [zeitraum, currentDate, monteure, termine, arbeitszeitmodelle, abwesenheiten])

  // Wochenansicht: Mo-Fr Auslastung
  if (zeitraum === 'woche') {
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-2 py-1 text-text-secondary font-medium w-[80px] sticky left-0 bg-surface-card z-10">
                Monteur
              </th>
              {weekDays.map((day, i) => {
                const isHighlighted = highlightDate ? isSameDay(day, highlightDate) : false
                const isDimmed = highlightDate && !isHighlighted
                return (
                  <th key={i} className={`text-center px-1 py-1 font-medium transition-colors ${
                    isHighlighted ? 'text-brand bg-brand/5' : isDimmed ? 'text-text-muted opacity-50' : 'text-text-secondary'
                  }`}>
                    {WOCHENTAG_LABELS[i]}, {format(day, 'dd.MM.')}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {weekGrid.map(({ monteur, days }) => (
              <tr key={monteur.id} className="border-b border-border-default last:border-b-0">
                <td className="px-2 py-0.5 sticky left-0 bg-surface-card z-10">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: monteur.farbe || '#6B7280' }} />
                    <span className="text-text-primary font-medium truncate text-[10px]" title={monteur.name}>
                      {monteur.kuerzel || monteur.name}
                    </span>
                  </div>
                </td>
                {days.map(({ date, style, prozent, abwesend, azmFrei }, i) => {
                  const isHighlighted = highlightDate ? isSameDay(date, highlightDate) : false
                  const isDimmed = highlightDate && !isHighlighted
                  return (
                    <td key={i}
                      className={`px-0.5 py-0.5 cursor-pointer hover:bg-surface-hover transition-all ${
                        isHighlighted ? 'bg-brand/5' : isDimmed ? 'opacity-40' : ''
                      }`}
                      onClick={() => onCellClick?.(monteur.id, date)}>
                      <AuslastungCell style={style} prozent={prozent} abwesend={abwesend} azmFrei={azmFrei} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Tagesansicht: Einzeilige Auslastung pro Monteur, passend zum Tag
  if (!dayGrid) return null

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex text-xs min-w-0">
        {/* Label column */}
        <div className="w-12 shrink-0 border-r border-border-default bg-surface-card" />
        {/* One cell per monteur — shows compact auslastung */}
        <div className="flex-1 flex">
          {dayGrid.map(({ monteur, style, prozent, abwesend, azmFrei }) => (
            <div key={monteur.id} className="flex-1 min-w-[80px] px-1 py-1 border-r border-border-default last:border-r-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: monteur.farbe || '#6B7280' }} />
                <span className="text-[10px] font-medium text-text-primary truncate">{monteur.kuerzel}</span>
              </div>
              <AuslastungCell style={style} prozent={prozent} abwesend={abwesend} azmFrei={azmFrei} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
