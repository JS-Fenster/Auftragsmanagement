/**
 * BelegStatusBadge — Status-Anzeige fuer Belege
 *
 * Verwendung: <BelegStatusBadge status="entwurf" />
 */
import { BELEG_STATUS, BELEG_TYPEN } from './constants'

export function BelegStatusBadge({ status }) {
  const s = BELEG_STATUS[status]
  if (!s) return <span className="text-xs text-text-muted">{status || '-'}</span>

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

export function BelegTypBadge({ typ }) {
  const t = BELEG_TYPEN[typ]
  if (!t) return <span className="text-xs text-text-muted">{typ || '-'}</span>

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: t.bg, color: t.text }}
    >
      {t.label}
    </span>
  )
}
