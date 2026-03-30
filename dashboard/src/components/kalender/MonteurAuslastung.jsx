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
    return { bg: 'bg-gray-200', bar: 'bg-gray-400', text: '--', textColor: 'text-text-muted' }
  }
  if (abwesend) {
    const label = abwesend.typ === 'urlaub' ? 'Urlaub' : abwesend.typ === 'krank' ? 'Krank' : abwesend.typ || 'Abwesend'
    return { bg: 'bg-gray-100', bar: '', text: label, textColor: 'text-text-muted', striped: true }
  }
  if (prozent === 0) {
    return { bg: 'bg-gray-100', bar: '', text: 'frei', textColor: 'text-text-muted' }
  }
  if (prozent <= 50) {
    return { bg: '', bar: '', text: `${Math.round(prozent)}%`, textColor: 'text-amber-700', bgHex: '#FEF3C7', barHex: '#F59E0B' }
  }
  if (prozent <= 80) {
    return { bg: '', bar: '', text: `${Math.round(prozent)}%`, textColor: 'text-blue-700', bgHex: '#EFF6FF', barHex: '#3B82F6' }
  }
  if (prozent <= 100) {
    return { bg: '', bar: '', text: `${Math.round(prozent)}%`, textColor: 'text-emerald-700', bgHex: '#ECFDF5', barHex: '#10B981' }
  }
  return { bg: '', bar: '', text: `${Math.round(prozent)}%`, textColor: 'text-red-700', bgHex: '#FEE2E2', barHex: '#EF4444' }
}

export default function MonteurAuslastung({
  termine = [],
  monteure = [],
  arbeitszeitmodelle = [],
  abwesenheiten = [],
  currentDate,
  onCellClick,
}) {
  const weekDays = useMemo(() => {
    const monday = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i))
  }, [currentDate])

  const grid = useMemo(() => {
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

  return (
    <div className="w-full overflow-x-auto max-h-[200px] overflow-y-auto border border-border-default rounded-lg bg-surface-card">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left px-2 py-1.5 text-text-secondary font-medium w-[120px] sticky left-0 bg-surface-card z-10">
              Monteur
            </th>
            {weekDays.map((day, i) => (
              <th key={i} className="text-center px-1 py-1.5 text-text-secondary font-medium">
                {WOCHENTAG_LABELS[i]}, {format(day, 'dd.MM.')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map(({ monteur, days }) => (
            <tr key={monteur.id} className="border-b border-border-default last:border-b-0 group">
              <td className="px-2 py-1 sticky left-0 bg-surface-card z-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: monteur.farbe || '#6B7280' }}
                  />
                  <span className="text-text-primary font-medium truncate" title={monteur.name}>
                    {monteur.kuerzel || monteur.name}
                  </span>
                </div>
              </td>
              {days.map(({ date, style, prozent, abwesend, azmFrei }, i) => (
                <td
                  key={i}
                  className="px-1 py-1 cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => onCellClick?.(monteur.id, date)}
                  title={
                    azmFrei ? 'Kein Arbeitstag'
                      : abwesend ? (style.text)
                      : `${Math.round(prozent)}% Auslastung`
                  }
                >
                  {azmFrei ? (
                    <div className="h-5 rounded bg-gray-200 flex items-center justify-center">
                      <span className="text-text-muted text-[10px]">--</span>
                    </div>
                  ) : abwesend ? (
                    <div
                      className="h-5 rounded flex items-center justify-center"
                      style={{
                        background: 'repeating-linear-gradient(135deg, #E5E7EB, #E5E7EB 2px, #F3F4F6 2px, #F3F4F6 6px)',
                      }}
                    >
                      <span className="text-text-muted text-[10px] font-medium">{style.text}</span>
                    </div>
                  ) : prozent === 0 ? (
                    <div className="h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
                      <span className="text-text-muted text-[10px]">frei</span>
                    </div>
                  ) : (
                    <div className="h-5 rounded relative overflow-hidden" style={{ backgroundColor: style.bgHex }}>
                      <div
                        className="absolute inset-y-0 left-0 rounded transition-all"
                        style={{
                          width: `${Math.min(prozent, 100)}%`,
                          backgroundColor: style.barHex,
                          opacity: 0.6,
                        }}
                      />
                      <span className={`relative z-10 flex items-center justify-center h-full text-[10px] font-semibold ${style.textColor}`}>
                        {style.text}
                      </span>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {monteure.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-3 text-text-muted text-xs">
                Keine Monteure vorhanden
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
