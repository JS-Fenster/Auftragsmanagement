export default function KundenHistorieTemplate({ data }) {
  if (!data) return null
  const { kontakt, projekte, dokumente, kommunikation } = data

  return (
    <div className="space-y-6">
      {kontakt && (
        <div className="bg-surface-hover rounded-lg p-4">
          <h3 className="font-semibold text-lg">{kontakt.firma1}</h3>
          <p className="text-sm text-text-muted">{[kontakt.strasse, kontakt.plz, kontakt.ort].filter(Boolean).join(', ')}</p>
        </div>
      )}

      {projekte && projekte.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Projekte ({projekte.length})</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-3">Titel</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {projekte.map((p, i) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-3">{p.titel}</td>
                  <td className="py-2 px-3">{(p.status || '').replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dokumente && dokumente.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Dokumente ({dokumente.length})</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-3">Kategorie</th>
                <th className="text-left py-2 px-3">Datum</th>
              </tr>
            </thead>
            <tbody>
              {dokumente.map((d, i) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-3">{(d.kategorie || '').replace(/_/g, ' ')}</td>
                  <td className="py-2 px-3">{d.datum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {kommunikation && kommunikation.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Kommunikation</h3>
          <div className="space-y-2">
            {kommunikation.map((k, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-text-muted w-28 flex-shrink-0">{k.datum}</span>
                <span className="font-medium w-16">{k.typ}</span>
                <span>{k.betreff}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
