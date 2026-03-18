import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function FinanzberichtTemplate({ data }) {
  if (!data) return null

  const { kpis, monatlich, top_rechnungen } = data

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Umsatz (Netto)" value={formatEur(kpis.umsatz_netto)} />
          <KpiCard label="Ausgaben (Netto)" value={formatEur(kpis.ausgaben_netto)} />
          <KpiCard label="Rechnungen Ein" value={kpis.anzahl_rechnungen_ein} />
          <KpiCard label="Rechnungen Aus" value={kpis.anzahl_rechnungen_aus} />
        </div>
      )}

      {/* Monthly Chart */}
      {monatlich && monatlich.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Monatliche Uebersicht</h3>
          <div className="h-64 print:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monatlich}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip formatter={(v) => formatEur(v)} />
                <Legend />
                <Bar dataKey="einnahmen" name="Einnahmen" fill="#10B981" />
                <Bar dataKey="ausgaben" name="Ausgaben" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Invoices Table */}
      {top_rechnungen && top_rechnungen.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Top Rechnungen</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-3">Firma</th>
                <th className="text-left py-2 px-3">Kategorie</th>
                <th className="text-right py-2 px-3">Betrag</th>
                <th className="text-left py-2 px-3">Datum</th>
              </tr>
            </thead>
            <tbody>
              {top_rechnungen.map((r, i) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-3">{r.firma}</td>
                  <td className="py-2 px-3">{(r.kategorie || '').replace(/_/g, ' ')}</td>
                  <td className="py-2 px-3 text-right font-medium">{formatEur(r.betrag)}</td>
                  <td className="py-2 px-3">{r.datum}</td>
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
