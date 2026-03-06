const PROJEKT_PHASEN = {
  anfrage:           { label: 'Anfrage',         color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  angebot:           { label: 'Angebot',         color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  auftrag:           { label: 'Auftrag',         color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  bestellt:          { label: 'Bestellt',         color: '#F97316', bg: '#FFF7ED', text: '#9A3412' },
  ab_erhalten:       { label: 'AB erhalten',      color: '#14B8A6', bg: '#F0FDFA', text: '#115E59' },
  lieferung_geplant: { label: 'Lieferung gepl.',  color: '#06B6D4', bg: '#ECFEFF', text: '#155E75' },
  montagebereit:     { label: 'Montagebereit',    color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  erledigt:          { label: 'Erledigt',         color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
}

export { PROJEKT_PHASEN }

const SIZE_STYLES = {
  sm: { fontSize: '0.75rem', padding: '2px 8px', fontWeight: 500 },
  md: { fontSize: '0.875rem', padding: '4px 12px', fontWeight: 600 },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const phase = PROJEKT_PHASEN[status]
  if (!phase) return null

  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.sm

  return (
    <span
      className="inline-flex items-center rounded-full whitespace-nowrap"
      style={{
        backgroundColor: phase.bg,
        color: phase.text,
        border: `1px solid ${phase.color}30`,
        ...sizeStyle,
      }}
    >
      {phase.label}
    </span>
  )
}

const PRIORITAETEN = {
  niedrig:  { label: 'Niedrig',  color: '#6B7280', bg: '#F3F4F6' },
  normal:   { label: 'Normal',   color: '#3B82F6', bg: '#EFF6FF' },
  hoch:     { label: 'Hoch',     color: '#F59E0B', bg: '#FFFBEB' },
  dringend: { label: 'Dringend', color: '#DC2626', bg: '#FEF2F2' },
}

export { PRIORITAETEN }

export function PrioritaetBadge({ prioritaet }) {
  const prio = PRIORITAETEN[prioritaet]
  if (!prio) return null

  return (
    <span
      className="inline-flex items-center rounded-full whitespace-nowrap"
      style={{
        backgroundColor: prio.bg,
        color: prio.color,
        border: `1px solid ${prio.color}30`,
        fontSize: '0.7rem',
        padding: '1px 6px',
        fontWeight: 500,
      }}
    >
      {prio.label}
    </span>
  )
}
