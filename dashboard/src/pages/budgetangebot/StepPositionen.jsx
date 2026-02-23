/**
 * Budgetangebot - Step 2: Positionen-Tabelle
 *
 * Wann lesen: Wenn du die editierbare Positionstabelle aendern musst
 * (Spalten, Bearbeitung, Hinzufuegen/Loeschen von Positionen).
 */
import { useCallback } from 'react'
import { Trash2, Plus, ArrowLeft, ArrowRight } from 'lucide-react'
import { EditableCell } from './ui'
import { formatEuro, generateTempId } from './constants'

export function StepPositionen({ editedPositions, setEditedPositions, onBack, onNext }) {
  const updatePosition = useCallback((index, field, value) => {
    setEditedPositions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Recalculate Gesamtpreis
      if (['einzelpreis', 'menge'].includes(field)) {
        const ep = field === 'einzelpreis' ? value : updated[index].einzelpreis
        const mg = field === 'menge' ? value : updated[index].menge
        updated[index].gesamtpreis = (parseFloat(ep) || 0) * (parseInt(mg) || 1)
      }
      return updated
    })
  }, [setEditedPositions])

  const deletePosition = useCallback((index) => {
    setEditedPositions(prev => prev.filter((_, i) => i !== index))
  }, [setEditedPositions])

  const addPosition = useCallback(() => {
    setEditedPositions(prev => [
      ...prev,
      {
        _id: generateTempId(),
        pos: prev.length + 1,
        raum: '',
        typ: 'Fenster',
        bezeichnung: 'Neue Position',
        breite: 1000,
        hoehe: 1200,
        menge: 1,
        einzelpreis: 0,
        gesamtpreis: 0,
        zubehoer: [],
      },
    ])
  }, [setEditedPositions])

  const netto = editedPositions.reduce((sum, p) => sum + (parseFloat(p.gesamtpreis) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Positionen ({editedPositions.length})
          </h3>
          <div className="text-sm text-gray-500">
            Netto: <span className="font-semibold text-gray-900">{formatEuro(netto)}</span>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-4 py-3 w-12">Pos</th>
                <th className="px-4 py-3">Raum</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Bezeichnung</th>
                <th className="px-4 py-3 w-20">Breite</th>
                <th className="px-4 py-3 w-20">Hoehe</th>
                <th className="px-4 py-3 w-16">Menge</th>
                <th className="px-4 py-3 w-28">Einzelpreis</th>
                <th className="px-4 py-3 w-28">Gesamtpreis</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editedPositions.map((pos, idx) => (
                <tr key={pos._id || idx} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.raum}
                      onChange={v => updatePosition(idx, 'raum', v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.typ}
                      onChange={v => updatePosition(idx, 'typ', v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.bezeichnung}
                      onChange={v => updatePosition(idx, 'bezeichnung', v)}
                    />
                    {pos.zubehoer && pos.zubehoer.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-2">
                        {pos.zubehoer.map((z, zi) => (
                          <span
                            key={zi}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                          >
                            {typeof z === 'string' ? z : z.bezeichnung || z.typ || 'Zubehoer'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.breite}
                      onChange={v => updatePosition(idx, 'breite', v)}
                      type="number"
                      className="w-16"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.hoehe}
                      onChange={v => updatePosition(idx, 'hoehe', v)}
                      type="number"
                      className="w-16"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.menge}
                      onChange={v => updatePosition(idx, 'menge', v)}
                      type="number"
                      className="w-12"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={pos.einzelpreis}
                      onChange={v => updatePosition(idx, 'einzelpreis', v)}
                      type="number"
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {formatEuro(pos.gesamtpreis)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => deletePosition(idx)}
                      title="Position loeschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add position button */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            onClick={addPosition}
          >
            <Plus className="w-4 h-4" />
            Position hinzufuegen
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zur Eingabe
        </button>
        <button
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          disabled={editedPositions.length === 0}
          onClick={onNext}
        >
          Weiter zur Zusammenfassung
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
