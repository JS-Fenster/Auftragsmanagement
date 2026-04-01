import { Search, User, MapPin, Phone, Mail } from 'lucide-react'
import {
  getDisplayName, getHauptperson, getPrimaerDetail,
  SourceBadge, KundeLieferantBadge
} from './KundenBadges'

export default function KundenListe({ results, loading, debouncedTerm, onSelectKontakt }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-text-secondary">Suche...</span>
      </div>
    )
  }

  if (debouncedTerm.length < 2) {
    return (
      <div className="text-center py-20 text-text-muted">
        <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Suchbegriff eingeben um Kontakte zu finden</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-20 text-text-muted">
        <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Keine Kontakte gefunden für &ldquo;{debouncedTerm}&rdquo;</p>
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-text-secondary mb-3">{results.length} Ergebnis{results.length !== 1 ? 'se' : ''}</p>
      <div className="grid gap-3">
        {results.map(k => {
          const displayName = getDisplayName(k)
          const hauptperson = getHauptperson(k)
          const telefonDetail = getPrimaerDetail(hauptperson, 'telefon')
          const emailDetail = getPrimaerDetail(hauptperson, 'email')
          const adresse = [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
          const hasErp = !!k.erp_kunden_code

          return (
            <div
              key={k.id}
              onClick={() => onSelectKontakt(k.id)}
              className="bg-surface-card rounded-lg shadow-sm border border-border-light p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-text-primary truncate">{displayName}</span>
                    <SourceBadge hasErp={hasErp} />
                    <KundeLieferantBadge istKunde={k.ist_kunde} istLieferant={k.ist_lieferant} />
                  </div>
                  {k.firma2 && <p className="text-sm text-text-secondary truncate">{k.firma2}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-text-secondary">
                    {adresse && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {adresse}
                      </span>
                    )}
                    {telefonDetail && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {telefonDetail.wert}
                      </span>
                    )}
                    {emailDetail && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {emailDetail.wert}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
