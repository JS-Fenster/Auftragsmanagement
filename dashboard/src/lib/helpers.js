import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

// Parse date string safely (always use this instead of new Date())
export const parseDate = (d) => {
  if (!d) return null
  if (d instanceof Date) return d
  return typeof d === 'string' ? parseISO(d) : new Date(d)
}

export const getKontaktName = (kontakt) => {
  if (!kontakt) return 'Unbekannt'
  if (kontakt.firma1) return kontakt.firma1
  const hp = kontakt.kontakt_personen?.find((p) => p.ist_hauptkontakt) || kontakt.kontakt_personen?.[0]
  return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
}

export const getMonteurKuerzel = (termin) => {
  if (!termin.termin_ressourcen) return []
  return termin.termin_ressourcen
    .filter((r) => r.ressourcen?.typ === 'monteur')
    .map((r) => ({
      kuerzel: r.ressourcen.kuerzel,
      farbe: r.ressourcen.farbe,
      name: r.ressourcen.name,
      id: r.ressource_id,
    }))
}

export const getFahrzeugId = (termin) => {
  const fz = termin.termin_ressourcen?.find((r) => r.ressourcen?.typ === 'fahrzeug')
  return fz?.ressource_id ?? null
}

export const getFahrzeugName = (termin) => {
  const fz = termin.termin_ressourcen?.find((r) => r.ressourcen?.typ === 'fahrzeug')
  return fz?.ressourcen?.kuerzel || fz?.ressourcen?.name || null
}

export const formatTime = (isoString) => {
  const d = parseDate(isoString)
  if (!d) return ''
  return format(d, 'HH:mm')
}

export const formatDate = (d, fmt = 'dd.MM.yyyy') => {
  const parsed = parseDate(d)
  if (!parsed) return '-'
  return format(parsed, fmt, { locale: de })
}

export const formatDateTime = (start, end, ganztaegig) => {
  if (!start) return '-'
  const s = parseDate(start)
  if (ganztaegig) return formatDate(s) + ' (ganztägig)'
  const dateStr = formatDate(s)
  const startTime = format(s, 'HH:mm')
  const endTime = end ? format(parseDate(end), 'HH:mm') : ''
  return `${dateStr}, ${startTime}${endTime ? ` - ${endTime}` : ''}`
}
