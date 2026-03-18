/**
 * BelegPositionenEditor — Inline-editierbare Positions-Tabelle
 *
 * Pattern: Wie StepPositionen.jsx aus budgetangebot
 * Props: positionen, setPositionen
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Trash2, GripVertical, BookOpen, Search, X } from 'lucide-react'
import { EditableCell } from '../budgetangebot/ui'
import { BELEG_EINHEITEN, formatEuro, generateTempId } from './constants'
import { supabase } from '../../lib/supabase'

function VorlagenPicker({ onSelect, onClose }) {
  const [vorlagen, setVorlagen] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    supabase.from('beleg_vorlagen').select('*').order('sort_order')
      .then(({ data }) => { setVorlagen(data || []); setLoading(false) })
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = search
    ? vorlagen.filter(v => v.bezeichnung.toLowerCase().includes(search.toLowerCase()) || (v.kategorie || '').toLowerCase().includes(search.toLowerCase()))
    : vorlagen

  const kategorien = [...new Set(filtered.map(v => v.kategorie || 'Sonstige'))]

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 w-96 max-h-80 bg-surface-card border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
      <div className="p-2 border-b border-border-default flex items-center gap-2">
        <Search size={14} className="text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Vorlage suchen..."
          className="flex-1 text-sm border-none outline-none bg-transparent"
          autoFocus
        />
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={14} />
        </button>
      </div>
      <div className="overflow-y-auto max-h-64">
        {loading ? (
          <p className="p-3 text-sm text-text-muted">Laden...</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-text-muted">Keine Vorlagen gefunden</p>
        ) : (
          kategorien.map(kat => (
            <div key={kat}>
              <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase bg-surface-main sticky top-0">{kat}</div>
              {filtered.filter(v => (v.kategorie || 'Sonstige') === kat).map(v => (
                <button
                  key={v.id}
                  onClick={() => onSelect(v)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{v.bezeichnung}</p>
                    {v.beschreibung && <p className="text-xs text-text-muted truncate">{v.beschreibung}</p>}
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{v.einheit}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function BelegPositionenEditor({ positionen, setPositionen }) {
  const [showVorlagen, setShowVorlagen] = useState(false)

  const addFromVorlage = useCallback((vorlage) => {
    setPositionen(prev => [...prev, {
      _id: generateTempId(),
      bezeichnung: vorlage.bezeichnung,
      beschreibung: vorlage.beschreibung || '',
      einheit: vorlage.einheit || 'Stk',
      menge: vorlage.menge || 1,
      einzelpreis: vorlage.einzelpreis || 0,
      gruppe: '',
      breite: null,
      hoehe: null,
    }])
    setShowVorlagen(false)
  }, [setPositionen])

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
      <div className="flex items-center gap-3 relative">
        <button
          onClick={addPosition}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand hover:text-brand-dark hover:bg-brand-light rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Position hinzufuegen
        </button>
        <button
          onClick={() => setShowVorlagen(prev => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
        >
          <BookOpen className="w-4 h-4" /> Aus Vorlage
        </button>
        <button
          onClick={addGruppenHeader}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
        >
          <GripVertical className="w-4 h-4" /> Gruppe hinzufuegen
        </button>
        {showVorlagen && (
          <VorlagenPicker onSelect={addFromVorlage} onClose={() => setShowVorlagen(false)} />
        )}
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
