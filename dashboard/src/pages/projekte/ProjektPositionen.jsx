/**
 * ProjektPositionen — Full-width positions table with grouping and totals
 */
import { Wrench } from 'lucide-react'
import { formatEuro } from './projektConstants'
import { POSITIONS_EINHEITEN } from '../../lib/constants'

export default function ProjektPositionen({ positionen }) {
  const activePositionen = positionen.filter(pos => pos.status !== 'REPLACED')
  const summablePositionen = activePositionen.filter(p => !p.ist_ueberschrift && !p.ist_alternativ)

  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Wrench className="h-4 w-4 text-text-muted" /> Positionen
        </h2>
      </div>
      <div className="p-5">
        {positionen.length === 0 ? (
          <p className="text-sm text-text-muted">Keine Positionen vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  <th className="pb-2 pr-4">Pos</th>
                  <th className="pb-2 pr-4">Bezeichnung</th>
                  <th className="pb-2 pr-4">Typ</th>
                  <th className="pb-2 pr-4 text-right">Breite</th>
                  <th className="pb-2 pr-4 text-right">Hoehe</th>
                  <th className="pb-2 pr-4 text-right">Menge</th>
                  <th className="pb-2 pr-4">Einheit</th>
                  <th className="pb-2 pr-4 text-right">EK</th>
                  <th className="pb-2 pr-4 text-right">VK</th>
                  <th className="pb-2 pr-4 text-right">Gesamt</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {activePositionen.map(pos => {
                  if (pos.ist_ueberschrift) {
                    return (
                      <tr key={pos.id} className="bg-surface-main">
                        <td className="py-2 pr-4 text-text-secondary">{pos.pos_nr}</td>
                        <td colSpan={10} className="py-2 font-bold text-text-primary">{pos.bezeichnung || pos.gruppe || '-'}</td>
                      </tr>
                    )
                  }
                  const isAlt = pos.ist_alternativ
                  const isNachtrag = pos.ist_nachtrag
                  return (
                    <tr key={pos.id} className={`border-b border-gray-50 hover:bg-surface-main ${isAlt ? 'opacity-50' : ''} ${isNachtrag ? 'bg-brand-light/30' : ''}`}>
                      <td className="py-2 pr-4 text-text-secondary">
                        {pos.pos_nr}
                        {pos.version > 1 && (
                          <span className="ml-1 text-xs px-1 py-0.5 rounded bg-brand-light text-brand-dark">V{pos.version}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {pos.bezeichnung || '-'}
                        {isAlt && <span className="ml-1 text-xs text-text-muted">(Alternativ)</span>}
                        {isNachtrag && <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-brand-light text-brand-dark">NT {pos.nachtrag_nr || ''}</span>}
                      </td>
                      <td className="py-2 pr-4">{pos.typ || '-'}</td>
                      <td className="py-2 pr-4 text-right">{pos.breite_mm || '-'}</td>
                      <td className="py-2 pr-4 text-right">{pos.hoehe_mm || '-'}</td>
                      <td className="py-2 pr-4 text-right">{pos.menge ?? '-'}</td>
                      <td className="py-2 pr-4 text-xs text-text-secondary">{POSITIONS_EINHEITEN[pos.einheit]?.short || pos.einheit || '-'}</td>
                      <td className="py-2 pr-4 text-right">{formatEuro(pos.einzelpreis)}</td>
                      <td className="py-2 pr-4 text-right">{formatEuro(pos.vk_preis)}</td>
                      <td className="py-2 pr-4 text-right font-medium">{isAlt ? '-' : formatEuro(pos.gesamtpreis)}</td>
                      <td className="py-2">{pos.status || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
              {summablePositionen.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border-default font-semibold">
                    <td colSpan={9} className="py-2 pr-4 text-right">Summe</td>
                    <td className="py-2 pr-4 text-right">
                      {formatEuro(summablePositionen.reduce((sum, p) => sum + (p.gesamtpreis || 0), 0))}
                    </td>
                    <td />
                  </tr>
                  {positionen.some(p => p.ist_nachtrag && p.status !== 'REPLACED') && (
                    <tr className="font-semibold text-brand-dark">
                      <td colSpan={9} className="py-1 pr-4 text-right text-sm">davon Nachträge</td>
                      <td className="py-1 pr-4 text-right text-sm">
                        {formatEuro(positionen.filter(p => p.ist_nachtrag && p.status !== 'REPLACED' && !p.ist_alternativ).reduce((sum, p) => sum + (p.gesamtpreis || 0), 0))}
                      </td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
