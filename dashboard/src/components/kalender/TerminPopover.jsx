import { format } from 'date-fns'

const STATUS_CONFIG = {
  geplant:       { bg: '#EFF6FF', text: '#1E40AF', label: 'Geplant' },
  bestaetigt:    { bg: '#ECFDF5', text: '#065F46', label: 'Bestaetigt' },
  abgeschlossen: { bg: '#F3F4F6', text: '#374151', label: 'Abgeschlossen' },
  abgesagt:      { bg: '#FEE2E2', text: '#991B1B', label: 'Abgesagt' },
}

const getKontaktName = (kontakt) => {
  if (!kontakt) return 'Unbekannt'
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find(p => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
}

export default function TerminPopover({ termin, position }) {
  if (!termin || !position) return null

  const art = termin.termin_arten
  const status = STATUS_CONFIG[termin.status] || STATUS_CONFIG.geplant
  const kundenname = getKontaktName(termin.kontakte)
  const monteure = (termin.termin_ressourcen || []).filter(r => r.ressourcen?.typ === 'monteur')
  const fahrzeug = (termin.termin_ressourcen || []).find(r => r.ressourcen?.typ === 'fahrzeug')?.ressourcen
  const projekt = termin.projekte
  const notizen = termin.notizen || ''
  const notizenGekuerzt = notizen.length > 100 ? notizen.slice(0, 100) + '...' : notizen

  let zeitStr = ''
  if (termin.start_zeit) {
    const start = new Date(termin.start_zeit)
    const end = termin.end_zeit ? new Date(termin.end_zeit) : null
    zeitStr = format(start, 'HH:mm')
    if (end) zeitStr += ` - ${format(end, 'HH:mm')}`
    zeitStr += ' Uhr'
  }

  // Clamp position to viewport
  const popoverWidth = 280
  const popoverHeight = 200
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900
  let left = position.x
  let top = position.y
  // If overflows right, show to the left of the element
  if (left + popoverWidth > vw - 8) {
    left = Math.max(8, position.x - popoverWidth - 16)
  }
  // If overflows bottom, shift up
  if (top + popoverHeight > vh - 8) {
    top = Math.max(8, vh - popoverHeight - 8)
  }

  return (
    <div
      className="fixed z-50 pointer-events-none transition-opacity duration-150"
      style={{ left, top, opacity: 1 }}
    >
      <div className="bg-surface-card border border-border-default rounded-lg shadow-lg p-3 max-w-[280px] min-w-[200px]">
        {/* Art + Status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {art && (
            <span
              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: art.farbe || '#6B7280' }}
            >
              {art.name}
            </span>
          )}
          <span
            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {status.label}
          </span>
        </div>

        {/* Kunde */}
        <p className="text-sm font-semibold text-text-primary truncate mb-1" title={kundenname}>
          {kundenname}
        </p>

        {/* Uhrzeit */}
        {zeitStr && (
          <p className="text-xs text-text-secondary mb-1">{zeitStr}</p>
        )}

        {/* Projekt */}
        {projekt?.projekt_nummer && (
          <p className="text-xs text-brand font-medium mb-1">
            #{projekt.projekt_nummer}
          </p>
        )}

        {/* Monteure */}
        {monteure.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {monteure.map((r) => (
              <span
                key={r.ressource_id}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: r.ressourcen?.farbe || '#6B7280' }}
                title={r.ressourcen?.name}
              >
                {r.ressourcen?.kuerzel || '?'}
              </span>
            ))}
          </div>
        )}

        {/* Fahrzeug */}
        {fahrzeug?.name && (
          <p className="text-[10px] text-text-muted mb-1">
            🚐 {fahrzeug.name}
          </p>
        )}

        {/* Notizen */}
        {notizenGekuerzt && (
          <p className="text-[10px] text-text-muted mt-1.5 pt-1.5 border-t border-border-default leading-relaxed">
            {notizenGekuerzt}
          </p>
        )}
      </div>
    </div>
  )
}
