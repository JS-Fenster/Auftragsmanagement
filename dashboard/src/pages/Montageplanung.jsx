import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Users, Package, X, CalendarDays } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import { supabase } from '../lib/supabase'

const MONTAGE_TEAMS = [
  { id: 'mariusz_manfred', title: 'Mariusz & Manfred', color: '#3B82F6' },
  { id: 'christian_michael', title: 'Christian & Michael', color: '#10B981' },
  { id: 'stefan', title: 'Stefan', color: '#F59E0B' },
  { id: 'unassigned', title: 'Nicht zugewiesen', color: '#9CA3AF' },
]

const getKundeName = (kontakt) => {
  if (!kontakt) return 'Unbekannt'
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find(x => x.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
}

const formatCurrency = (val) => val ? `${Number(val).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR` : '-'

export default function Montageplanung() {
  const navigate = useNavigate()
  const calendarRef = useRef(null)
  const [events, setEvents] = useState([])
  const [warteschlange, setWarteschlange] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
  const [inlineEdit, setInlineEdit] = useState(null) // { projektId, datum, team }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayEvents = events.filter(e => e.start === todayStr && e.extendedProps.projekt.status !== 'erledigt')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projekte')
      .select('*, kontakte!projekte_kontakt_id_fkey(id, firma1, firma2, ort, kontakt_personen!kontakt_personen_kontakt_id_fkey(vorname, nachname, ist_hauptkontakt))')
      .in('status', ['lieferung_geplant', 'montagebereit', 'erledigt'])

    if (error) { console.error(error); setLoading(false); return }

    const withDate = []
    const withoutDate = []

    data.forEach(p => {
      const kundeName = getKundeName(p.kontakte)
      if (p.montage_datum) {
        const teamColor = MONTAGE_TEAMS.find(t => t.id === p.montage_team)?.color || '#9CA3AF'
        withDate.push({
          id: p.id,
          title: `${p.projekt_nummer} - ${kundeName}`,
          start: p.montage_datum,
          end: p.montage_datum,
          allDay: true,
          resourceId: p.montage_team || 'unassigned',
          backgroundColor: p.status === 'erledigt' ? '#D1D5DB' : teamColor,
          borderColor: 'transparent',
          textColor: p.status === 'erledigt' ? '#6B7280' : '#FFFFFF',
          extendedProps: { projekt: p, kundeName },
        })
      } else if (p.status !== 'erledigt') {
        withoutDate.push({ ...p, kundeName })
      }
    })

    setEvents(withDate)
    setWarteschlange(withoutDate)
    setLoading(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Initialize external draggable
  useEffect(() => {
    const containerEl = document.getElementById('warteschlange-container')
    if (containerEl) {
      new Draggable(containerEl, {
        itemSelector: '.warteschlange-item',
        eventData: (eventEl) => ({
          id: eventEl.dataset.projektId,
          title: eventEl.dataset.title,
          allDay: true,
        })
      })
    }
  }, [warteschlange])

  const handleEventReceive = async (info) => {
    const projektId = info.event.id
    const newDate = info.event.startStr
    const resourceId = info.event.getResources?.()?.[0]?.id || null

    const updates = { montage_datum: newDate }
    if (resourceId && resourceId !== 'unassigned') updates.montage_team = resourceId

    await supabase.from('projekte').update(updates).eq('id', projektId)
    await supabase.from('projekt_historie').insert({
      projekt_id: projektId, aktion: 'field_update', feld: 'montage_datum',
      neuer_wert: newDate, erstellt_von: 'Dashboard'
    })
    loadEvents()
  }

  const handleEventDrop = async (info) => {
    const projektId = info.event.id
    const newDate = info.event.startStr
    const oldDate = info.oldEvent.startStr
    const resourceId = info.newResource?.id || info.event.getResources?.()?.[0]?.id

    const updates = { montage_datum: newDate }
    if (resourceId && resourceId !== 'unassigned') updates.montage_team = resourceId

    await supabase.from('projekte').update(updates).eq('id', projektId)
    await supabase.from('projekt_historie').insert({
      projekt_id: projektId, aktion: 'field_update', feld: 'montage_datum',
      alter_wert: oldDate, neuer_wert: newDate, erstellt_von: 'Dashboard'
    })
    loadEvents()
  }

  const handleEventClick = (info) => {
    const rect = info.el.getBoundingClientRect()
    setPopupPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 340) })
    setSelectedEvent(info.event.extendedProps.projekt)
  }

  const handleInlineSave = async (projektId) => {
    if (!inlineEdit) return
    const updates = {}
    if (inlineEdit.datum) updates.montage_datum = inlineEdit.datum
    if (inlineEdit.team) updates.montage_team = inlineEdit.team
    if (Object.keys(updates).length === 0) return

    await supabase.from('projekte').update(updates).eq('id', projektId)
    if (updates.montage_datum) {
      await supabase.from('projekt_historie').insert({
        projekt_id: projektId, aktion: 'field_update', feld: 'montage_datum',
        neuer_wert: updates.montage_datum, erstellt_von: 'Dashboard'
      })
    }
    setInlineEdit(null)
    loadEvents()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" onClick={() => setSelectedEvent(null)}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Montageplanung</h1>
        </div>
      </div>

      {/* Today Banner */}
      {todayEvents.length > 0 && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-blue-600 shrink-0" />
          <span className="text-sm font-medium text-blue-900">
            Heute: {todayEvents.length} Montage{todayEvents.length !== 1 ? 'n' : ''} —{' '}
            {todayEvents.map(e => e.title).join(', ')}
          </span>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-1 min-w-0 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          {loading ? (
            <div className="flex h-96 items-center justify-center text-gray-400">Laden...</div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, resourceTimelinePlugin]}
              initialView="resourceTimelineWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimelineWeek,dayGridMonth,timeGridWeek'
              }}
              locale="de"
              firstDay={1}
              resources={MONTAGE_TEAMS}
              events={events}
              editable={true}
              droppable={true}
              eventDrop={handleEventDrop}
              eventReceive={handleEventReceive}
              eventClick={handleEventClick}
              height="auto"
              resourceAreaHeaderContent="Montage-Team"
              slotDuration={{ days: 1 }}
              buttonText={{
                today: 'Heute',
                month: 'Monat',
                week: 'Woche',
                resourceTimelineWeek: 'Team-Ansicht'
              }}
            />
          )}
        </div>

        {/* Warteschlange Sidebar */}
        <div className="w-80 shrink-0">
          <div className="rounded-lg bg-white shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                Warteschlange ({warteschlange.length})
              </h2>
            </div>
            <div id="warteschlange-container" className="max-h-[calc(100vh-260px)] overflow-y-auto p-3 space-y-2">
              {warteschlange.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Keine offenen Montagen</p>
              )}
              {warteschlange.map(p => (
                <div
                  key={p.id}
                  className="warteschlange-item rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-grab hover:shadow-md hover:border-blue-300 transition-all"
                  draggable="true"
                  data-projekt-id={p.id}
                  data-title={`${p.projekt_nummer} - ${p.kundeName}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.projekt_nummer}</p>
                      <p className="text-xs text-gray-600 truncate">{p.kundeName}</p>
                      {p.kontakte?.ort && <p className="text-xs text-gray-400">{p.kontakte.ort}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      {p.status === 'montagebereit' ? 'bereit' : 'Lieferung'}
                    </span>
                  </div>
                  {(p.auftrags_wert || p.angebots_wert) && (
                    <p className="mt-1 text-xs text-gray-500">{formatCurrency(p.auftrags_wert || p.angebots_wert)}</p>
                  )}

                  {/* Inline Termin setzen */}
                  {inlineEdit?.projektId === p.id ? (
                    <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="date"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        value={inlineEdit.datum || ''}
                        onChange={e => setInlineEdit(prev => ({ ...prev, datum: e.target.value }))}
                      />
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        value={inlineEdit.team || ''}
                        onChange={e => setInlineEdit(prev => ({ ...prev, team: e.target.value }))}
                      >
                        <option value="">Team waehlen...</option>
                        {MONTAGE_TEAMS.filter(t => t.id !== 'unassigned').map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleInlineSave(p.id)}
                          disabled={!inlineEdit.datum}
                          className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                          Speichern
                        </button>
                        <button
                          onClick={() => setInlineEdit(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setInlineEdit({ projektId: p.id, datum: '', team: '' }) }}
                      className="mt-2 w-full rounded border border-dashed border-gray-300 py-1 text-[11px] text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      Termin setzen
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Popup */}
      {selectedEvent && (
        <div
          className="fixed z-50 w-80 rounded-lg bg-white shadow-xl border border-gray-200 p-4"
          style={{ top: Math.min(popupPos.top, window.innerHeight - 280), left: popupPos.left }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">{selectedEvent.projekt_nummer}</h3>
            <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Kunde</span>
              <span className="font-medium text-gray-900">{getKundeName(selectedEvent.kontakte)}</span>
            </div>
            {selectedEvent.kontakte?.ort && (
              <div className="flex justify-between">
                <span className="text-gray-500">Ort</span>
                <span className="text-gray-700">{selectedEvent.kontakte.ort}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                selectedEvent.status === 'erledigt' ? 'bg-gray-100 text-gray-600' :
                selectedEvent.status === 'montagebereit' ? 'bg-green-100 text-green-700' :
                'bg-amber-100 text-amber-700'
              }`}>{selectedEvent.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Montage-Team</span>
              <span className="text-gray-700">
                {MONTAGE_TEAMS.find(t => t.id === selectedEvent.montage_team)?.title || 'Nicht zugewiesen'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Datum</span>
              <span className="text-gray-700">{selectedEvent.montage_datum}</span>
            </div>
            {(selectedEvent.auftrags_wert || selectedEvent.angebots_wert) && (
              <div className="flex justify-between">
                <span className="text-gray-500">Wert</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(selectedEvent.auftrags_wert || selectedEvent.angebots_wert)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate(`/projekte/${selectedEvent.id}`)}
            className="mt-3 w-full rounded bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Zum Projekt
          </button>
        </div>
      )}
    </div>
  )
}
