/**
 * ProjektBelege — Belege table with navigation to individual Beleg
 */
import { useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { formatEuro, formatDate, BELEG_TYPEN_MAP, BELEG_STATUS_MAP } from './projektConstants'

export default function ProjektBelege({ projektId, projektBelege }) {
  const navigate = useNavigate()

  return (
    <div id="sektion-belege" className="bg-surface-card rounded-lg shadow-sm border border-border-default transition-all">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-muted" /> Belege
        </h2>
        <button onClick={() => navigate(`/belege/neu?projekt_id=${projektId}`)} className="text-sm text-brand hover:text-brand-dark flex items-center gap-1">
          <Plus className="h-4 w-4" /> Neuer Beleg
        </button>
      </div>
      <div className="p-5">
        {projektBelege.length === 0 ? (
          <p className="text-sm text-text-muted">Keine Belege vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  <th className="pb-2 pr-4">Beleg-Nr.</th>
                  <th className="pb-2 pr-4">Typ</th>
                  <th className="pb-2 pr-4">Datum</th>
                  <th className="pb-2 pr-4 text-right">Betrag</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {projektBelege.map(b => {
                  const typInfo = BELEG_TYPEN_MAP[b.beleg_typ]
                  const statusInfo = BELEG_STATUS_MAP[b.status]
                  return (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-surface-main cursor-pointer" onClick={() => navigate(`/belege/${b.id}`)}>
                      <td className="py-2 pr-4 font-medium text-brand">{b.beleg_nummer || '-'}</td>
                      <td className="py-2 pr-4">
                        {typInfo ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: typInfo.text, backgroundColor: typInfo.bg }}>{typInfo.label}</span>
                        ) : (b.beleg_typ || '-')}
                      </td>
                      <td className="py-2 pr-4">{formatDate(b.datum)}</td>
                      <td className="py-2 pr-4 text-right font-medium">{formatEuro(b.brutto_summe)}</td>
                      <td className="py-2">
                        {statusInfo ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: statusInfo.text || statusInfo.color, backgroundColor: statusInfo.bg }}>{statusInfo.label}</span>
                        ) : (b.status || '-')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
