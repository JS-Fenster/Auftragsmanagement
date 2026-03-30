import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Filter, Calendar, LayoutGrid, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import { de } from 'date-fns/locale'
import WochenAnsicht from '../components/kalender/WochenAnsicht'
import TagesAnsicht from '../components/kalender/TagesAnsicht'
import MonteurAuslastung from '../components/kalender/MonteurAuslastung'
import TerminPopover from '../components/kalender/TerminPopover'

const VIEWS = {
  woche: { label: 'Woche', icon: LayoutGrid },
  tag: { label: 'Tag', icon: Calendar },
  monteur: { label: 'Monteure', icon: Users },
}

export default function Kalender() {
  const [view, setView] = useState('woche')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [termine, setTermine] = useState([])
  const [terminArten, setTerminArten] = useState([])
  const [fahrzeuge, setFahrzeuge] = useState([])
  const [monteure, setMonteure] = useState([])
  const [arbeitszeitmodelle, setArbeitszeitmodelle] = useState([])
  const [abwesenheiten, setAbwesenheiten] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [hoveredTermin, setHoveredTermin] = useState(null)
  const [popoverPos, setPopoverPos] = useState(null)

  // Load static data once
  useEffect(() => {
    const load = async () => {
      const [artResult, resResult, azmResult] = await Promise.all([
        supabase.from('termin_arten').select('*').order('sort_order'),
        supabase.from('ressourcen').select('*').in('typ', ['fahrzeug', 'monteur']).eq('aktiv', true).order('sort_order'),
        supabase.from('arbeitszeitmodelle').select('*'),
      ])
      if (artResult.data) {
        setTerminArten(artResult.data)
        setActiveFilters(new Set(artResult.data.map(a => a.id)))
      }
      if (resResult.data) {
        setFahrzeuge(resResult.data.filter(r => r.typ === 'fahrzeug' && r.eigenschaften?.typ === 'bus'))
        setMonteure(resResult.data.filter(r => r.typ === 'monteur'))
      }
      if (azmResult.data) setArbeitszeitmodelle(azmResult.data)
    }
    load()
  }, [])

  // Load termine + abwesenheiten for current date range
  const loadTermine = useCallback(async () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr = format(weekEnd, 'yyyy-MM-dd')

    setLoading(true)
    const [terminResult, abwResult] = await Promise.all([
      supabase
        .from('termine')
        .select(`
          *,
          termin_arten(*),
          termin_ressourcen(*, ressourcen(*)),
          kontakte!kontakt_id(id, firma1, kontakt_personen!kontakt_id(vorname, nachname, ist_hauptkontakt)),
          projekte!projekt_id(id, projekt_nummer, status)
        `)
        .gte('start_zeit', `${startStr}T00:00:00`)
        .lte('start_zeit', `${endStr}T23:59:59`)
        .order('start_zeit'),
      supabase
        .from('abwesenheiten')
        .select('*, ressourcen(*)')
        .gte('datum', startStr)
        .lte('datum', endStr),
    ])

    if (terminResult.data) setTermine(terminResult.data)
    if (abwResult.data) setAbwesenheiten(abwResult.data)
    setLoading(false)
  }, [currentDate])

  useEffect(() => { loadTermine() }, [loadTermine])

  // Filter termine by active termin_arten
  const filteredTermine = useMemo(
    () => termine.filter(t => activeFilters.has(t.art_id)),
    [termine, activeFilters]
  )

  // Navigation
  const goToday = () => setCurrentDate(new Date())
  const goPrev = () => {
    if (view === 'tag') setCurrentDate(d => subDays(d, 1))
    else setCurrentDate(d => subWeeks(d, 1))
  }
  const goNext = () => {
    if (view === 'tag') setCurrentDate(d => addDays(d, 1))
    else setCurrentDate(d => addWeeks(d, 1))
  }

  // Date label
  const dateLabel = useMemo(() => {
    if (view === 'tag') {
      return format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })
    }
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
    const we = endOfWeek(currentDate, { weekStartsOn: 1 })
    return `${format(ws, 'd. MMM', { locale: de })} – ${format(we, 'd. MMM yyyy', { locale: de })}`
  }, [currentDate, view])

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
    if (activeFilters.size === terminArten.length) setActiveFilters(new Set())
    else setActiveFilters(new Set(terminArten.map(a => a.id)))
  }

  // Event handlers
  const handleTerminClick = (termin) => {
    setHoveredTermin(null)
    window.dispatchEvent(new CustomEvent('termin-detail-open', { detail: termin }))
  }

  const handleTerminHover = (termin, rect) => {
    setHoveredTermin(termin)
    setPopoverPos({ x: rect.right + 8, y: rect.top })
  }
  const handleTerminHoverEnd = () => {
    setHoveredTermin(null)
    setPopoverPos(null)
  }

  const handleSlotClick = (date, fahrzeugId) => {
    const startTime = typeof date === 'string' ? date : date.toISOString()
    window.dispatchEvent(new CustomEvent('termin-create-open', {
      detail: { start: startTime, resourceId: fahrzeugId },
    }))
  }

  const handleDayClick = (date) => {
    setCurrentDate(date)
    setView('tag')
  }

  // Drag & Drop handler for TagesAnsicht
  const handleTerminDrop = useCallback(async (terminId, newStart, newEnd, newFahrzeugId) => {
    const { error } = await supabase
      .from('termine')
      .update({ start_zeit: newStart, end_zeit: newEnd })
      .eq('id', terminId)

    if (error) {
      console.error('Termin verschieben fehlgeschlagen:', error)
      return
    }

    // If fahrzeug changed, update termin_ressourcen
    if (newFahrzeugId) {
      const termin = termine.find(t => t.id === terminId)
      const oldFahrzeug = termin?.termin_ressourcen?.find(r => r.ressourcen?.typ === 'fahrzeug')
      if (oldFahrzeug && oldFahrzeug.ressource_id !== newFahrzeugId) {
        await supabase
          .from('termin_ressourcen')
          .update({ ressource_id: newFahrzeugId })
          .eq('termin_id', terminId)
          .eq('ressource_id', oldFahrzeug.ressource_id)
      }
    }

    loadTermine()
  }, [termine, loadTermine])

  // Monteur cell click
  const handleMonteurCellClick = (monteurId, date) => {
    setCurrentDate(date)
    setView('monteur')
  }

  return (
    <div className="min-h-screen bg-surface-main p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-brand" />
          <h1 className="text-2xl font-bold text-text-primary">Kalender</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-border-default bg-surface-card overflow-hidden">
            {Object.entries(VIEWS).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === key
                    ? 'bg-brand text-white'
                    : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 ml-2">
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
            <span className="min-w-[220px] text-center text-sm font-medium text-text-primary">
              {dateLabel}
            </span>
            <button
              onClick={goNext}
              className="rounded-lg border border-border-default bg-surface-card p-1.5 text-text-secondary hover:bg-surface-hover transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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

      {/* Calendar View */}
      <div className="rounded-lg bg-surface-card shadow-sm border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex h-[500px] items-center justify-center text-text-muted">
            Laden...
          </div>
        ) : view === 'woche' ? (
          <WochenAnsicht
            termine={filteredTermine}
            fahrzeuge={fahrzeuge}
            monteure={monteure}
            currentDate={currentDate}
            onTerminClick={handleTerminClick}
            onTerminHover={handleTerminHover}
            onTerminHoverEnd={handleTerminHoverEnd}
            onSlotClick={handleSlotClick}
            onDayClick={handleDayClick}
          />
        ) : view === 'tag' ? (
          <TagesAnsicht
            termine={filteredTermine}
            fahrzeuge={fahrzeuge}
            monteure={monteure}
            arbeitszeitmodelle={arbeitszeitmodelle}
            abwesenheiten={abwesenheiten}
            selectedDate={currentDate}
            onTerminClick={handleTerminClick}
            onTerminHover={handleTerminHover}
            onTerminHoverEnd={handleTerminHoverEnd}
            onSlotClick={handleSlotClick}
            onTerminDrop={handleTerminDrop}
          />
        ) : (
          /* Monteur view — reuse TagesAnsicht with monteure as columns */
          <TagesAnsicht
            termine={filteredTermine}
            fahrzeuge={monteure}
            monteure={monteure}
            arbeitszeitmodelle={arbeitszeitmodelle}
            abwesenheiten={abwesenheiten}
            selectedDate={currentDate}
            onTerminClick={handleTerminClick}
            onTerminHover={handleTerminHover}
            onTerminHoverEnd={handleTerminHoverEnd}
            onSlotClick={handleSlotClick}
            onTerminDrop={handleTerminDrop}
            columnType="monteur"
          />
        )}
      </div>

      {/* Monteur Availability Strip */}
      <div className="mt-4 rounded-lg bg-surface-card shadow-sm border border-border-default overflow-hidden">
        <div className="px-4 py-2 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Users className="h-4 w-4 text-text-muted" />
            Monteur-Auslastung
          </h2>
        </div>
        <MonteurAuslastung
          termine={filteredTermine}
          monteure={monteure}
          arbeitszeitmodelle={arbeitszeitmodelle}
          abwesenheiten={abwesenheiten}
          currentDate={currentDate}
          onCellClick={handleMonteurCellClick}
        />
      </div>

      {/* Hover Popover */}
      <TerminPopover termin={hoveredTermin} position={popoverPos} />
    </div>
  )
}
