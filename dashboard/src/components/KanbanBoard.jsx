import { useState } from 'react'
import StatusBadge, { PROJEKT_PHASEN } from './StatusBadge'
import { PrioritaetBadge } from './StatusBadge'
import { MONTAGE_TEAMS } from '../lib/constants'
import { GripVertical, User, Calendar, Euro, AlertTriangle } from 'lucide-react'

const PHASE_ORDER = [
  'anfrage', 'angebot', 'auftrag', 'bestellt',
  'ab_erhalten', 'lieferung_geplant', 'montagebereit',
  'abnahme', 'rechnung', 'bezahlt', 'erledigt',
]

const formatEuro = (v) =>
  v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : null

function daysAgo(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function daysColor(days) {
  if (days == null) return '#6B7280'
  if (days < 0) return '#3B82F6' // future date (e.g. planned delivery)
  if (days < 7) return '#10B981'
  if (days <= 14) return '#F59E0B'
  return '#DC2626'
}

function KanbanCard({ projekt, onProjektClick, isDragging, alerts, onDragStart }) {
  const kontakt = projekt.kontakte
  const hp = kontakt?.kontakt_personen?.find(p => p.ist_hauptkontakt) || kontakt?.kontakt_personen?.[0]
  const kundeName = kontakt?.firma1 || (hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : null) || 'Unbekannt'
  const wert = projekt.auftrags_wert || projekt.angebots_wert
  // Use the date when the project entered its current status phase
  const statusDateMap = {
    anfrage: projekt.created_at,
    angebot: projekt.angebots_datum,
    auftrag: projekt.auftrags_datum,
    bestellt: projekt.bestell_datum,
    ab_erhalten: projekt.ab_datum,
    lieferung_geplant: projekt.liefertermin_geplant,
    montagebereit: projekt.montage_datum || projekt.liefertermin_geplant,
    abnahme: projekt.abnahme_datum,
    rechnung: projekt.rechnung_datum,
    bezahlt: projekt.bezahlt_datum,
    erledigt: projekt.erledigt_datum,
  }
  const days = daysAgo(statusDateMap[projekt.status] || projekt.created_at)
  const hasAlert = alerts.some((a) => a.projekt?.id === projekt.id)
  const teamLabel = projekt.montage_team ? MONTAGE_TEAMS.find(t => t.value === projekt.montage_team)?.label || projekt.montage_team : null

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(projekt.id)
      }}
      onClick={() => onProjektClick?.(projekt.id)}
      className="rounded-lg border bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
      style={{
        opacity: isDragging ? 0.4 : 1,
        borderColor: '#E5E7EB',
      }}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-xs" style={{ color: '#9CA3AF' }}>
          {projekt.projekt_nummer}
        </span>
        <div className="flex items-center gap-1">
          {hasAlert && <AlertTriangle size={14} style={{ color: '#F59E0B' }} />}
          <GripVertical size={14} style={{ color: '#D1D5DB' }} />
        </div>
      </div>

      <p className="text-sm font-semibold truncate mb-1.5" style={{ color: '#111827' }}>
        {kundeName}
      </p>

      {wert != null && (
        <p className="text-xs font-medium mb-1" style={{ color: '#374151' }}>
          {formatEuro(wert)}
        </p>
      )}

      <div className="flex items-center justify-between gap-1 mt-2">
        {days != null && (
          <span className="text-xs font-medium" style={{ color: daysColor(days) }}>
            {days < 0 ? `In ${Math.abs(days)} Tagen` : days === 0 ? 'Heute' : `Seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`}
          </span>
        )}
        {projekt.prioritaet && projekt.prioritaet !== 'normal' && (
          <PrioritaetBadge prioritaet={projekt.prioritaet} />
        )}
      </div>

      {teamLabel && (
        <div className="mt-1.5">
          <span
            className="inline-flex items-center gap-1 rounded text-xs px-1.5 py-0.5"
            style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
          >
            <User size={10} />
            {teamLabel}
          </span>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({ column, dragOverColumn, onDragOver, onDrop, onDragLeave, onDragStart, onProjektClick, draggedId, alerts }) {
  const isOver = dragOverColumn === column.phase

  return (
    <div
      className="flex flex-col rounded-xl shrink-0"
      style={{
        width: '230px',
        minWidth: '200px',
        backgroundColor: isOver ? `${column.color}10` : '#F9FAFB',
        border: isOver ? `2px dashed ${column.color}` : '2px solid transparent',
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(column.phase)
      }}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(column.phase)}
    >
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-xl"
        style={{ borderBottom: `2px solid ${column.color}` }}
      >
        <span className="text-sm font-semibold" style={{ color: column.text }}>
          {column.label}
        </span>
        <span
          className="text-xs font-bold rounded-full min-w-[20px] text-center px-1.5 py-0.5"
          style={{ backgroundColor: column.color, color: '#FFFFFF' }}
        >
          {column.projekte.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 48px)' }}>
        {column.projekte.map((p) => (
          <KanbanCard
            key={p.id}
            projekt={p}
            onProjektClick={onProjektClick}
            isDragging={draggedId === p.id}
            alerts={alerts}
            onDragStart={onDragStart}
          />
        ))}
        {column.projekte.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>
            Keine Projekte
          </p>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ projekte = [], onStatusChange, onProjektClick, alerts = [] }) {
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  const columns = PHASE_ORDER.map((phase) => ({
    phase,
    ...PROJEKT_PHASEN[phase],
    projekte: projekte.filter((p) => p.status === phase),
  }))

  const handleDragStart = (id) => setDraggedId(id)

  const handleDragOver = (phase) => setDragOverColumn(phase)

  const handleDragLeave = () => setDragOverColumn(null)

  const handleDrop = (phase) => {
    if (draggedId && phase) {
      const projekt = projekte.find((p) => p.id === draggedId)
      if (projekt && projekt.status !== phase) {
        onStatusChange?.(draggedId, phase)
      }
    }
    setDraggedId(null)
    setDragOverColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverColumn(null)
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4"
      style={{ minHeight: '70vh' }}
      onDragEnd={handleDragEnd}
    >
      {columns.map((col) => (
        <KanbanColumn
          key={col.phase}
          column={col}
          dragOverColumn={dragOverColumn}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
          onDragStart={handleDragStart}
          onProjektClick={onProjektClick}
          draggedId={draggedId}
          alerts={alerts}
        />
      ))}
    </div>
  )
}
