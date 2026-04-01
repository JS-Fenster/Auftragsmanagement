/**
 * ProjektBestellungen — Bestellungen table with inline creation form
 */
import { useState } from 'react'
import { Package, Plus, Save } from 'lucide-react'
import { formatDate, BESTELL_STATUS } from './projektConstants'

const EMPTY_BESTELLUNG = {
  bestell_nummer: '', lieferant_name: '', bestell_datum: new Date().toISOString().split('T')[0],
  ab_nummer: '', liefertermin_geplant: '', bestell_wert: '', notizen: ''
}

export default function ProjektBestellungen({ bestellungen, onCreateBestellung }) {
  const [showNew, setShowNew] = useState(false)
  const [newBestellung, setNewBestellung] = useState({ ...EMPTY_BESTELLUNG })

  const handleCreate = async () => {
    if (!newBestellung.lieferant_name.trim()) return
    await onCreateBestellung(newBestellung)
    setShowNew(false)
    setNewBestellung({ ...EMPTY_BESTELLUNG, bestell_datum: new Date().toISOString().split('T')[0] })
  }

  const handleCancel = () => {
    setShowNew(false)
    setNewBestellung({ ...EMPTY_BESTELLUNG, bestell_datum: new Date().toISOString().split('T')[0] })
  }

  return (
    <div id="sektion-bestellungen" className="bg-surface-card rounded-lg shadow-sm border border-border-default transition-all">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Package className="h-4 w-4 text-text-muted" /> Bestellungen
        </h2>
        <button onClick={() => setShowNew(true)} className="text-sm text-brand hover:text-brand-dark flex items-center gap-1">
          <Plus className="h-4 w-4" /> Neue Bestellung
        </button>
      </div>
      <div className="p-5">
        {showNew && (
          <div className="mb-4 p-4 bg-brand-light rounded-lg border border-blue-200 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary">Bestell-Nr.</label>
                <input type="text" value={newBestellung.bestell_nummer} onChange={e => setNewBestellung(d => ({ ...d, bestell_nummer: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="z.B. B-2026-001" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Lieferant *</label>
                <input type="text" value={newBestellung.lieferant_name} onChange={e => setNewBestellung(d => ({ ...d, lieferant_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="z.B. WERU" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Bestell-Datum</label>
                <input type="date" value={newBestellung.bestell_datum} onChange={e => setNewBestellung(d => ({ ...d, bestell_datum: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Wert</label>
                <input type="number" value={newBestellung.bestell_wert} onChange={e => setNewBestellung(d => ({ ...d, bestell_wert: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="0.00" step="0.01" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Notizen</label>
                <input type="text" value={newBestellung.notizen} onChange={e => setNewBestellung(d => ({ ...d, notizen: e.target.value }))} className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="Optionale Notizen..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
                Abbrechen
              </button>
              <button onClick={handleCreate} disabled={!newBestellung.lieferant_name.trim()} className="px-3 py-1.5 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                <Save className="h-4 w-4" /> Speichern
              </button>
            </div>
          </div>
        )}
        {bestellungen.length === 0 && !showNew ? (
          <p className="text-sm text-text-muted">Keine Bestellungen vorhanden.</p>
        ) : bestellungen.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  <th className="pb-2 pr-4">Bestell-Nr.</th>
                  <th className="pb-2 pr-4">Lieferant</th>
                  <th className="pb-2 pr-4">Datum</th>
                  <th className="pb-2 pr-4">AB-Nr.</th>
                  <th className="pb-2 pr-4">Liefertermin</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bestellungen.map(b => {
                  const bStatus = BESTELL_STATUS[b.status]
                  return (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-surface-main">
                      <td className="py-2 pr-4 font-medium">{b.bestell_nummer || '-'}</td>
                      <td className="py-2 pr-4">{b.lieferant_name || '-'}</td>
                      <td className="py-2 pr-4">{formatDate(b.bestell_datum)}</td>
                      <td className="py-2 pr-4">{b.ab_nummer || '-'}</td>
                      <td className="py-2 pr-4">{formatDate(b.liefertermin_geplant)}</td>
                      <td className="py-2">
                        {bStatus ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: bStatus.color, backgroundColor: bStatus.bg }}>
                            {bStatus.label}
                          </span>
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
