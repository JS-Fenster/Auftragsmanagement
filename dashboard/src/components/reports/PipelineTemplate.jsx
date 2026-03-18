import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#F97316', '#14B8A6', '#06B6D4', '#10B981', '#059669', '#7C3AED', '#16A34A', '#6B7280', '#DC2626', '#9CA3AF', '#D97706']

export default function PipelineTemplate({ data }) {
  if (!data) return null
  const { nach_status, conversion } = data

  return (
    <div className="space-y-6">
      {/* Conversion KPIs */}
      {conversion && (
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Anfragen gesamt" value={conversion.anfragen_gesamt} />
          <KpiCard label="Auftraege gesamt" value={conversion.auftraege_gesamt} />
          <KpiCard label="Conversion Rate" value={`${((conversion.rate || 0) * 100).toFixed(1)}%`} />
        </div>
      )}

      {/* Status Distribution Chart */}
      {nach_status && nach_status.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Projekte nach Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nach_status} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="status" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => v} />
                <Bar dataKey="anzahl" name="Anzahl">
                  {nach_status.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Value per Status Table */}
      {nach_status && nach_status.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-primary mb-3">Wert pro Status</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Anzahl</th>
                <th className="text-right py-2 px-3">Wert</th>
              </tr>
            </thead>
            <tbody>
              {nach_status.map((s, i) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-3">{(s.status || '').replace(/_/g, ' ')}</td>
                  <td className="py-2 px-3 text-right">{s.anzahl}</td>
                  <td className="py-2 px-3 text-right">{formatEur(s.wert)}</td>
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
