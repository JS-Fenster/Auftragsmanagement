export default function ProjektTemplate({ data }) {
  if (!data) return null
  const { projekt, timeline, dokumente, finanzen } = data

  return (
    <div className="space-y-6">
      {/* Project Header */}
      {projekt && (
        <div className="bg-surface-hover rounded-lg p-4">
          <h3 className="font-semibold text-lg">{projekt.titel}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
            <div><span className="text-text-muted">Nr:</span> {projekt.projekt_nummer}</div>
            <div><span className="text-text-muted">Status:</span> {(projekt.status || '').replace(/_/g, ' ')}</div>
            <div><span className="text-text-muted">Typ:</span> {projekt.typ}</div>
            <div><span className="text-text-muted">Prioritaet:</span> {projekt.prioritaet}</div>
          </div>
        </div>
      )}

      {/* Finance KPIs */}
      {finanzen && (
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Angebotswert" value={formatEur(finanzen.angebots_wert)} />
          <KpiCard label="Auftragswert" value={formatEur(finanzen.auftrags_wert)} />
          <KpiCard label="Rechnungsbetrag" value={formatEur(finanzen.rechnungs_betrag)} />
        </div>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Verlauf</h3>
          <div className="space-y-2">
            {timeline.map((entry, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-text-muted w-32 flex-shrink-0">{entry.datum}</span>
                <span className="font-medium">{entry.aktion}</span>
                {entry.details && <span className="text-text-muted">— {entry.details}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
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
    </div>
  )
}

function KpiCard({ label, value }) {
  return (
    <div className="bg-surface-hover rounded-lg p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-xl font-bold text-text-primary mt-1">{value}</p>
    </div>
  )
}

function formatEur(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
