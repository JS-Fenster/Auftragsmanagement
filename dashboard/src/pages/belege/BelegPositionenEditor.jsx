/**
 * BelegPositionenEditor — Inline-editierbare Positions-Tabelle
 *
 * Pattern: Wie StepPositionen.jsx aus budgetangebot
 * Props: positionen, setPositionen
 */
import { useCallback } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { EditableCell } from '../budgetangebot/ui'
import { BELEG_EINHEITEN, formatEuro, generateTempId } from './constants'

export default function BelegPositionenEditor({ positionen, setPositionen }) {

  const updatePosition = useCallback((index, field, value) => {
    setPositionen(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [setPositionen])

  const deletePosition = useCallback((index) => {
    setPositionen(prev => prev.filter((_, i) => i !== index))
  }, [setPositionen])

  const addPosition = useCallback(() => {
    setPositionen(prev => [...prev, {
      _id: generateTempId(),
      bezeichnung: '',
      beschreibung: '',
      einheit: 'Stk',
      menge: 1,
      einzelpreis: 0,
      gruppe: '',
      breite: null,
      hoehe: null,
    }])
  }, [setPositionen])

  const addGruppenHeader = useCallback(() => {
    setPositionen(prev => [...prev, {
      _id: generateTempId(),
      bezeichnung: 'Neue Gruppe',
      _isGruppe: true,
      einheit: 'Stk',
      menge: 0,
      einzelpreis: 0,
    }])
  }, [setPositionen])

  const gesamtNetto = positionen.reduce((sum, p) => {
    if (p._isGruppe) return sum
    return sum + (parseFloat(p.menge) || 0) * (parseFloat(p.einzelpreis) || 0)
  }, 0)

  return (
    <div className="space-y-3">
      {/* Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
              <th className="pb-2 pr-2 w-12">Pos</th>
              <th className="pb-2 pr-2">Bezeichnung</th>
              <th className="pb-2 pr-2 w-24">Einheit</th>
              <th className="pb-2 pr-2 w-20 text-right">Menge</th>
              <th className="pb-2 pr-2 w-28 text-right">EP (netto)</th>
              <th className="pb-2 pr-2 w-28 text-right">GP (netto)</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {positionen.map((pos, idx) => {
              const gp = (parseFloat(pos.menge) || 0) * (parseFloat(pos.einzelpreis) || 0)

              // Gruppen-Header
              if (pos._isGruppe) {
                return (
                  <tr key={pos._id || pos.id || idx} className="bg-surface-hover border-b border-border-light">
                    <td className="py-2 pr-2 text-text-muted">{idx + 1}</td>
                    <td colSpan={5} className="py-2">
                      <EditableCell
                        value={pos.bezeichnung}
                        onChange={v => updatePosition(idx, 'bezeichnung', v)}
                        className="font-semibold"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => deletePosition(idx)}
                        className="text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Entfernen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={pos._id || pos.id || idx} className="group border-b border-gray-50 hover:bg-surface-main transition-colors">
                  <td className="py-2 pr-2 text-text-muted text-center">{idx + 1}</td>
                  <td className="py-2 pr-2">
                    <EditableCell
                      value={pos.bezeichnung}
                      onChange={v => updatePosition(idx, 'bezeichnung', v)}
                    />
                    {pos.beschreibung && (
                      <p className="text-xs text-text-muted mt-0.5 px-2">{pos.beschreibung}</p>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={pos.einheit || 'Stk'}
                      onChange={e => updatePosition(idx, 'einheit', e.target.value)}
                      className="text-sm border border-border-default rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {BELEG_EINHEITEN.map(e => (
                        <option key={e.value} value={e.value}>{e.value}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <EditableCell
                      value={pos.menge}
                      onChange={v => updatePosition(idx, 'menge', v)}
                      type="number"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <EditableCell
                      value={pos.einzelpreis}
                      onChange={v => updatePosition(idx, 'einzelpreis', v)}
                      type="number"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-medium">
                    {formatEuro(gp)}
                  </td>
                  <td className="py-2 text-center">
                    <button
                      onClick={() => deletePosition(idx)}
                      className="text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {positionen.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border-default">
                <td colSpan={5} className="py-3 pr-2 text-right font-semibold text-text-secondary">
                  Zwischensumme (netto)
                </td>
                <td className="py-3 pr-2 text-right font-bold text-text-primary">
                  {formatEuro(gesamtNetto)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={addPosition}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand hover:text-brand-dark hover:bg-brand-light rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Position hinzufuegen
        </button>
        <button
          onClick={addGruppenHeader}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
        >
          <GripVertical className="w-4 h-4" /> Gruppe hinzufuegen
        </button>
      </div>

      {positionen.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          <p className="text-sm">Noch keine Positionen vorhanden.</p>
          <p className="text-xs mt-1">Klicke "Position hinzufuegen" um zu starten.</p>
        </div>
      )}
    </div>
  )
}
