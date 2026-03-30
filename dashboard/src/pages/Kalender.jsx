import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Filter } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { de } from 'date-fns/locale'

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const getKontaktName = (kontakt) => {
  if (!kontakt) return 'Unbekannt'
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find(p => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
}

export default function Kalender() {
  const calendarRef = useRef(null)
  const [termine, setTermine] = useState([])
  const [terminArten, setTerminArten] = useState([])
  const [fahrzeuge, setFahrzeuge] = useState([])
  const [abwesenheiten, setAbwesenheiten] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [currentDate, setCurrentDate] = useState(new Date())

  // Load termin_arten once
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('termin_arten')
        .select('*')
        .order('sort_order')
      if (data) {
        setTerminArten(data)
        setActiveFilters(new Set(data.map(a => a.id)))
      }
    }
    load()
  }, [])

  // Load fahrzeuge (resources)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('ressourcen')
        .select('*')
        .eq('typ', 'fahrzeug')
        .eq('aktiv', true)
        .order('sort_order')
      if (data) {
        setFahrzeuge(data.filter(r => r.eigenschaften?.typ === 'bus'))
      }
    }
    load()
  }, [])

  // Load termine for current week
  const loadTermine = useCallback(async () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr = format(weekEnd, 'yyyy-MM-dd')

    setLoading(true)

    const [terminResult, abwesenheitResult] = await Promise.all([
      supabase
        .from('termine')
        .select(`
          *,
          termin_arten(*),
          termin_ressourcen(*, ressourcen(*)),
          kontakte:kontakt_id(id, firma1, kontakt_personen(vorname, nachname, ist_hauptkontakt))
        `)
        .gte('start_zeit', `${startStr}T00:00:00`)
        .lte('start_zeit', `${endStr}T23:59:59`),
      supabase
        .from('abwesenheiten')
        .select('*, ressourcen(*)')
        .gte('datum', startStr)
        .lte('datum', endStr),
    ])

    if (terminResult.data) setTermine(terminResult.data)
    if (abwesenheitResult.data) setAbwesenheiten(abwesenheitResult.data)
    setLoading(false)
  }, [currentDate])

  useEffect(() => { loadTermine() }, [loadTermine])

  // Build FullCalendar resources from fahrzeuge
  const resources = useMemo(() =>
    fahrzeuge.map(f => ({
      id: f.id,
      title: f.name,
      kuerzel: f.kuerzel,
      farbe: f.farbe,
    })),
    [fahrzeuge]
  )

  // Build FullCalendar events from termine + abwesenheiten
  const events = useMemo(() => {
    const terminEvents = termine
      .filter(t => activeFilters.has(t.art_id))
      .flatMap(t => {
        const artFarbe = t.termin_arten?.farbe || '#6B7280'
        const artName = t.termin_arten?.name || ''
        const kontaktName = getKontaktName(t.kontakte)
        const monteure = (t.termin_ressourcen || [])
          .filter(tr => tr.ressourcen?.typ === 'mitarbeiter')
          .map(tr => tr.ressourcen?.kuerzel || '?')
        const fahrzeugRessourcen = (t.termin_ressourcen || [])
          .filter(tr => tr.ressourcen?.typ === 'fahrzeug')

        // If no fahrzeug assigned, show once without resourceId
        const resourceIds = fahrzeugRessourcen.length > 0
          ? fahrzeugRessourcen.map(tr => tr.ressource_id)
          : [undefined]

        return resourceIds.map(resId => ({
          id: resId ? `${t.id}_${resId}` : t.id,
          title: kontaktName,
          start: t.start_zeit,
          end: t.end_zeit,
          resourceId: resId,
          backgroundColor: artFarbe,
          borderColor: artFarbe,
          textColor: '#FFFFFF',
          extendedProps: {
            termin: t,
            artName,
            artFarbe,
            monteure,
            kontaktName,
          },
        }))
      })

    const bgEvents = abwesenheiten.flatMap(a => {
      const start = a.ganztaegig ? `${a.datum}T07:00:00` : `${a.datum}T${a.von_zeit}`
      const end = a.ganztaegig ? `${a.datum}T17:00:00` : `${a.datum}T${a.bis_zeit}`
      return {
        id: `abw_${a.id}`,
        start,
        end,
        resourceId: a.ressource_id,
        display: 'background',
        backgroundColor: '#E5E7EB',
        extendedProps: { abwesenheit: a },
      }
    })

    return [...terminEvents, ...bgEvents]
  }, [termine, abwesenheiten, activeFilters])

  // Navigation
  const goToday = () => {
    setCurrentDate(new Date())
    calendarRef.current?.getApi().today()
  }
  const goPrev = () => {
    setCurrentDate(d => subWeeks(d, 1))
    calendarRef.current?.getApi().prev()
  }
  const goNext = () => {
    setCurrentDate(d => addWeeks(d, 1))
    calendarRef.current?.getApi().next()
  }

  // Filter toggle
  const toggleFilter = (artId) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(artId)) next.delete(artId)
      else next.add(artId)
      return next
    })
  }

  const toggleAllFilters = () => {
    if (activeFilters.size === terminArten.length) {
      setActiveFilters(new Set())
    } else {
      setActiveFilters(new Set(terminArten.map(a => a.id)))
    }
  }

  // Event click → dispatch custom event
  const handleEventClick = (info) => {
    const termin = info.event.extendedProps.termin
    if (!termin) return // skip background events
    window.dispatchEvent(new CustomEvent('termin-detail-open', { detail: termin }))
  }

  // Click on empty slot → dispatch create event
  const handleDateSelect = (info) => {
    window.dispatchEvent(new CustomEvent('termin-create-open', {
      detail: {
        start: info.startStr,
        end: info.endStr,
        resourceId: info.resource?.id || null,
      },
    }))
  }

  // Custom event rendering
  const renderEventContent = (eventInfo) => {
    const { artName, artFarbe, monteure, kontaktName } = eventInfo.event.extendedProps
    if (!artName) return null // background event

    return (
      <div className="flex flex-col h-full overflow-hidden px-1 py-0.5 text-xs leading-tight">
        <div className="flex items-center gap-1 min-w-0">
          <span
            className="inline-block shrink-0 rounded px-1 py-px text-[10px] font-semibold leading-none"
            style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: '#fff' }}
          >
            {artName}
          </span>
        </div>
        <div className="font-medium truncate mt-0.5">{kontaktName}</div>
        {monteure.length > 0 && (
          <div className="flex gap-0.5 mt-auto pt-0.5">
            {monteure.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center rounded-full text-[9px] font-bold leading-none"
                style={{
                  width: 18, height: 18,
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  const weekLabel = useMemo(() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
    const we = endOfWeek(currentDate, { weekStartsOn: 1, })
    return `${format(ws, 'd. MMM', { locale: de })} – ${format(we, 'd. MMM yyyy', { locale: de })}`
  }, [currentDate])

  return (
    <div className="min-h-screen bg-surface-main p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-brand" />
          <h1 className="text-2xl font-bold text-text-primary">Kalender</h1>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
          >
            Heute
          </button>
          <button
            onClick={goPrev}
            className="rounded-lg border border-border-default bg-surface-card p-1.5 text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[200px] text-center text-sm font-medium text-text-primary">
            {weekLabel}
          </span>
          <button
            onClick={goNext}
            className="rounded-lg border border-border-default bg-surface-card p-1.5 text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-text-muted shrink-0" />
        <button
          onClick={toggleAllFilters}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            activeFilters.size === terminArten.length
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-surface-card text-text-secondary border-border-default hover:bg-surface-hover'
          }`}
        >
          Alle
        </button>
        {terminArten.map(art => (
          <button
            key={art.id}
            onClick={() => toggleFilter(art.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              activeFilters.has(art.id)
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-surface-card text-text-secondary border-border-default hover:bg-surface-hover'
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: art.farbe }}
            />
            {art.name}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-lg bg-surface-card p-4 shadow-sm border border-border-default">
        {loading ? (
          <div className="flex h-[600px] items-center justify-center text-text-muted">
            Laden...
          </div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[resourceTimelinePlugin, timeGridPlugin, interactionPlugin]}
            initialView="resourceTimelineWeek"
            initialDate={currentDate}
            resources={resources}
            events={events}
            locale="de"
            headerToolbar={false}
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="17:00:00"
            slotDuration="00:30:00"
            hiddenDays={[0, 6]}
            selectable={true}
            selectMirror={true}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventContent={renderEventContent}
            resourceAreaHeaderContent="Fahrzeug"
            resourceAreaWidth="120px"
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
            resourceLabelContent={(arg) => (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: arg.resource.extendedProps.farbe || '#6B7280' }}
                />
                <span className="text-xs font-medium text-text-primary truncate">
                  {arg.resource.title}
                </span>
              </div>
            )}
            nowIndicator={true}
            dayHeaderFormat={{ weekday: 'short', day: 'numeric', month: 'numeric' }}
          />
        )}
      </div>
    </div>
  )
}
