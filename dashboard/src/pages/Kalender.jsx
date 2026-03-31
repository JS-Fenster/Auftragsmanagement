import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Filter, Calendar, LayoutGrid, Users, Layers, List, Car } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import { de } from 'date-fns/locale'
import WochenAnsicht from '../components/kalender/WochenAnsicht'
import WochenZeitansicht from '../components/kalender/WochenZeitansicht'
import TagesAnsicht from '../components/kalender/TagesAnsicht'
import MonteurAuslastung from '../components/kalender/MonteurAuslastung'
import TerminPopover from '../components/kalender/TerminPopover'

export default function Kalender() {
  // Core state
  const [zeitraum, setZeitraum] = useState('woche') // 'woche' | 'tag'
  const [spalten, setSpalten] = useState('fahrzeuge') // 'fahrzeuge' | 'monteure'
  const [wochenModus, setWochenModus] = useState('kachel') // 'kachel' | 'gruppe'
  const [currentDate, setCurrentDate] = useState(new Date())

  // Data state
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
        // Only standard monteure (gruppe='monteur'), exclude geschaeftsfuehrung/buero
        // Falls gruppe noch NULL (Migration pending), alle Monteure zeigen
        setMonteure(resResult.data.filter(r => r.typ === 'monteur' && (r.gruppe === 'monteur' || !r.gruppe)))
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

  // Reload when a termin is saved/changed
  useEffect(() => {
    const handleSaved = () => loadTermine()
    window.addEventListener('termin-saved', handleSaved)
    return () => window.removeEventListener('termin-saved', handleSaved)
  }, [loadTermine])

  // Filter termine by active termin_arten
  const filteredTermine = useMemo(
    () => termine.filter(t => activeFilters.has(t.art_id)),
    [termine, activeFilters]
  )

  // Navigation
  const goToday = () => setCurrentDate(new Date())
  const isDay = zeitraum === 'tag'
  const goPrev = () => {
    if (isDay) setCurrentDate(d => subDays(d, 1))
    else setCurrentDate(d => subWeeks(d, 1))
  }
  const goNext = () => {
    if (isDay) setCurrentDate(d => addDays(d, 1))
    else setCurrentDate(d => addWeeks(d, 1))
  }

  // Date label
  const dateLabel = useMemo(() => {
    if (isDay) {
      return format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })
    }
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
    const we = endOfWeek(currentDate, { weekStartsOn: 1 })
    return `${format(ws, 'd. MMM', { locale: de })} – ${format(we, 'd. MMM yyyy', { locale: de })}`
  }, [currentDate, isDay])

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
    window.dispatchEvent(new CustomEvent('termin-edit-open', { detail: { termin } }))
  }

  const handleTerminHover = (termin, rect) => {
    setHoveredTermin(termin)
    setPopoverPos({ x: rect.right + 8, y: rect.top })
  }
  const handleTerminHoverEnd = () => {
    setHoveredTermin(null)
    setPopoverPos(null)
  }

  const handleSlotClick = (startDate, fahrzeugId, endDate) => {
    const startTime = typeof startDate === 'string' ? startDate : startDate.toISOString()
    const endTime = endDate ? (typeof endDate === 'string' ? endDate : endDate.toISOString()) : null
    window.dispatchEvent(new CustomEvent('termin-create-open', {
      detail: { start: startTime, end: endTime, resourceId: fahrzeugId },
    }))
  }

  const handleDayClick = (date) => {
    setCurrentDate(date)
    setZeitraum('tag')
  }

  // Drag & Drop with confirmation dialog
  const [pendingDrop, setPendingDrop] = useState(null)

  const handleTerminDrop = useCallback((terminId, newStart, newEnd, newFahrzeugId) => {
    const termin = termine.find(t => t.id === terminId)
    setPendingDrop({ terminId, termin, newStart, newEnd, newFahrzeugId })
  }, [termine])

  const confirmDrop = useCallback(async () => {
    if (!pendingDrop) return
    const { terminId, newStart, newEnd, newFahrzeugId } = pendingDrop

    const { error } = await supabase
      .from('termine')
      .update({ start_zeit: newStart, end_zeit: newEnd, bearbeitet_von: 'Dashboard' })
      .eq('id', terminId)

    if (error) {
      console.error('Termin verschieben fehlgeschlagen:', error)
      setPendingDrop(null)
      return
    }

    if (newFahrzeugId) {
      const oldFahrzeug = pendingDrop.termin?.termin_ressourcen?.find(r => r.ressourcen?.typ === 'fahrzeug')
      if (oldFahrzeug && oldFahrzeug.ressource_id !== newFahrzeugId) {
        await supabase
          .from('termin_ressourcen')
          .update({ ressource_id: newFahrzeugId })
          .eq('termin_id', terminId)
          .eq('ressource_id', oldFahrzeug.ressource_id)
      }
    }

    setPendingDrop(null)
    loadTermine()
  }, [pendingDrop, loadTermine])

  const cancelDrop = () => {
    setPendingDrop(null)
    loadTermine()
  }

  // Monteur cell click in Auslastung
  const handleMonteurCellClick = (monteurId, date) => {
    setCurrentDate(date)
    setZeitraum('tag')
    setSpalten('monteure')
  }

  // Determine active columns for TagesAnsicht
  const activeColumns = spalten === 'monteure' ? monteure : fahrzeuge
  const columnType = spalten === 'monteure' ? 'monteur' : 'fahrzeug'

  return (
    <div className="h-full flex flex-col bg-surface-main px-4 pt-2 pb-0 overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-brand" />
          <h1 className="text-2xl font-bold text-text-primary">Kalender</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zeitraum: Woche / Tag */}
          <div className="flex rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <button
              onClick={() => setZeitraum('woche')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                zeitraum === 'woche' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Woche
            </button>
            <button
              onClick={() => setZeitraum('tag')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                zeitraum === 'tag' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Tag
            </button>
          </div>

          {/* Spalten: Fahrzeuge / Monteure */}
          <div className="flex rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <button
              onClick={() => setSpalten('fahrzeuge')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                spalten === 'fahrzeuge' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              Fahrzeuge
            </button>
            <button
              onClick={() => setSpalten('monteure')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                spalten === 'monteure' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Monteure
            </button>
          </div>

          {/* Wochenansicht Darstellung: Kacheln / Gruppe — always visible, disabled in Tag */}
          <div className={`flex rounded-lg border border-border-default bg-surface-card overflow-hidden ${zeitraum !== 'woche' ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              onClick={() => setWochenModus('kachel')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                wochenModus === 'kachel' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
              title="Kachel-Ansicht"
            >
              <List className="h-3.5 w-3.5" />
              Kacheln
            </button>
            <button
              onClick={() => setWochenModus('gruppe')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                wochenModus === 'gruppe' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
              title="Gruppendarstellung"
            >
              <Layers className="h-3.5 w-3.5" />
              Gruppe
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 ml-1">
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
      <div className="mb-2 flex items-center gap-2 flex-wrap shrink-0">
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

      {/* Calendar + Auslastung wrapper */}
      <div className="flex-1 min-h-0 flex flex-col">
      {/* Calendar View */}
      <div className="flex-1 min-h-0 rounded-lg bg-surface-card shadow-sm border border-border-default">
        {loading ? (
          <div className="flex h-[500px] items-center justify-center text-text-muted">
            Laden...
          </div>
        ) : zeitraum === 'woche' && wochenModus === 'gruppe' ? (
          <WochenZeitansicht
            termine={filteredTermine}
            currentDate={currentDate}
            columnType={columnType}
            onTerminClick={handleTerminClick}
            onTerminHover={handleTerminHover}
            onTerminHoverEnd={handleTerminHoverEnd}
            onSlotClick={handleSlotClick}
            onDayClick={handleDayClick}
          />
        ) : zeitraum === 'woche' ? (
          <WochenAnsicht
            termine={filteredTermine}
            fahrzeuge={spalten === 'monteure' ? monteure : fahrzeuge}
            monteure={monteure}
            currentDate={currentDate}
            onTerminClick={handleTerminClick}
            onTerminHover={handleTerminHover}
            onTerminHoverEnd={handleTerminHoverEnd}
            onSlotClick={handleSlotClick}
            onDayClick={handleDayClick}
            columnType={columnType}
          />
        ) : (
          <TagesAnsicht
            termine={filteredTermine}
            fahrzeuge={activeColumns}
            monteure={monteure}
            arbeitszeitmodelle={arbeitszeitmodelle}
            abwesenheiten={abwesenheiten}
            selectedDate={currentDate}
            onTerminClick={handleTerminClick}
            onTerminHover={handleTerminHover}
            onTerminHoverEnd={handleTerminHoverEnd}
            onSlotClick={handleSlotClick}
            onTerminDrop={handleTerminDrop}
            columnType={columnType}
          />
        )}
      </div>

      {/* Monteur Availability Strip */}
      <div className="shrink-0 mt-3 mb-4 rounded-lg bg-surface-card shadow-sm border border-border-default overflow-hidden">
        <div className="px-3 py-1.5 border-b border-border-default">
          <h2 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-text-muted" />
            Monteur-Auslastung
          </h2>
        </div>
        <MonteurAuslastung
          termine={filteredTermine}
          monteure={monteure}
          fahrzeuge={fahrzeuge}
          arbeitszeitmodelle={arbeitszeitmodelle}
          abwesenheiten={abwesenheiten}
          currentDate={currentDate}
          zeitraum={zeitraum}
          spalten={spalten}
          highlightDate={isDay ? currentDate : null}
          onCellClick={handleMonteurCellClick}
        />
      </div>
      </div>{/* end scroll wrapper */}

      {/* Hover Popover */}
      <TerminPopover termin={hoveredTermin} position={popoverPos} />

      {/* Drag & Drop Confirmation Dialog */}
      {pendingDrop && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={cancelDrop} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-surface-card rounded-xl shadow-2xl border border-border-default p-5 w-80">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Termin verschieben?</h3>
            <p className="text-xs text-text-secondary mb-1">
              <span className="font-medium">{pendingDrop.termin?.titel}</span>
            </p>
            <p className="text-xs text-text-muted mb-3">
              Neue Zeit: {new Date(pendingDrop.newStart).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(pendingDrop.newEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmDrop}
                className="flex-1 px-3 py-2 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90 transition-opacity"
              >
                Verschieben
              </button>
              <button
                onClick={cancelDrop}
                className="flex-1 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
